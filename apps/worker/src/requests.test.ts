import { collectionRequests, createDatabase, runMigrations } from "@pad/database";
import { asc, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { failInterruptedRequests, type JobRunners, processPendingRequests } from "./requests";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("fila de pedidos de coleta (integração com Postgres)", () => {
  const { db, close } = createDatabase(TEST_DATABASE_URL ?? "postgres://invalid", 2);
  const ran: string[] = [];
  const record = (job: string) => async () => {
    ran.push(job);
  };
  const runners: JobRunners = {
    obras: record("obras"),
    licitacoes: record("licitacoes"),
    contratos: async () => {
      throw new Error("fonte fora do ar");
    },
    camara_contratos: record("camara_contratos"),
    camara_licitacoes: record("camara_licitacoes"),
    despesas: record("despesas"),
    camara_despesas: record("camara_despesas"),
    tudo: record("tudo"),
  };
  const ignoreLog = (): void => undefined;

  beforeAll(async () => {
    await runMigrations(db);
  });

  beforeEach(async () => {
    ran.length = 0;
    await db.execute(sql`truncate table collection_requests`);
  });

  afterAll(async () => {
    await close();
  });

  test("runs pending requests in the order they were made and marks them done", async () => {
    await db.insert(collectionRequests).values({ job: "licitacoes", requestedAt: new Date(1000) });
    await db.insert(collectionRequests).values({ job: "obras", requestedAt: new Date(2000) });

    const processed = await processPendingRequests(db, runners, ignoreLog);

    expect(processed).toBe(2);
    expect(ran).toEqual(["licitacoes", "obras"]);
    const rows = await db.select().from(collectionRequests);
    expect(rows.every((row) => row.status === "done" && row.finishedAt !== null)).toBe(true);
  });

  test("records the failure of one request and still runs the next", async () => {
    await db.insert(collectionRequests).values({ job: "contratos", requestedAt: new Date(1000) });
    await db.insert(collectionRequests).values({ job: "obras", requestedAt: new Date(2000) });

    await processPendingRequests(db, runners, ignoreLog);

    const rows = await db
      .select()
      .from(collectionRequests)
      .orderBy(asc(collectionRequests.requestedAt));
    expect(rows[0]).toMatchObject({ status: "failed", message: "fonte fora do ar" });
    expect(rows[1]).toMatchObject({ status: "done" });
    expect(ran).toEqual(["obras"]);
  });

  test("does nothing when there is no pending request", async () => {
    await db.insert(collectionRequests).values({ job: "obras", status: "done" });

    expect(await processPendingRequests(db, runners, ignoreLog)).toBe(0);
    expect(ran).toEqual([]);
  });

  test("closes requests left running by a restarted worker", async () => {
    await db.insert(collectionRequests).values({ job: "obras", status: "running" });

    expect(await failInterruptedRequests(db)).toBe(1);

    const [row] = await db.select().from(collectionRequests);
    expect(row?.status).toBe("failed");
    expect(row?.message).toContain("reiniciado");
  });
});
