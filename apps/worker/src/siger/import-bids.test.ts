import { readFileSync } from "node:fs";

import {
  parseBidDetail,
  parseContractDetail,
  parseWorkDetail,
  type SigerBidPayload,
  type SigerClient,
} from "@pad/data-sources";
import {
  agencies,
  bids,
  contracts,
  createDatabase,
  entityLinks,
  publicWorks,
  rawRecords,
  runMigrations,
  seedSources,
} from "@pad/database";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { importSigerBids } from "./import-bids";
import { importSigerContracts } from "./import-contracts";
import { importSigerWorks } from "./import-works";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const BASE_URL = "https://sigerweb.net.br/pm_pauloafonso";
const fixture = (name: string): string =>
  readFileSync(
    new URL(`../../../../packages/data-sources/src/siger/__fixtures__/${name}`, import.meta.url),
    "utf8",
  );

const realBid = parseBidDetail(fixture("licitacao-detalhe-2116.html"));
const realContract = parseContractDetail(fixture("contrato-detalhe-3753.html"));
const realWork = parseWorkDetail(fixture("obra-detalhe-16.html"));

/** Fonte simulada com as licitações dadas, o contrato real (PE90027/2026) e a obra real (1585). */
function fakeClient(bidList: SigerBidPayload[]): SigerClient {
  const one = <T>(items: T[]) => async (page: number) => ({
    total: items.length,
    items: page === 1 ? items : [],
  });
  return {
    listBidsPage: one(bidList.map((bid) => ({ id: bid.id, numero: bid.numero }))),
    getBid: async (id) => {
      const bid = bidList.find((item) => item.id === id);
      if (!bid) throw new Error(`sem licitação ${id}`);
      return bid;
    },
    listContractsPage: one([{ id: "3753", numero: realContract.numero, tipo: "ATA" }]),
    getContract: async () => realContract,
    listWorksPage: one([{ id: "16", numero: realWork.numero }]),
    getWork: async () => realWork,
  };
}

describe.skipIf(!TEST_DATABASE_URL)("importSigerBids (integração com Postgres)", () => {
  const { db, close } = createDatabase(TEST_DATABASE_URL ?? "postgres://invalid", 2);
  const base = { db, baseUrl: BASE_URL, today: "2026-10-04", trigger: "manual" as const };

  beforeAll(async () => {
    await runMigrations(db);
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table entity_links, documents, record_provenance, raw_records, ingestion_runs,
        source_datasets, public_work_addresses, public_works, contract_budget_lines,
        contract_agencies, contract_amendments, contracts, bids, agency_aliases, agencies,
        suppliers, sources cascade
    `);
    await seedSources(db);
  });

  afterAll(async () => {
    await close();
  });

  test("imports a bid with its agency and original payload", async () => {
    const summary = await importSigerBids({ ...base, client: fakeClient([realBid]) });

    expect(summary).toMatchObject({ status: "success", found: 1, created: 1, failed: 0 });

    const [bid] = await db.select().from(bids);
    expect(bid).toMatchObject({
      externalId: "2116",
      number: "PE0080/2026",
      estimatedValue: "680786.48",
      publishedAt: "2026-09-15",
      openingDate: "2026-10-02",
      sourceStatus: "Publicado",
      status: "publicado",
    });
    const [agency] = await db.select().from(agencies);
    expect(agency?.name).toBe("SECRETARIA MUNICIPAL DE EDUCACAO");
    expect(bid?.agencyId).toBe(agency?.id);

    const [raw] = await db.select().from(rawRecords);
    expect(raw?.payload).toMatchObject({ id: "2116", valor: "680.786,48" });
  });

  test("links a contract to the bid with the same number, whichever arrives first", async () => {
    const bidOfContract = { ...realBid, id: "1900", numero: "PE90027/2026" };
    const client = fakeClient([realBid, bidOfContract]);

    await importSigerContracts({ ...base, client });
    await importSigerBids({ ...base, client });

    const [contract] = await db.select().from(contracts);
    const [bid] = await db.select().from(bids).where(eq(bids.externalId, "1900"));
    expect(contract?.bidId).toBe(bid?.id);

    const links = await db.select().from(entityLinks).where(eq(entityLinks.toType, "bid"));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ fromType: "contract", method: "number_match", confidence: "media" });
  });

  test("does not link by number when two bids share the same number", async () => {
    const first = { ...realBid, id: "1900", numero: "PE90027/2026" };
    const second = { ...realBid, id: "1901", numero: "PE90027/2026" };
    const client = fakeClient([first, second]);

    await importSigerBids({ ...base, client });
    await importSigerContracts({ ...base, client });

    const [contract] = await db.select().from(contracts);
    expect(contract?.bidId).toBeNull();
  });

  test("links a work to its bid by the internal id the source publishes", async () => {
    const bidOfWork = { ...realBid, id: "1585", numero: "PE90037/2025" };
    const client = fakeClient([bidOfWork]);

    await importSigerWorks({ ...base, client });
    await importSigerBids({ ...base, client });

    const [work] = await db.select().from(publicWorks);
    const [bid] = await db.select().from(bids);
    expect(work?.bidId).toBe(bid?.id);

    const links = await db.select().from(entityLinks).where(eq(entityLinks.toType, "bid"));
    expect(links[0]).toMatchObject({ fromType: "public_work", method: "source_fk", confidence: "alta" });
  });
});
