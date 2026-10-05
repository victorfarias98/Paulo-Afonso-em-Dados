import { SIGER_PAGE_SIZE, type SigerClient } from "@pad/data-sources";
import { bids, type Database, SIGER_PMPA } from "@pad/database";
import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";

import { linkProvenance } from "../pipeline/provenance";
import {
  type ImportOptions,
  type ImportSummary,
  runSourceImport,
  storeAndPersist,
} from "../pipeline/run-import";
import { resolveAgency } from "./contract-repository";
import { linkSigerEntities } from "./links";
import { bidPageUrl, type NormalizedBid, normalizeSigerBid } from "./normalize-bid";

export interface ImportBidsOptions extends ImportOptions {
  client: SigerClient;
  baseUrl: string;
}

/** Grava a licitação normalizada, seu órgão e a origem do dado em uma transação. */
export async function persistBid(
  db: Database,
  sourceId: string,
  rawRecordId: string,
  normalized: NormalizedBid,
): Promise<void> {
  await db.transaction(async (tx) => {
    const agencyId = normalized.agencyName
      ? await resolveAgency(tx, sourceId, normalized.agencyName)
      : null;
    const values = { ...normalized.bid, agencyId };

    const [bid] = await tx
      .insert(bids)
      .values({ ...values, sourceId })
      .onConflictDoUpdate({
        target: [bids.sourceId, bids.externalId],
        set: { ...values, sourceMissingSince: null, lastSeenAt: sql`now()`, updatedAt: sql`now()` },
      })
      .returning({ id: bids.id });
    if (!bid) throw new Error(`Não foi possível gravar a licitação ${normalized.bid.externalId}.`);

    await linkProvenance(tx, "bid", bid.id, rawRecordId, normalized.transformations);
  });
}

/** Coleta licitações do SIGER: listagem → registro bruto → normalização → banco. */
export function importSigerBids(options: ImportBidsOptions): Promise<ImportSummary> {
  const { db, client, baseUrl, today } = options;

  return runSourceImport({
    ...options,
    sourceSlug: SIGER_PMPA,
    entityType: "bid",
    label: "Licitação",
    pageSize: SIGER_PAGE_SIZE,
    listPage: (page) => client.listBidsPage(page),

    async lastSeenByExternalId(sourceId) {
      const known = await db
        .select({ externalId: bids.externalId, lastSeenAt: bids.lastSeenAt })
        .from(bids)
        .where(eq(bids.sourceId, sourceId));
      return new Map(known.map((row) => [row.externalId, row.lastSeenAt.getTime()]));
    },

    async importOne({ sourceId, runId }, item) {
      const payload = await client.getBid(item.id);
      return storeAndPersist(
        db,
        {
          sourceId,
          entityType: "bid",
          externalId: item.id,
          sourceUrl: bidPageUrl(baseUrl, item.id),
          fetchMethod: "html_detail",
          payload,
          runId,
        },
        (rawRecordId) => persistBid(db, sourceId, rawRecordId, normalizeSigerBid(payload, { baseUrl })),
      );
    },

    async markMissing(sourceId, seenIds) {
      if (seenIds.length === 0) return 0;
      const fromSource = eq(bids.sourceId, sourceId);

      await db
        .update(bids)
        .set({ sourceMissingSince: null })
        .where(and(fromSource, isNotNull(bids.sourceMissingSince), inArray(bids.externalId, seenIds)));
      const gone = await db
        .update(bids)
        .set({ sourceMissingSince: today })
        .where(and(fromSource, isNull(bids.sourceMissingSince), notInArray(bids.externalId, seenIds)))
        .returning({ id: bids.id });
      return gone.length;
    },

    afterImport: (sourceId) => linkSigerEntities(db, sourceId),
  });
}
