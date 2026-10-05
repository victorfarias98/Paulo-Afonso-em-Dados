import { SIGER_PAGE_SIZE, type SigerClient } from "@pad/data-sources";
import { publicWorks, SIGER_PMPA } from "@pad/database";
import { and, eq, inArray, isNotNull, isNull, notInArray } from "drizzle-orm";

import {
  type ImportOptions,
  type ImportSummary,
  runSourceImport,
  storeAndPersist,
} from "../pipeline/run-import";
import { linkSigerEntities } from "./links";
import { normalizeSigerWork, workPageUrl } from "./normalize-work";
import { persistWork } from "./work-repository";

export interface ImportWorksOptions extends ImportOptions {
  client: SigerClient;
  baseUrl: string;
}

/** Coleta obras do SIGER: listagem → registro bruto → normalização → banco. */
export function importSigerWorks(options: ImportWorksOptions): Promise<ImportSummary> {
  const { db, client, baseUrl, today } = options;

  return runSourceImport({
    ...options,
    sourceSlug: SIGER_PMPA,
    entityType: "public_work",
    label: "Obra",
    pageSize: SIGER_PAGE_SIZE,
    listPage: (page) => client.listWorksPage(page),

    async lastSeenByExternalId(sourceId) {
      const known = await db
        .select({ externalId: publicWorks.externalId, lastSeenAt: publicWorks.lastSeenAt })
        .from(publicWorks)
        .where(eq(publicWorks.sourceId, sourceId));
      return new Map(known.map((row) => [row.externalId, row.lastSeenAt.getTime()]));
    },

    async importOne({ sourceId, runId }, item) {
      const payload = await client.getWork(item.id);
      return storeAndPersist(
        db,
        {
          sourceId,
          entityType: "public_work",
          externalId: item.id,
          sourceUrl: workPageUrl(baseUrl, item.id),
          fetchMethod: "html_detail",
          payload,
          runId,
        },
        async (rawRecordId) => {
          const normalized = normalizeSigerWork(payload, { today, baseUrl });
          await persistWork(db, { sourceId, rawRecordId, normalized });
        },
      );
    },

    async markMissing(sourceId, seenIds) {
      if (seenIds.length === 0) return 0;
      const fromSource = eq(publicWorks.sourceId, sourceId);

      await db
        .update(publicWorks)
        .set({ sourceMissingSince: null })
        .where(
          and(
            fromSource,
            isNotNull(publicWorks.sourceMissingSince),
            inArray(publicWorks.externalId, seenIds),
          ),
        );
      const gone = await db
        .update(publicWorks)
        .set({ sourceMissingSince: today })
        .where(
          and(
            fromSource,
            isNull(publicWorks.sourceMissingSince),
            notInArray(publicWorks.externalId, seenIds),
          ),
        )
        .returning({ id: publicWorks.id });
      return gone.length;
    },

    afterImport: (sourceId) => linkSigerEntities(db, sourceId),
  });
}
