import {
  type Database,
  type EntityType,
  rawRecords,
  recordProvenance,
  type Transformation,
} from "@pad/database";
import { and, eq, ne } from "drizzle-orm";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Liga a entidade ao registro bruto que a originou e marca esse registro como
 * importado. A versão mais recente passa a ser a principal; as anteriores ficam.
 */
export async function linkProvenance(
  tx: Tx,
  entityType: EntityType,
  entityId: string,
  rawRecordId: string,
  transformations: Transformation[],
): Promise<void> {
  const sameEntity = and(
    eq(recordProvenance.entityType, entityType),
    eq(recordProvenance.entityId, entityId),
  );
  await tx
    .update(recordProvenance)
    .set({ isPrimary: false })
    .where(and(sameEntity, ne(recordProvenance.rawRecordId, rawRecordId)));
  await tx
    .insert(recordProvenance)
    .values({ entityType, entityId, rawRecordId, transformations })
    .onConflictDoUpdate({
      target: [recordProvenance.entityType, recordProvenance.entityId, recordProvenance.rawRecordId],
      set: { isPrimary: true, transformations },
    });
  await tx
    .update(rawRecords)
    .set({ importStatus: "imported", importError: null })
    .where(eq(rawRecords.id, rawRecordId));
}
