import { readFileSync } from "node:fs";

import { parseSaiContracts, type SaiContract, saiContractKey } from "@pad/data-sources";
import {
  agencies,
  contracts,
  createDatabase,
  runMigrations,
  seedSources,
  suppliers,
} from "@pad/database";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { importCouncilContracts, normalizeCouncilContract } from "./council-contracts";

const real = parseSaiContracts(
  readFileSync(
    new URL(
      "../../../../packages/data-sources/src/sai/__fixtures__/contratos-camara.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const [first] = real as [SaiContract, ...SaiContract[]];
const today = "2026-10-04";

describe("saiContractKey", () => {
  test("combines origin, code and number, because the code alone repeats", () => {
    expect(saiContractKey(first)).toBe("SAI:130083:006/2026");
    expect(saiContractKey({ ...first, NumeroContrato: "007/2026" })).not.toBe(saiContractKey(first));
  });
});

describe("normalizeCouncilContract", () => {
  const result = normalizeCouncilContract(first, today);

  test("converts value and dates", () => {
    expect(result.contract).toMatchObject({
      externalId: "SAI:130083:006/2026",
      number: "006/2026",
      modality: "Inexigibilidade",
      originalValue: "150000.00",
      signedAt: "2026-08-11",
      endsAt: "2027-08-11",
      fiscalYear: 2026,
      status: "vigente",
    });
    expect(result.agencyNames).toEqual(["Câmara Municipal de Paulo Afonso"]);
  });

  test("does not store a masked document as if it were a CNPJ", () => {
    expect(result.supplier).toMatchObject({
      documentType: "unknown",
      documentNumber: null,
      isDocumentMasked: true,
      legalName: "Raimundo Freitas Sociedade Individual de Advocacia",
    });
  });

  test("keeps a full CNPJ when the source publishes one", () => {
    const withCnpj = normalizeCouncilContract({ ...first, CNPJ_CPF: "10.780.363/0001-40" }, today);

    expect(withCnpj.supplier).toMatchObject({
      documentType: "cnpj",
      documentNumber: "10780363000140",
    });
  });

  test("treats the API's empty date as missing", () => {
    const noEnd = normalizeCouncilContract(
      { ...first, DataFimVigencia: "0001-01-01T00:00:00" },
      today,
    );

    expect(noEnd.contract.endsAt).toBeNull();
    expect(noEnd.contract.status).toBe("informacao_insuficiente");
  });
});

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("importCouncilContracts (integração)", () => {
  const { db, close } = createDatabase(TEST_DATABASE_URL ?? "postgres://invalid", 2);

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

  test("imports every contract, including two that share the same code", async () => {
    const sameCode = { ...first, NumeroContrato: "007/2026" };
    const summary = await importCouncilContracts({
      db,
      client: { listContracts: async () => [...real, sameCode] },
      today,
      trigger: "manual",
    });

    expect(summary).toMatchObject({ status: "success", found: 4, created: 4, failed: 0 });
    expect(await db.select().from(contracts)).toHaveLength(4);

    const [agency] = await db.select().from(agencies);
    expect(agency).toMatchObject({ name: "Câmara Municipal de Paulo Afonso", branch: "legislativo" });
    const stored = await db.select().from(suppliers);
    expect(stored.every((row) => !row.documentNumber?.includes("*"))).toBe(true);
  });
});
