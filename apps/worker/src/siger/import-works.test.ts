import { readFileSync } from "node:fs";

import {
  parseContractDetail,
  parseWorkDetail,
  type SigerClient,
  type SigerWorkPayload,
} from "@pad/data-sources";
import {
  contracts,
  createDatabase,
  documents,
  entityLinks,
  publicWorkAddresses,
  publicWorks,
  rawRecords,
  recordProvenance,
  runMigrations,
  seedSources,
} from "@pad/database";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { importSigerContracts } from "./import-contracts";
import { importSigerWorks } from "./import-works";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const BASE_URL = "https://sigerweb.net.br/pm_pauloafonso";
const fixture = (name: string): string =>
  readFileSync(
    new URL(`../../../../packages/data-sources/src/siger/__fixtures__/${name}`, import.meta.url),
    "utf8",
  );

const realWork = parseWorkDetail(fixture("obra-detalhe-16.html"));
const realContract = parseContractDetail(fixture("contrato-detalhe-3753.html"));

/** Fonte simulada com obras e, opcionalmente, o contrato 1091 a que a obra real se refere. */
function fakeClient(works: Record<string, SigerWorkPayload>, withContract = false): SigerClient {
  const workItems = Object.values(works).map((work) => ({ id: work.id, numero: work.numero }));
  const contractItems = withContract ? [{ id: "1091", numero: "ATA-0015/2025", tipo: "ATA" }] : [];
  return {
    listContractsPage: async (page) => ({
      total: contractItems.length,
      items: page === 1 ? contractItems : [],
    }),
    getContract: async (id) => ({ ...realContract, id, numero: "ATA-0015/2025" }),
    listBidsPage: async () => ({ total: 0, items: [] }),
    getBid: async (id) => {
      throw new Error(`sem licitação ${id}`);
    },
    listWorksPage: async (page) => ({ total: workItems.length, items: page === 1 ? workItems : [] }),
    getWork: async (id) => {
      const work = works[id];
      if (!work) throw new Error(`sem obra ${id}`);
      return work;
    },
  };
}

describe.skipIf(!TEST_DATABASE_URL)("importSigerWorks (integração com Postgres)", () => {
  const { db, close } = createDatabase(TEST_DATABASE_URL ?? "postgres://invalid", 2);
  const base = { db, baseUrl: BASE_URL, today: "2026-10-04", trigger: "manual" as const };

  beforeAll(async () => {
    await runMigrations(db);
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table entity_links, documents, record_provenance, raw_records, ingestion_runs,
        source_datasets, public_work_addresses, public_works, contract_budget_lines,
        contract_agencies, contract_amendments, contracts, agency_aliases, agencies, suppliers,
        sources cascade
    `);
    await seedSources(db);
  });

  afterAll(async () => {
    await close();
  });

  test("imports a work with addresses, documents and provenance", async () => {
    const summary = await importSigerWorks({ ...base, client: fakeClient({ "16": realWork }) });

    expect(summary).toMatchObject({ status: "success", found: 1, created: 1, failed: 0 });

    const [work] = await db.select().from(publicWorks);
    expect(work).toMatchObject({
      externalId: "16",
      title: "manutenção de rede de esgoto",
      initialValue: "640728.23",
      startDate: "2025-07-16",
      expectedEndDate: "2026-07-11",
      isExpectedEndDateDerived: true,
      sourceStatus: "Em andamento",
      status: "prazo_vencido",
      contractExternalId: "1091",
      contractNumber: "ATA-0015/2025",
      contractId: null,
    });

    const [address] = await db.select().from(publicWorkAddresses);
    expect(address).toMatchObject({ street: "ZONA URBANA", neighborhood: "DIVERSOS" });
    expect(await db.select().from(documents)).toHaveLength(1);

    const [raw] = await db.select().from(rawRecords);
    expect(raw?.payload).toMatchObject({ id: "16", valor: "640.728,23" });
    const [provenance] = await db.select().from(recordProvenance);
    expect(provenance).toMatchObject({ entityType: "public_work", entityId: work?.id });
  });

  test("links the work to its contract when the contract is already imported", async () => {
    const client = fakeClient({ "16": realWork }, true);
    await importSigerContracts({ ...base, client });

    await importSigerWorks({ ...base, client });

    const [contract] = await db.select().from(contracts).where(eq(contracts.externalId, "1091"));
    const [work] = await db.select().from(publicWorks);
    expect(work?.contractId).toBe(contract?.id);

    const [link] = await db.select().from(entityLinks);
    expect(link).toMatchObject({
      fromType: "public_work",
      toType: "contract",
      toId: contract?.id,
      method: "source_fk",
      confidence: "alta",
    });
  });

  test("links a previously imported work when its contract arrives later", async () => {
    const client = fakeClient({ "16": realWork }, true);
    await importSigerWorks({ ...base, client });

    await importSigerContracts({ ...base, client });

    const [work] = await db.select().from(publicWorks);
    expect(work?.contractId).not.toBeNull();
    expect(await db.select().from(entityLinks)).toHaveLength(1);
  });

  test("keeps a manual work-contract link across a new collection", async () => {
    const client = fakeClient({ "16": realWork });
    await importSigerWorks({ ...base, client });
    const [imported] = await db.select().from(publicWorks);
    const [contract] = await db
      .insert(contracts)
      .values({ sourceId: imported?.sourceId ?? "", externalId: "manual-1", number: "CT-0001/2025" })
      .returning({ id: contracts.id });
    await db.insert(entityLinks).values({
      fromType: "public_work",
      fromId: imported?.id ?? "",
      toType: "contract",
      toId: contract?.id ?? "",
      relation: "executada_por_contrato",
      method: "manual",
      confidence: "manual",
      evidence: { justificativa: "Conferido no termo de contrato." },
    });

    await importSigerWorks({ ...base, client });

    const [work] = await db.select().from(publicWorks);
    expect(work?.contractId).toBe(contract?.id);
  });

  test("does not reapply a revoked manual link", async () => {
    const client = fakeClient({ "16": realWork });
    await importSigerWorks({ ...base, client });
    const [imported] = await db.select().from(publicWorks);
    const [contract] = await db
      .insert(contracts)
      .values({ sourceId: imported?.sourceId ?? "", externalId: "manual-1", number: "CT-0001/2025" })
      .returning({ id: contracts.id });
    await db.insert(entityLinks).values({
      fromType: "public_work",
      fromId: imported?.id ?? "",
      toType: "contract",
      toId: contract?.id ?? "",
      relation: "executada_por_contrato",
      method: "manual",
      confidence: "manual",
      revokedAt: new Date(),
    });

    await importSigerWorks({ ...base, client });

    const [work] = await db.select().from(publicWorks);
    expect(work?.contractId).toBeNull();
  });

  test("marks a work that disappeared from the source instead of deleting it", async () => {
    const other = { ...realWork, id: "17", numero: "384" };
    await importSigerWorks({ ...base, client: fakeClient({ "16": realWork, "17": other }) });

    const summary = await importSigerWorks({
      ...base,
      today: "2026-10-05",
      client: fakeClient({ "16": realWork }),
    });

    expect(summary.missing).toBe(1);
    const [gone] = await db.select().from(publicWorks).where(eq(publicWorks.externalId, "17"));
    expect(gone?.sourceMissingSince).toBe("2026-10-05");
  });
});
