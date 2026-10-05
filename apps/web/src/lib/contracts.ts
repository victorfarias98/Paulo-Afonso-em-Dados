import {
  agencies,
  contractAgencies,
  contractBudgetLines,
  contracts,
  sources,
  suppliers,
} from "@pad/database/schema";
import { and, asc, count, desc, eq, ilike, isNotNull, or, type SQL, sql } from "drizzle-orm";

import type { ContractFilters, ContractSort } from "./contract-filters";
import { getDb } from "./db";
import { likePattern, listVersions, UUID } from "./provenance";

export const PAGE_SIZE = 20;

const ORDER_BY: Record<ContractSort, SQL[]> = {
  recentes: [sql`${contracts.signedAt} desc nulls last`, desc(contracts.createdAt)],
  maior_valor: [sql`${contracts.originalValue} desc nulls last`],
  menor_valor: [sql`${contracts.originalValue} asc nulls last`],
  vencimento: [sql`${contracts.endsAt} asc nulls last`],
};

function buildWhere(filters: ContractFilters): SQL | undefined {
  const pattern = filters.q ? likePattern(filters.q) : undefined;
  return and(
    filters.status ? eq(contracts.status, filters.status) : undefined,
    filters.kind ? eq(contracts.kind, filters.kind) : undefined,
    filters.year !== undefined ? eq(contracts.fiscalYear, filters.year) : undefined,
    pattern
      ? or(
          ilike(contracts.description, pattern),
          ilike(contracts.number, pattern),
          ilike(suppliers.legalName, pattern),
        )
      : undefined,
  );
}

export async function listContracts(filters: ContractFilters) {
  const db = getDb();
  const where = buildWhere(filters);

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: contracts.id,
        number: contracts.number,
        kind: contracts.kind,
        description: contracts.description,
        originalValue: contracts.originalValue,
        endsAt: contracts.endsAt,
        status: contracts.status,
        supplierName: suppliers.legalName,
        agencyName: agencies.name,
      })
      .from(contracts)
      .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
      .leftJoin(agencies, eq(agencies.id, contracts.agencyId))
      .where(where)
      .orderBy(...ORDER_BY[filters.sort], asc(contracts.id))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(contracts)
      .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
      .where(where),
  ]);

  return { rows, total: totals?.total ?? 0 };
}

export type ContractListRow = Awaited<ReturnType<typeof listContracts>>["rows"][number];

export async function listContractYears(): Promise<number[]> {
  const rows = await getDb()
    .selectDistinct({ year: contracts.fiscalYear })
    .from(contracts)
    .where(isNotNull(contracts.fiscalYear))
    .orderBy(desc(contracts.fiscalYear));
  return rows.flatMap((row) => (row.year === null ? [] : [row.year]));
}

/** Contrato com fornecedor, secretarias, dotações e a origem do dado. Null se não existir. */
export async function getContract(id: string) {
  if (!UUID.test(id)) return null;
  const db = getDb();

  const [contract] = await db
    .select({ contract: contracts, supplier: suppliers, source: sources })
    .from(contracts)
    .innerJoin(sources, eq(sources.id, contracts.sourceId))
    .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
    .where(eq(contracts.id, id));
  if (!contract) return null;

  const [agencyRows, budgetRows, versions] = await Promise.all([
    db
      .select({ id: agencies.id, name: agencies.name })
      .from(contractAgencies)
      .innerJoin(agencies, eq(agencies.id, contractAgencies.agencyId))
      .where(eq(contractAgencies.contractId, id))
      .orderBy(asc(agencies.name)),
    db
      .select({ description: contractBudgetLines.description })
      .from(contractBudgetLines)
      .where(eq(contractBudgetLines.contractId, id))
      .orderBy(asc(contractBudgetLines.position)),
    listVersions("contract", id),
  ]);

  return {
    ...contract,
    agencies: agencyRows,
    budgetLines: budgetRows.map((row) => row.description),
    versions,
  };
}

export type ContractDetail = NonNullable<Awaited<ReturnType<typeof getContract>>>;

/** Quantos contratos há em cada situação, para os atalhos da lista. */
export async function countContractsByStatus(): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ status: contracts.status, total: count() })
    .from(contracts)
    .groupBy(contracts.status);
  return Object.fromEntries(rows.map((row) => [row.status, row.total]));
}
