import {
  contracts,
  documents,
  publicWorkAddresses,
  publicWorks,
  sources,
  suppliers,
} from "@pad/database/schema";
import { and, asc, count, eq, ilike, isNotNull, or, type SQL, sql } from "drizzle-orm";

import { getDb } from "./db";
import { likePattern, listVersions, UUID } from "./provenance";
import type { WorkFilters, WorkSort } from "./work-filters";

export const WORKS_PAGE_SIZE = 20;

const ORDER_BY: Record<WorkSort, SQL> = {
  recentes: sql`${publicWorks.startDate} desc nulls last`,
  maior_valor: sql`${publicWorks.initialValue} desc nulls last`,
  prazo: sql`${publicWorks.expectedEndDate} asc nulls last`,
};

/** Bairro do primeiro endereço de cada obra, para exibir na lista. */
const firstNeighborhood = sql<string | null>`(
  select a.neighborhood from public_work_addresses a
   where a.public_work_id = ${publicWorks.id} order by a.position limit 1
)`;

function buildWhere(filters: WorkFilters): SQL | undefined {
  const pattern = filters.q ? likePattern(filters.q) : undefined;
  return and(
    filters.status ? eq(publicWorks.status, filters.status) : undefined,
    filters.neighborhood
      ? sql`exists (select 1 from public_work_addresses a
                     where a.public_work_id = ${publicWorks.id}
                       and a.neighborhood = ${filters.neighborhood})`
      : undefined,
    pattern
      ? or(
          ilike(publicWorks.title, pattern),
          ilike(publicWorks.description, pattern),
          ilike(suppliers.legalName, pattern),
        )
      : undefined,
  );
}

export async function listWorks(filters: WorkFilters) {
  const db = getDb();
  const where = buildWhere(filters);

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: publicWorks.id,
        title: publicWorks.title,
        initialValue: publicWorks.initialValue,
        startDate: publicWorks.startDate,
        expectedEndDate: publicWorks.expectedEndDate,
        status: publicWorks.status,
        neighborhood: firstNeighborhood,
        supplierName: suppliers.legalName,
      })
      .from(publicWorks)
      .leftJoin(contracts, eq(contracts.id, publicWorks.contractId))
      .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
      .where(where)
      .orderBy(ORDER_BY[filters.sort], asc(publicWorks.id))
      .limit(WORKS_PAGE_SIZE)
      .offset((filters.page - 1) * WORKS_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(publicWorks)
      .leftJoin(contracts, eq(contracts.id, publicWorks.contractId))
      .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
      .where(where),
  ]);

  return { rows, total: totals?.total ?? 0 };
}

export type WorkListRow = Awaited<ReturnType<typeof listWorks>>["rows"][number];

export async function listWorkNeighborhoods(): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ neighborhood: publicWorkAddresses.neighborhood })
    .from(publicWorkAddresses)
    .where(isNotNull(publicWorkAddresses.neighborhood))
    .orderBy(asc(publicWorkAddresses.neighborhood));
  return rows.flatMap((row) => (row.neighborhood ? [row.neighborhood] : []));
}

/** Obra com endereços, anexos, contrato ligado e a origem do dado. Null se não existir. */
export async function getWork(id: string) {
  if (!UUID.test(id)) return null;
  const db = getDb();

  const [row] = await db
    .select({
      work: publicWorks,
      source: sources,
      contractNumber: contracts.number,
      supplierName: suppliers.legalName,
    })
    .from(publicWorks)
    .innerJoin(sources, eq(sources.id, publicWorks.sourceId))
    .leftJoin(contracts, eq(contracts.id, publicWorks.contractId))
    .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
    .where(eq(publicWorks.id, id));
  if (!row) return null;

  const [addresses, attachments, versions] = await Promise.all([
    db
      .select()
      .from(publicWorkAddresses)
      .where(eq(publicWorkAddresses.publicWorkId, id))
      .orderBy(asc(publicWorkAddresses.position)),
    db
      .select({ title: documents.title, sourceUrl: documents.sourceUrl })
      .from(documents)
      .where(and(eq(documents.entityType, "public_work"), eq(documents.entityId, id)))
      .orderBy(asc(documents.title)),
    listVersions("public_work", id),
  ]);

  return { ...row, addresses, attachments, versions };
}

export type WorkDetail = NonNullable<Awaited<ReturnType<typeof getWork>>>;

/** Obras ligadas a um contrato, para a página do contrato. */
export function listWorksOfContract(contractId: string) {
  return getDb()
    .select({ id: publicWorks.id, title: publicWorks.title, status: publicWorks.status })
    .from(publicWorks)
    .where(eq(publicWorks.contractId, contractId))
    .orderBy(asc(publicWorks.title));
}

/** Quantas obras há em cada situação, para os atalhos da lista. */
export async function countWorksByStatus(): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ status: publicWorks.status, total: count() })
    .from(publicWorks)
    .groupBy(publicWorks.status);
  return Object.fromEntries(rows.map((row) => [row.status, row.total]));
}
