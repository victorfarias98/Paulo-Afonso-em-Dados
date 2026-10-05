import { readFileSync } from "node:fs";

import {
  parseContractDetail,
  type SigerClient,
  type SigerContractListItem,
  type SigerContractPayload,
} from "@pad/data-sources";
import {
  agencies,
  contractAgencies,
  contractBudgetLines,
  contracts,
  createDatabase,
  ingestionRuns,
  publicWorks,
  rawRecords,
  recordProvenance,
  runMigrations,
  seedSources,
  sources,
  suppliers,
} from "@pad/database";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { importSigerContracts } from "./import-contracts";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const BASE_URL = "https://sigerweb.net.br/pm_pauloafonso";

const real: SigerContractPayload = parseContractDetail(
  readFileSync(
    new URL(
      "../../../../packages/data-sources/src/siger/__fixtures__/contrato-detalhe-3753.html",
      import.meta.url,
    ),
    "utf8",
  ),
);

/** Fonte simulada: devolve o que o teste define, sem tocar a rede. */
function fakeClient(
  details: Record<string, SigerContractPayload | Error>,
  listed: SigerContractListItem[] = Object.keys(details).map((id) => ({
    id,
    numero: `N-${id}`,
    tipo: "ATA",
  })),
): SigerClient {
  return {
    listContractsPage: async (page) => ({ total: listed.length, items: page === 1 ? listed : [] }),
    getContract: async (id) => {
      const detail = details[id];
      if (!detail) throw new Error(`sem detalhe para ${id}`);
      if (detail instanceof Error) throw detail;
      return detail;
    },
    listBidsPage: async () => ({ total: 0, items: [] }),
    getBid: async (id) => {
      throw new Error(`sem licitação ${id}`);
    },
    listWorksPage: async () => ({ total: 0, items: [] }),
    getWork: async (id) => {
      throw new Error(`sem obra ${id}`);
    },
  };
}

