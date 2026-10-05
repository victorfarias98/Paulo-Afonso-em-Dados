import { agencies, bids, contracts, publicWorks, sources, suppliers } from "@pad/database/schema";
import { and, asc, count, eq, ilike, isNotNull, or, type SQL, sql } from "drizzle-orm";

import type { BidFilters, BidSort } from "./bid-filters";
import { getDb } from "./db";
import { likePattern, listVersions, UUID } from "./provenance";

export const BIDS_PAGE_SIZE = 20;

/** A Câmara não publica a data de publicação, só a da licitação; usa-se a que existir. */
const bidDate = sql`coalesce(${bids.publishedAt}, ${bids.openingDate})`;

const ORDER_BY: Record<BidSort, SQL> = {
  recentes: sql`${bidDate} desc nulls last`,
  maior_valor: sql`${bids.estimatedValue} desc nulls last`,
};

const publishedYear = sql<number>`extract(year from ${bidDate})::int`;
const OWNER_BRANCH = { prefeitura: "executivo", camara: "legislativo" } as const;

function buildWhere(filters: BidFilters): SQL | undefined {
  const pattern = filters.q ? likePattern(filters.q) : undefined;
  return and(
    filters.status ? eq(bids.status, filters.status) : undefined,
    filters.modality ? eq(bids.modality, filters.modality) : undefined,
    filters.year !== undefined ? sql`${publishedYear} = ${filters.year}` : undefined,
    filters.owner
      ? sql`${bids.agencyId} in (select id from agencies where branch = ${OWNER_BRANCH[filters.owner]})`
      : undefined,
    pattern ? or(ilike(bids.description, pattern), ilike(bids.number, pattern)) : undefined,
  );
}

export async function listBids(filters: BidFilters) {
  const db = getDb();
  const where = buildWhere(filters);

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: bids.id,
        number: bids.number,
        modality: bids.modality,
        description: bids.description,
        estimatedValue: bids.estimatedValue,
        publishedAt: bids.publishedAt,
        sourceStatus: bids.sourceStatus,
        agencyName: agencies.name,
      })
      .from(bids)
      .leftJoin(agencies, eq(agencies.id, bids.agencyId))
      .where(where)
      .orderBy(ORDER_BY[filters.sort], asc(bids.id))
      .limit(BIDS_PAGE_SIZE)
      .offset((filters.page - 1) * BIDS_PAGE_SIZE),
    db.select({ total: count() }).from(bids).where(where),
  ]);

  return { rows, total: totals?.total ?? 0 };
}

export type BidListRow = Awaited<ReturnType<typeof listBids>>["rows"][number];

/** Valores existentes para os filtros, lidos do que a fonte publicou. */
export async function listBidFacets() {
  const db = getDb();
  const [statuses, modalities, years] = await Promise.all([
    db
      .selectDistinct({ key: bids.status, label: bids.sourceStatus })
      .from(bids)
      .where(isNotNull(bids.sourceStatus))
      .orderBy(asc(bids.sourceStatus)),
    db
      .selectDistinct({ modality: bids.modality })
      .from(bids)
      .where(isNotNull(bids.modality))
      .orderBy(asc(bids.modality)),
    db
      .selectDistinct({ year: publishedYear })
      .from(bids)
      .where(sql`${bidDate} is not null`)
      .orderBy(sql`1 desc`),
  ]);

  return {
    statuses: statuses.flatMap((row) => (row.label ? [{ key: row.key, label: row.label }] : [])),
    modalities: modalities.flatMap((row) => (row.modality ? [row.modality] : [])),
    years: years.map((row) => row.year),
  };
}

/** Licitação com órgão, contratos e obras ligados e a origem do dado. Null se não existir. */
export async function getBid(id: string) {
  if (!UUID.test(id)) return null;
  const db = getDb();

  const [row] = await db
    .select({ bid: bids, source: sources, agencyName: agencies.name })
    .from(bids)
    .innerJoin(sources, eq(sources.id, bids.sourceId))
    .leftJoin(agencies, eq(agencies.id, bids.agencyId))
    .where(eq(bids.id, id));
  if (!row) return null;

  const [relatedContracts, relatedWorks, versions] = await Promise.all([
    db
      .select({
        id: contracts.id,
        number: contracts.number,
        originalValue: contracts.originalValue,
        status: contracts.status,
        supplierName: suppliers.legalName,
      })
      .from(contracts)
      .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
      .where(eq(contracts.bidId, id))
      .orderBy(asc(contracts.number)),
    db
      .select({ id: publicWorks.id, title: publicWorks.title, status: publicWorks.status })
      .from(publicWorks)
      .where(eq(publicWorks.bidId, id))
      .orderBy(asc(publicWorks.title)),
    listVersions("bid", id),
  ]);

  return { ...row, contracts: relatedContracts, works: relatedWorks, versions };
}

export type BidDetail = NonNullable<Awaited<ReturnType<typeof getBid>>>;
