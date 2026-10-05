import { SIGER_PAGE_SIZE, type SigerClient } from "@pad/data-sources";
import { contracts, publicWorks, SIGER_PMPA } from "@pad/database";
import { and, eq, inArray, isNotNull, isNull, notInArray } from "drizzle-orm";

import {
  type ImportOptions,
  type ImportSummary,
  runSourceImport,
  storeAndPersist,
} from "../pipeline/run-import";
import { persistContract } from "./contract-repository";
import { linkSigerEntities } from "./links";
import { contractPageUrl, normalizeSigerContract } from "./normalize-contract";

export type { ImportSummary };

export interface ImportContractsOptions extends ImportOptions {
  client: SigerClient;
  baseUrl: string;
}

/** Coleta contratos do SIGER: listagem → registro bruto → normalização → banco. */
export function importSigerContracts(options: ImportContractsOptions): Promise<ImportSummary> {
  const { db, client, baseUrl, today } = options;

  return runSourceImport({
    ...options,
    sourceSlug: SIGER_PMPA,
    entityType: "contract",
    label: "Contrato",
    pageSize: SIGER_PAGE_SIZE,
    listPage: (page) => client.listContractsPage(page),

    async lastSeenByExternalId(sourceId) {
      const known = await db
        .select({ externalId: contracts.externalId, lastSeenAt: contracts.lastSeenAt })
        .from(contracts)
        .where(eq(contracts.sourceId, sourceId));
      return new Map(known.map((row) => [row.externalId, row.lastSeenAt.getTime()]));
    },

    /** Contratos que obras já importadas apontam vêm antes, para fechar o vínculo obra → contrato. */
    async priorityExternalIds(sourceId) {
      const referenced = await db
        .selectDistinct({ externalId: publicWorks.contractExternalId })
        .from(publicWorks)
        .where(and(eq(publicWorks.sourceId, sourceId), isNotNull(publicWorks.contractExternalId)));
      return new Set(referenced.flatMap((row) => (row.externalId ? [row.externalId] : [])));
    },

    /**
     * Termos aditivos: obras citam o id de registros que não estão na listagem
     * pública de contratos, mas cuja página de detalhe a fonte publica.
     */
    async extraItems(sourceId, listedIds) {
      const referenced = await db
        .selectDistinct({
          externalId: publicWorks.contractExternalId,
          number: publicWorks.contractNumber,
        })
        .from(publicWorks)
        .where(and(eq(publicWorks.sourceId, sourceId), isNotNull(publicWorks.contractExternalId)));
      return referenced.flatMap((row) =>
        row.externalId && !listedIds.has(row.externalId)
          ? [{ id: row.externalId, numero: row.number ?? "", tipo: "" }]
          : [],
      );
    },

    async importOne({ sourceId, runId }, item) {
      const detail = await client.getContract(item.id);
      const record = { ...detail, tipo: item.tipo };
      return storeAndPersist(
        db,
        {
          sourceId,
          entityType: "contract",
          externalId: item.id,
          sourceUrl: contractPageUrl(baseUrl, item.id),
          fetchMethod: "html_detail",
          payload: record,
          runId,
        },
        async (rawRecordId) => {
          const normalized = normalizeSigerContract(record, { today, baseUrl });
          await persistContract(db, { sourceId, rawRecordId, normalized });
        },
      );
    },

    /** Marca como ausentes os contratos que sumiram da fonte; nunca apaga. */
    async markMissing(sourceId, seenIds) {
      if (seenIds.length === 0) return 0;
      const fromSource = eq(contracts.sourceId, sourceId);

      await db
        .update(contracts)
        .set({ sourceMissingSince: null })
        .where(
          and(
            fromSource,
            isNotNull(contracts.sourceMissingSince),
            inArray(contracts.externalId, seenIds),
          ),
        );
      const gone = await db
        .update(contracts)
        .set({ sourceMissingSince: today })
        .where(
          and(
            fromSource,
            isNull(contracts.sourceMissingSince),
            notInArray(contracts.externalId, seenIds),
          ),
        )
        .returning({ id: contracts.id });
      return gone.length;
    },

    // Um contrato recém-importado pode ser o que uma obra já importada esperava.
    afterImport: (sourceId) => linkSigerEntities(db, sourceId),
  });
}