describe.skipIf(!TEST_DATABASE_URL)("importSigerContracts (integração com Postgres)", () => {
  const { db, close } = createDatabase(TEST_DATABASE_URL ?? "postgres://invalid", 2);
  const run = (client: SigerClient, today = "2026-10-04") =>
    importSigerContracts({ db, client, baseUrl: BASE_URL, today, trigger: "manual" });

  beforeAll(async () => {
    await runMigrations(db);
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table entity_links, record_provenance, raw_records, ingestion_runs, source_datasets,
        public_work_addresses, public_works, contract_budget_lines, contract_agencies, contract_amendments, contracts,
        agency_aliases, agencies, suppliers, sources cascade
    `);
    await seedSources(db);
  });

  afterAll(async () => {
    await close();
  });

  test("imports a contract from the raw record to the normalized tables", async () => {
    const summary = await run(fakeClient({ "3753": real }));

    expect(summary).toMatchObject({ status: "success", found: 1, created: 1, failed: 0 });

    const [contract] = await db.select().from(contracts);
    expect(contract).toMatchObject({
      externalId: "3753",
      number: "ATA-0083/2026",
      kind: "ata_registro_precos",
      originalValue: "454404.56",
      signedAt: "2026-07-15",
      endsAt: "2027-07-15",
      sourceStatus: "NORMAL",
      status: "vigente",
      sourceMissingSince: null,
    });

    const [supplier] = await db.select().from(suppliers);
    expect(supplier).toMatchObject({ documentType: "cnpj", documentNumber: "10780363000140" });
    expect(contract?.supplierId).toBe(supplier?.id);

    expect(await db.select().from(agencies)).toHaveLength(2);
    expect(await db.select().from(contractAgencies)).toHaveLength(2);
    expect(await db.select().from(contractBudgetLines)).toHaveLength(2);
  });

  test("keeps the original payload and links it to the contract", async () => {
    await run(fakeClient({ "3753": real }));

    const [raw] = await db.select().from(rawRecords);
    expect(raw?.payload).toMatchObject({ id: "3753", valor: "454.404,56", tipo: "ATA" });
    expect(raw?.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(raw?.importStatus).toBe("imported");
    expect(raw?.sourceUrl).toContain("CadContratoFormExterno");

    const [contract] = await db.select().from(contracts);
    const [provenance] = await db.select().from(recordProvenance);
    expect(provenance).toMatchObject({ entityType: "contract", rawRecordId: raw?.id });
    expect(provenance?.entityId).toBe(contract?.id);
    expect(provenance?.transformations.map((t) => t.field)).toContain("originalValue");
  });

  test("does not create a new version when nothing changed at the source", async () => {
    await run(fakeClient({ "3753": real }));
    const summary = await run(fakeClient({ "3753": real }));

    expect(summary).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(await db.select().from(rawRecords)).toHaveLength(1);
    expect(await db.select().from(contracts)).toHaveLength(1);
    expect(await db.select().from(suppliers)).toHaveLength(1);
  });

  test("stores a new raw version and updates the contract when the source changes", async () => {
    await run(fakeClient({ "3753": real }));
    const summary = await run(fakeClient({ "3753": { ...real, valor: "500.000,00" } }));

    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
    expect(await db.select().from(rawRecords)).toHaveLength(2);

    const [contract] = await db.select().from(contracts);
    expect(contract?.originalValue).toBe("500000.00");
    expect(await db.select().from(recordProvenance)).toHaveLength(2);
  });

  test("marks a contract that disappeared from a full scan instead of deleting it", async () => {
    const other = { ...real, id: "4000", numero: "CT-0001/2026" };
    await run(fakeClient({ "3753": real, "4000": other }));

    const summary = await run(fakeClient({ "3753": real }), "2026-10-05");

    expect(summary.missing).toBe(1);
    const [gone] = await db.select().from(contracts).where(eq(contracts.externalId, "4000"));
    expect(gone?.sourceMissingSince).toBe("2026-10-05");
    expect(await db.select().from(contracts)).toHaveLength(2);
  });

  test("does not mark records as missing when the scan looks broken", async () => {
    const many = Object.fromEntries(
      ["1", "2", "3", "4"].map((id) => [id, { ...real, id, numero: `CT-${id}` }]),
    );
    await run(fakeClient(many));

    const summary = await run(fakeClient({ "1": many["1"] as SigerContractPayload }));

    expect(summary.status).toBe("suspect");
    expect(summary.missing).toBe(0);
    const missing = await db.select().from(contracts).where(sql`source_missing_since is not null`);
    expect(missing).toHaveLength(0);
  });

  test("records the failure of one contract and keeps importing the others", async () => {
    const other = { ...real, id: "4000", numero: "CT-0001/2026" };
    const summary = await run(
      fakeClient({ "3753": new Error("layout mudou"), "4000": other }),
    );

    expect(summary).toMatchObject({ status: "partial", created: 1, failed: 1 });
    expect(await db.select().from(contracts)).toHaveLength(1);

    const [runRow] = await db.select().from(ingestionRuns);
    expect(runRow?.recordsFailed).toBe(1);
    expect(runRow?.errorSummary).toContain("layout mudou");
    expect(runRow?.finishedAt).not.toBeNull();
  });

  test("fetches first the contracts that imported works refer to", async () => {
    const [source] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, "siger-pmpa"));
    await db.insert(publicWorks).values({
      sourceId: source?.id ?? "",
      externalId: "16",
      title: "obra de teste",
      contractExternalId: "2",
    });
    const three = Object.fromEntries(
      ["1", "2", "3"].map((id) => [id, { ...real, id, numero: `CT-${id}` }]),
    );

    await importSigerContracts({
      db,
      client: fakeClient(three),
      baseUrl: BASE_URL,
      today: "2026-10-04",
      trigger: "manual",
      maxDetails: 1,
    });

    const imported = await db.select({ externalId: contracts.externalId }).from(contracts);
    expect(imported).toEqual([{ externalId: "2" }]);
    const [work] = await db.select().from(publicWorks);
    expect(work?.contractId).not.toBeNull();
  });

  test("imports an amendment a work cites even though it is outside the public list", async () => {
    const [source] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, "siger-pmpa"));
    await db.insert(publicWorks).values({
      sourceId: source?.id ?? "",
      externalId: "16",
      title: "obra de teste",
      contractExternalId: "1339",
      contractNumber: "1 ADT-277/2024/2025",
    });
    const details = {
      "1": { ...real, id: "1", numero: "CT-1" },
      "1339": { ...real, id: "1339", numero: "1 ADT-277/2024/2025", aditivo: "1º" },
    };
    const client = fakeClient(details, [{ id: "1", numero: "CT-1", tipo: "CONTRATO" }]);

    await run(client);
    const second = await run(client);

    const [amendment] = await db.select().from(contracts).where(eq(contracts.externalId, "1339"));
    expect(amendment).toMatchObject({ kind: "termo_aditivo", number: "1 ADT-277/2024/2025" });
    // Está fora da listagem, mas não pode ser tratado como removido da fonte.
    expect(second.missing).toBe(0);
    expect(amendment?.sourceMissingSince).toBeNull();
    const [work] = await db.select().from(publicWorks);
    expect(work?.contractId).toBe(amendment?.id);
  });

  test("stores the raw record as failed when the data cannot be normalized", async () => {
    const summary = await run(fakeClient({ "3753": { ...real, valor: "a combinar" } }));

    expect(summary).toMatchObject({ status: "partial", failed: 1 });
    const [raw] = await db.select().from(rawRecords);
    expect(raw?.importStatus).toBe("failed");
    expect(raw?.importError).toMatch(/valor monetário/i);
    expect(await db.select().from(contracts)).toHaveLength(0);
  });
});
