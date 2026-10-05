import { readFileSync } from "node:fs";

import {
  type ExpensePhase,
  type ExpenseRow,
  type MunicipioOnlineClient,
  parseExpenseTable,
} from "@pad/data-sources";
import {
  agencies,
  commitments,
  entityLinks,
  contracts,
  createDatabase,
  liquidations,
  payments,
  rawRecords,
  recordProvenance,
  runMigrations,
  seedSources,
  sources,
  suppliers,
} from "@pad/database";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { importMunicipioOnlineExpenses, reprocessExpenses } from "./import-expenses";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const PAGE_URL = "https://www.municipioonline.com.br/ba/prefeitura/pauloafonso/cidadao/despesa";
const fixture = (name: string): string =>
  readFileSync(
    new URL(
      `../../../../packages/data-sources/src/municipio-online/__fixtures__/${name}`,
      import.meta.url,
    ),
    "utf8",
  );

const real: Record<ExpensePhase, ExpenseRow[]> = {
  commitment: parseExpenseTable(fixture("empenhos-2026-09.html"), "commitment"),
  liquidation: parseExpenseTable(fixture("liquidacoes-2026-09.html"), "liquidation"),
  payment: parseExpenseTable(fixture("pagamentos-2026-09.html"), "payment"),
};

const fakeClient = (rows: ExpenseRow[]): MunicipioOnlineClient => ({
  fetchMonth: async () => rows,
});

