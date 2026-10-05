import {
  adminAuditLog,
  collectionRequests,
  contracts,
  createDatabase,
  entityLinks,
  manualOverrides,
  publicWorks,
  runMigrations,
  seedSources,
  SIGER_PMPA,
  sources,
} from "@pad/database";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import {
  correctedFieldLabel,
  createOverride,
  ensureAdminUser,
  linkWorkToContract,
  requestCollection,
  revokeManualLink,
  revokeOverride,
} from "./admin-actions";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const JUSTIFICATION = "Contrato confirmado no termo publicado no Diário Oficial.";

describe("correctedFieldLabel", () => {
  test("returns the readable name of a known field and the key otherwise", () => {
    expect(correctedFieldLabel("contract", "ends_at")).toBe("Fim da vigência");
    expect(correctedFieldLabel("contract", "nao_existe")).toBe("nao_existe");
    expect(correctedFieldLabel("payment", "value")).toBe("value");
  });
});

describe.skipIf(!TEST_DATABASE_URL)("ações do admin (integração com Postgres)", () => {
  const { db, close } = createDatabase(TEST_DATABASE_URL ?? "postgres://invalid", 2);
  let userId = "";
  let workId = "";
  let contractId = "";
  let sourceId = "";

  const link = (contract: string, justification = JUSTIFICATION) =>
    linkWorkToContract(db, userId, { workId, contract, justification });

  beforeAll(async () => {
    await runMigrations(db);
  });

  beforeEach(async () => {
    await db.execute(sql`
      truncate table collection_requests, admin_audit_log, manual_overrides, entity_links,
        record_provenance, raw_records, ingestion_runs, source_datasets, documents,
        public_work_addresses, public_works, contract_budget_lines, contract_agencies,
        contract_amendments, payments, liquidations, commitments, contracts, bids,
        agency_aliases, agencies, suppliers, sources, admin_users cascade
    `);
    await seedSources(db);
    const [source] = await db.select().from(sources).where(eq(sources.slug, SIGER_PMPA));
    sourceId = source?.id ?? "";

    userId = await ensureAdminUser(db, "victor");
    const [contract] = await db
      .insert(contracts)
      .values({ sourceId, externalId: "10", number: "CT-0010/2025", originalValue: "1500.00" })
      .returning({ id: contracts.id });
    const [work] = await db
      .insert(publicWorks)
      .values({ sourceId, externalId: "5", title: "Pavimentação da Rua A" })
      .returning({ id: publicWorks.id });
    contractId = contract?.id ?? "";
    workId = work?.id ?? "";
  });

  afterAll(async () => {
    await close();
  });

  test("ensureAdminUser returns the same id for the same login", async () => {
    expect(await ensureAdminUser(db, "victor")).toBe(userId);
  });

  test("links a work to a contract by number and records author, justification and audit", async () => {
    const result = await link("ct-0010/2025");

    expect(result).toEqual({ ok: true, message: "Obra ligada ao contrato CT-0010/2025." });
    const [work] = await db.select().from(publicWorks).where(eq(publicWorks.id, workId));
    expect(work?.contractId).toBe(contractId);
    const [created] = await db.select().from(entityLinks);
    expect(created).toMatchObject({
      method: "manual",
      confidence: "manual",
      createdBy: userId,
      evidence: { justificativa: JUSTIFICATION },
    });
    const [entry] = await db.select().from(adminAuditLog);
    expect(entry).toMatchObject({ userId, action: "vinculo_manual_criado" });
  });

  test("accepts the contract page address instead of the number", async () => {
    const result = await link(`https://exemplo.org/contratos/${contractId}`);

    expect(result.ok).toBe(true);
  });

  test("refuses a link without justification, to an unknown contract or to an already linked work", async () => {
    const short = await link("CT-0010/2025", "ok");
    const unknown = await link("CT-9999/2025");
    await link("CT-0010/2025");
    const again = await link("CT-0010/2025");

    expect(short.ok).toBe(false);
    expect(unknown.ok).toBe(false);
    expect(again).toEqual({ ok: false, message: "Esta obra já está ligada a um contrato." });
    expect(await db.select().from(entityLinks)).toHaveLength(1);
  });

  test("refuses a contract number that matches more than one contract", async () => {
    await db.insert(contracts).values({ sourceId, externalId: "11", number: "CT-0010/2025" });

    const result = await link("CT-0010/2025");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("mais de um contrato");
  });

  test("revoking a manual link unlinks the work and keeps the record", async () => {
    await link("CT-0010/2025");
    const [created] = await db.select().from(entityLinks);

    const result = await revokeManualLink(db, userId, created?.id ?? "");

    expect(result.ok).toBe(true);
    const [work] = await db.select().from(publicWorks).where(eq(publicWorks.id, workId));
    expect(work?.contractId).toBeNull();
    const [revoked] = await db.select().from(entityLinks);
    expect(revoked?.revokedAt).not.toBeNull();
    expect((await revokeManualLink(db, userId, created?.id ?? "")).ok).toBe(false);
  });

  test("a correction stores original, corrected value, justification and author without touching the official data", async () => {
    const result = await createOverride(db, userId, {
      entityType: "contract",
      entity: `/contratos/${contractId}`,
      field: "original_value",
      correctedValue: "15000.00",
      justification: JUSTIFICATION,
    });

    expect(result.ok).toBe(true);
    // Lido como texto: o ORM converteria "1500.00" em número ao interpretar o JSON.
    const [override] = (await db.execute(sql`
      select entity_id, field, original_value #>> '{}' as original,
             corrected_value #>> '{}' as corrected, justification, user_id
        from manual_overrides
    `)) as unknown as Array<Record<string, string>>;
    expect(override).toEqual({
      entity_id: contractId,
      field: "original_value",
      original: "1500.00",
      corrected: "15000.00",
      justification: JUSTIFICATION,
      user_id: userId,
    });
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(contract?.originalValue).toBe("1500.00");
  });

  test("refuses a correction on a field outside the allowed list or on a missing record", async () => {
    const forbidden = await createOverride(db, userId, {
      entityType: "contract",
      entity: contractId,
      field: "supplier_id",
      correctedValue: "x",
      justification: JUSTIFICATION,
    });
    const missing = await createOverride(db, userId, {
      entityType: "bid",
      entity: contractId,
      field: "description",
      correctedValue: "x",
      justification: JUSTIFICATION,
    });

    expect(forbidden).toEqual({ ok: false, message: "Este campo não aceita correção manual." });
    expect(missing.ok).toBe(false);
    expect(await db.select().from(manualOverrides)).toHaveLength(0);
  });

  test("revokes a correction once", async () => {
    await createOverride(db, userId, {
      entityType: "public_work",
      entity: workId,
      field: "title",
      correctedValue: "Pavimentação da Rua B",
      justification: JUSTIFICATION,
    });
    const [override] = await db.select().from(manualOverrides);

    expect((await revokeOverride(db, userId, override?.id ?? "")).ok).toBe(true);
    expect((await revokeOverride(db, userId, override?.id ?? "")).ok).toBe(false);
  });

  test("queues a collection request and refuses a duplicate or unknown job", async () => {
    const first = await requestCollection(db, userId, "obras");
    const duplicate = await requestCollection(db, userId, "obras");
    const unknown = await requestCollection(db, userId, "apagar_tudo");

    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    expect(unknown).toEqual({ ok: false, message: "Coleta desconhecida." });
    const requests = await db.select().from(collectionRequests);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ job: "obras", status: "pending", requestedBy: userId });
  });
});
