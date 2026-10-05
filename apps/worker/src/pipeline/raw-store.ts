import { type Database, type EntityType, rawRecords } from "@pad/database";
import { and, desc, eq, sql } from "drizzle-orm";

import { hashPayload } from "./hash";

export type RawChange = "created" | "updated" | "unchanged";

export interface SaveRawInput {
  sourceId: string;
  entityType: EntityType;
  externalId: string;
  sourceUrl: string;
  fetchMethod: string;
  payload: unknown;
  runId: string;
}

export interface SavedRaw {
  id: string;
  change: RawChange;
}

/**
 * Guarda o registro bruto. Conteúdo idêntico ao da última versão só atualiza
 * `last_seen_at`; conteúdo diferente vira uma nova versão. Nada é sobrescrito.
 */
export async function saveRawRecord(db: Database, input: SaveRawInput): Promise<SavedRaw> {
  const payloadHash = hashPayload(input.payload);
  const sameRecord = and(
    eq(rawRecords.sourceId, input.sourceId),
    eq(rawRecords.entityType, input.entityType),
    eq(rawRecords.externalId, input.externalId),
  );

  const [latest] = await db
    .select({ id: rawRecords.id, payloadHash: rawRecords.payloadHash })
    .from(rawRecords)
    .where(sameRecord)
    .orderBy(desc(rawRecords.lastSeenAt))
    .limit(1);

  if (latest?.payloadHash === payloadHash) {
    await db.update(rawRecords).set({ lastSeenAt: sql`now()` }).where(eq(rawRecords.id, latest.id));
    return { id: latest.id, change: "unchanged" };
  }

  const [saved] = await db
    .insert(rawRecords)
    .values({
      sourceId: input.sourceId,
      entityType: input.entityType,
      externalId: input.externalId,
      sourceUrl: input.sourceUrl,
      fetchMethod: input.fetchMethod,
      payload: input.payload,
      payloadHash,
      firstRunId: input.runId,
    })
    // Conteúdo que voltou a uma versão antiga: reaproveita a linha e a torna a mais recente.
    .onConflictDoUpdate({
      target: [
        rawRecords.sourceId,
        rawRecords.entityType,
        rawRecords.externalId,
        rawRecords.payloadHash,
      ],
      set: { lastSeenAt: sql`now()`, importStatus: "pending", importError: null },
    })
    .returning({ id: rawRecords.id });

  if (!saved) {
    throw new Error(`Não foi possível gravar o registro bruto ${input.externalId}.`);
  }
  return { id: saved.id, change: latest ? "updated" : "created" };
}

export async function markRawFailed(db: Database, id: string, error: string): Promise<void> {
  await db
    .update(rawRecords)
    .set({ importStatus: "failed", importError: error })
    .where(eq(rawRecords.id, id));
}
