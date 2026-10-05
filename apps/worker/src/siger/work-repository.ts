import {
  type Database,
  documents,
  entityLinks,
  publicWorkAddresses,
  publicWorks,
} from "@pad/database";
import { and, eq, sql } from "drizzle-orm";

import { linkProvenance } from "../pipeline/provenance";
import type { NormalizedWork } from "./normalize-work";

export interface PersistWorkInput {
  sourceId: string;
  rawRecordId: string;
  normalized: NormalizedWork;
}

interface LinkedRow {
  work_id: string;
  contract_id: string;
  contract_external_id: string;
}

/** Grava a obra normalizada, seus endereços, anexos e a origem do dado em uma transação. */
export async function persistWork(db: Database, input: PersistWorkInput): Promise<string> {
  const { sourceId, rawRecordId, normalized } = input;

  return db.transaction(async (tx) => {
    const [work] = await tx
      .insert(publicWorks)
      .values({ ...normalized.work, sourceId })
      .onConflictDoUpdate({
        target: [publicWorks.sourceId, publicWorks.externalId],
        // O vínculo com o contrato é refeito por `linkWorksToContracts` a cada execução.
        set: {
          ...normalized.work,
          contractId: null,
          sourceMissingSince: null,
          lastSeenAt: sql`now()`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: publicWorks.id });
    if (!work) throw new Error(`Não foi possível gravar a obra ${normalized.work.externalId}.`);

    await tx.delete(publicWorkAddresses).where(eq(publicWorkAddresses.publicWorkId, work.id));
    if (normalized.addresses.length > 0) {
      await tx.insert(publicWorkAddresses).values(
        normalized.addresses.map((address, position) => ({
          ...address,
          publicWorkId: work.id,
          position,
        })),
      );
    }

    await tx
      .delete(documents)
      .where(and(eq(documents.entityType, "public_work"), eq(documents.entityId, work.id)));
    if (normalized.documents.length > 0) {
      await tx.insert(documents).values(
        normalized.documents.map((document) => ({
          ...document,
          sourceId,
          entityType: "public_work" as const,
          entityId: work.id,
        })),
      );
    }

    await linkProvenance(tx, "public_work", work.id, rawRecordId, normalized.transformations);
    return work.id;
  });
}

/**
 * Liga cada obra ao contrato que a própria fonte indica (id interno do SIGER).
 * Roda ao fim das coletas de obras e de contratos, pois um pode chegar antes do
 * outro. Devolve quantas obras foram ligadas nesta chamada.
 */
export async function linkWorksToContracts(db: Database, sourceId: string): Promise<number> {
  const linked = (await db.execute(sql`
    update public_works pw
       set contract_id = c.id, updated_at = now()
      from contracts c
     where pw.source_id = ${sourceId}
       and c.source_id = pw.source_id
       and c.external_id = pw.contract_external_id
       and pw.contract_id is null
    returning pw.id as work_id, c.id as contract_id, pw.contract_external_id
  `)) as unknown as LinkedRow[];

  if (linked.length > 0) {
    await db
      .insert(entityLinks)
      .values(
        linked.map((row) => ({
          fromType: "public_work" as const,
          fromId: row.work_id,
          toType: "contract" as const,
          toId: row.contract_id,
          relation: "executada_por_contrato",
          method: "source_fk" as const,
          confidence: "alta" as const,
          evidence: { campo: "id_contrato", valor: row.contract_external_id },
        })),
      )
      .onConflictDoNothing();
  }
  return linked.length;
}