describe.skipIf(!TEST_DATABASE_URL)("importMunicipioOnlineExpenses (integração)", () => {
  const { db, close } = createDatabase(TEST_DATABASE_URL ?? "postgres://invalid", 2);
  const base = {
    db,
    pageUrl: PAGE_URL,
    year: 2026,
    months: [9],
    today: "2026-10-04",
    trigger: "manual" as const,
  };

  beforeAll(async () => {
    await runMigrations(db);
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table entity_links, documents, record_provenance, raw_records, ingestion_runs,
        source_datasets, payments, liquidations, commitments, public_work_addresses, public_works,
        contract_budget_lines, contract_agencies, contract_amendments, contracts, bids,
        agency_aliases, agencies, suppliers, sources cascade
    `);
    await seedSources(db);
  });

  afterAll(async () => {
    await close();
  });

  test("imports commitments with supplier, agency and the original row", async () => {
    const summary = await importMunicipioOnlineExpenses({
      ...base,
      phase: "commitment",
      client: fakeClient(real.commitment),
    });

    expect(summary).toMatchObject({ status: "success", found: 4, created: 4, failed: 0 });

    const [row] = await db.select().from(commitments).where(eq(commitments.externalId, "14217327000124:1035_2026"));
    expect(row).toMatchObject({
      fiscalYear: 2026,
      number: "09300001",
      commitmentDate: "2026-09-30",
      committedValue: "474516.63",
    });
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, row?.supplierId ?? ""));
    expect(supplier?.documentNumber).toBe("00400247000103");
    const [agency] = await db.select().from(agencies).where(eq(agencies.id, row?.agencyId ?? ""));
    expect(agency?.name).toBe("SECRETARIA MUNICIPAL DE FAZENDA");

    const raws = await db.select().from(rawRecords);
    expect(raws).toHaveLength(4);
    expect(raws.every((raw) => raw.importStatus === "imported")).toBe(true);
    expect(await db.select().from(recordProvenance)).toHaveLength(4);
  });

  test("imports settlements and payments into their own tables", async () => {
    await importMunicipioOnlineExpenses({
      ...base,
      phase: "liquidation",
      client: fakeClient(real.liquidation),
    });
    await importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient(real.payment) });

    const [settlement] = await db
      .select()
      .from(liquidations)
      .where(eq(liquidations.externalId, "14217327000124:5567_2026"));
    const [payment] = await db.select().from(payments).where(eq(payments.externalId, "13383192000104:1297_2026"));
    expect(settlement).toMatchObject({ value: "1459.70", liquidationDate: "2026-09-30" });
    expect(payment).toMatchObject({ value: "585.03", paymentDate: "2026-09-30" });
  });

  test("does not duplicate anything when the same month is imported again", async () => {
    const run = () =>
      importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient(real.payment) });
    await run();
    const summary = await run();

    expect(summary).toMatchObject({ created: 0, unchanged: 4 });
    expect(await db.select().from(payments)).toHaveLength(4);
    expect(await db.select().from(rawRecords)).toHaveLength(4);
  });

  test("marks a record that disappeared from an imported month instead of deleting it", async () => {
    await importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient(real.payment) });

    const summary = await importMunicipioOnlineExpenses({
      ...base,
      today: "2026-10-05",
      phase: "payment",
      client: fakeClient(real.payment.slice(1)),
    });

    expect(summary.missing).toBe(1);
    const gone = await db.select().from(payments).where(sql`source_missing_since is not null`);
    expect(gone).toHaveLength(1);
    expect(gone[0]?.sourceMissingSince).toBe("2026-10-05");
  });

  test("does not mark anything as missing when the month comes back empty", async () => {
    await importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient(real.payment) });

    const summary = await importMunicipioOnlineExpenses({
      ...base,
      phase: "payment",
      client: fakeClient([]),
    });

    expect(summary.status).toBe("suspect");
    expect(summary.missing).toBe(0);
  });

  test("links a payment to the only contract of that bid with that supplier", async () => {
    const [payment] = real.payment;
    const row = { ...payment, "Licitacao/Dispensa/Inexigibilidade": "PE0001/2026/2026" } as ExpenseRow;
    await importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient([row]) });
    const [imported] = await db.select().from(payments);
    const [siger] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, "siger-pmpa"));
    const contractOf = (externalId: string, supplierId: string | null) => ({
      sourceId: siger?.id ?? "",
      externalId,
      number: `CT-${externalId}`,
      bidNumber: "PE0001/2026",
      supplierId,
    });
    const [other] = await db
      .insert(suppliers)
      .values({ documentType: "cnpj", documentNumber: "11111111000111", legalName: "OUTRA", nameNormalized: "OUTRA" })
      .returning();
    await db
      .insert(contracts)
      .values([contractOf("1", imported?.supplierId ?? null), contractOf("2", other?.id ?? null)]);

    await importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient([row]) });

    const [linked] = await db.select().from(payments);
    const [contract] = await db.select().from(contracts).where(eq(contracts.externalId, "1"));
    expect(linked?.contractId).toBe(contract?.id);
  });

  test("links a payment to the commitment it cites when description and creditor also match", async () => {
    const [commitment] = real.commitment;
    const [payment] = real.payment;
    const cited = {
      ...payment,
      CNPJ: commitment?.CNPJ,
      // O pagamento cita o número do empenho, não o sequencial (SqEmpenho).
      Empenho: commitment?.Empenho,
      DsEmpenho: commitment?.DsEmpenho,
      Credor: commitment?.Credor,
      "CPF/CNPJ Credor": commitment?.["CPF/CNPJ Credor"],
    } as ExpenseRow;
    const otherYear = { ...cited, Chave: "999999_2026", DsEmpenho: "EMPENHO DE OUTRO EXERCÍCIO" } as ExpenseRow;
    await importMunicipioOnlineExpenses({
      ...base,
      phase: "commitment",
      client: fakeClient(commitment ? [commitment] : []),
    });

    await importMunicipioOnlineExpenses({
      ...base,
      phase: "payment",
      client: fakeClient([cited, otherYear]),
    });

    const [stored] = await db.select().from(commitments);
    const rows = await db.select().from(payments);
    const linked = rows.find((row) => !row.externalId.endsWith("999999_2026"));
    const unlinked = rows.find((row) => row.externalId.endsWith("999999_2026"));
    expect(linked?.commitmentId).toBe(stored?.id);
    // Mesmo número de empenho, mas descrição diferente: pode ser de outro exercício.
    expect(unlinked?.commitmentId).toBeNull();
    const links = await db.select().from(entityLinks);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ toType: "commitment", method: "number_match", confidence: "media" });
  });

  test("follows the commitment number, not the sequence, when both exist with the same text", async () => {
    const [template] = real.commitment;
    const [payment] = real.payment;
    const commitmentOf = (number: string, sequence: string) =>
      ({ ...template, Empenho: number, SqEmpenho: sequence, Chave: `${sequence}_2026` }) as ExpenseRow;
    // O sequencial do primeiro ("11") é igual ao número do segundo.
    const rows = [commitmentOf("10", "11"), commitmentOf("11", "12")];
    const cited = {
      ...payment,
      CNPJ: template?.CNPJ,
      Empenho: "11",
      DsEmpenho: template?.DsEmpenho,
      Credor: template?.Credor,
      "CPF/CNPJ Credor": template?.["CPF/CNPJ Credor"],
    } as ExpenseRow;
    await importMunicipioOnlineExpenses({ ...base, phase: "commitment", client: fakeClient(rows) });

    await importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient([cited]) });

    const [linked] = await db.select().from(payments);
    const [target] = await db.select().from(commitments).where(eq(commitments.number, "11"));
    expect(linked?.commitmentId).toBe(target?.id);
  });

  test("leaves a payment unlinked when two contracts fit the same bid and supplier", async () => {
    const [payment] = real.payment;
    const row = { ...payment, "Licitacao/Dispensa/Inexigibilidade": "PE0001/2026/2026" } as ExpenseRow;
    await importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient([row]) });
    const [imported] = await db.select().from(payments);
    const [siger] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, "siger-pmpa"));
    await db.insert(contracts).values(
      ["1", "2"].map((externalId) => ({
        sourceId: siger?.id ?? "",
        externalId,
        number: `CT-${externalId}`,
        bidNumber: "PE0001/2026",
        supplierId: imported?.supplierId ?? null,
      })),
    );

    await importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient([row]) });

    const [still] = await db.select().from(payments);
    expect(still?.contractId).toBeNull();
  });

  test("imports two records that share the source key but belong to different management units", async () => {
    const [payment] = real.payment;
    const sameKeyOtherUnit = { ...payment, CNPJ: "08704475000170", Pago: "R$ 10,00" } as ExpenseRow;

    const summary = await importMunicipioOnlineExpenses({
      ...base,
      phase: "payment",
      client: fakeClient([payment as ExpenseRow, sameKeyOtherUnit]),
    });

    expect(summary).toMatchObject({ created: 2, updated: 0, failed: 0 });
    expect(await db.select().from(payments)).toHaveLength(2);
  });

  test("reports an identifier repeated within one collection instead of overwriting", async () => {
    const [payment] = real.payment;
    const summary = await importMunicipioOnlineExpenses({
      ...base,
      phase: "payment",
      client: fakeClient([payment as ExpenseRow, { ...payment, Pago: "R$ 10,00" } as ExpenseRow]),
    });

    expect(summary).toMatchObject({ status: "partial", created: 1, failed: 1 });
    const [kept] = await db.select().from(payments);
    expect(kept?.value).toBe("585.03");
  });

  test("rebuilds the normalized records from the stored raw rows without the source", async () => {
    await importMunicipioOnlineExpenses({ ...base, phase: "payment", client: fakeClient(real.payment) });
    await db.execute(sql`truncate table record_provenance; delete from payments`);

    const result = await reprocessExpenses(db, "payment", PAGE_URL);

    expect(result).toEqual({ reprocessed: 4, failed: 0 });
    expect(await db.select().from(payments)).toHaveLength(4);
  });

  test("keeps importing when one row cannot be normalized", async () => {
    const broken = { ...real.payment[0], Chave: "9999_2026", Pago: "a combinar" } as ExpenseRow;
    const summary = await importMunicipioOnlineExpenses({
      ...base,
      phase: "payment",
      client: fakeClient([broken, ...real.payment]),
    });

    expect(summary).toMatchObject({ status: "partial", created: 4, failed: 1 });
    expect(await db.select().from(payments)).toHaveLength(4);
  });
});
