import { type EntityType, rawRecords, recordProvenance } from "@pad/database/schema";
import { and, asc, eq } from "drizzle-orm";

import { getDb } from "./db";

/** Versões do registro bruto que originaram a entidade, da mais antiga para a mais recente. */
export function listVersions(entityType: EntityType, entityId: string) {
  return getDb()
    .select({
      isPrimary: recordProvenance.isPrimary,
      transformations: recordProvenance.transformations,
      payloadHash: rawRecords.payloadHash,
      firstSeenAt: rawRecords.firstSeenAt,
      lastSeenAt: rawRecords.lastSeenAt,
    })
    .from(recordProvenance)
    .innerJoin(rawRecords, eq(rawRecords.id, recordProvenance.rawRecordId))
    .where(and(eq(recordProvenance.entityType, entityType), eq(recordProvenance.entityId, entityId)))
    .orderBy(asc(rawRecords.firstSeenAt));
}

export type RecordVersion = Awaited<ReturnType<typeof listVersions>>[number];

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escapa os curingas do LIKE para que o texto buscado seja tratado literalmente. */
export const likePattern = (text: string): string => `%${text.replace(/[\\%_]/g, "\\$&")}%`;
