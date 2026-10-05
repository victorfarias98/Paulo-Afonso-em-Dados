import { readFileSync } from "node:fs";

import { parseSaiBids, type SaiBid, type SaiBidsClient } from "@pad/data-sources";
import {
  agencies,
  bids,
  createDatabase,
  rawRecords,
  runMigrations,
  seedSources,
} from "@pad/database";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { importCouncilBids, normalizeCouncilBid } from "./council-bids";

const fixture = (name: string): SaiBid[] =>
  parseSaiBids(
    readFileSync(
      new URL(`../../../../packages/data-sources/src/sai/__fixtures__/${name}`, import.meta.url),
      "utf8",
    ),
  );
const recent = fixture("licitacoes-camara-2026.json");
const old = fixture("licitacoes-camara-2019.json");
const [first] = recent as [SaiBid, ...SaiBid[]];
const homologated = old.find((bid) => bid.ValorHomologado === 7200) as SaiBid;

describe("normalizeCouncilBid", () => {
  test("keeps number, modality and status as published and uses the internal code as id", () => {
    expect(normalizeCouncilBid(first).bid).toMatchObject({
      externalId: "2:168631",
      number: "006/2026",
      processNumber: "095/2026",
      modality: "Inexigibilidade",
      sourceStatus: "Finalizado",
      status: "finalizado",
      openingDate: "2026-08-11",
    });
  });

  test("treats a zero value as not informed instead of as a real value", () => {
    const result = normalizeCouncilBid(first);

    expect(result.bid.estimatedValue).toBeNull();
    expect(result.bid.homologatedValue).toBeNull();
    expect(result.transformations).toContainEqual({
      field: "estimatedValue",
      from: 0,
      to: null,
      rule: "zero_as_not_informed",
    });
  });

  test("keeps the homologated value and tolerates a missing date", () => {
    const result = normalizeCouncilBid(homologated);

    expect(result.bid.homologatedValue).toBe("7200.00");
    expect(result.bid.openingDate).toBeNull();
  });
});

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("importCouncilBids (integração com Postgres)", () => {
  const { db, close } = createDatabase(TEST_DATABASE_URL ?? "postgres://invalid", 2);
  const base = { db, today: "2026-10-05", trigger: "manual" as const };
  const clientOf = (byYear: Record<number, SaiBid[] | Error>): SaiBidsClient => ({
    listBidYears: async () => Object.keys(byYear).map(Number),
    listBids: async (year) => {
      const result = byYear[year] ?? [];
      if (result instanceof Error) throw result;
      return result;
    },
  });

  beforeAll(async () => {
    await runMigrations(db);
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table entity_links, documents, record_provenance, raw_records, ingestion_runs,
        source_datasets, public_work_addresses, public_works, contract_budget_lines,
        contract_agencies, contract_amendments, payments, liquidations, commitments, contracts,
        bids, agency_aliases, agencies, suppliers, sources cascade
    `);
    await seedSources(db);
  });

  afterAll(async () => {
    await close();
  });

  test("imports the bids of every year, under the council, with the original record", async () => {
    const summary = await importCouncilBids({
      ...base,
      client: clientOf({ 2026: recent, 2019: old }),
    });

    expect(summary).toMatchObject({ status: "success", found: 34, created: 34, failed: 0 });
    const [bid] = await db.select().from(bids).where(eq(bids.externalId, "2:168631"));
    expect(bid).toMatchObject({ number: "006/2026", status: "finalizado" });
    const [agency] = await db.select().from(agencies).where(eq(agencies.id, bid?.agencyId ?? ""));
    expect(agency?.branch).toBe("legislativo");
    const [raw] = await db.select().from(rawRecords).where(eq(rawRecords.externalId, "2:168631"));
    expect(raw?.payload).toMatchObject({ NumeroLicitacao: "006/2026", ValorEstimado: 0 });
  });

  test("marks a bid that disappeared from the source instead of deleting it", async () => {
    await importCouncilBids({ ...base, client: clientOf({ 2026: recent }) });

    const summary = await importCouncilBids({
      ...base,
      client: clientOf({ 2026: recent.slice(1) }),
    });

    expect(summary.missing).toBe(1);
    const [gone] = await db.select().from(bids).where(eq(bids.externalId, "2:168631"));
    expect(gone?.sourceMissingSince).toBe("2026-10-05");
  });

  test("fails without marking anything as missing when one year cannot be read", async () => {
    await importCouncilBids({ ...base, client: clientOf({ 2026: recent, 2019: old }) });

    await expect(
      importCouncilBids({
        ...base,
        client: clientOf({ 2026: recent, 2019: new Error("fora do ar") }),
      }),
    ).rejects.toThrow("fora do ar");

    const missing = await db.select().from(bids).where(sql`source_missing_since is not null`);
    expect(missing).toHaveLength(0);
  });
});
