import { agencies, payments, suppliers } from "@pad/database/schema";
import { and, desc, eq, isNotNull, isNull, type SQL, sql } from "drizzle-orm";

import { getDb } from "./db";
import {
  BRANCHES,
  type ExpenseBranch,
  type ExpenseFilters,
  type ExpensePhaseKey,
} from "./expense-filters";
import { likePattern } from "./provenance";

export const EXPENSES_PAGE_SIZE = 50;
const TOP_LIMIT = 10;

/**
 * Tabela e colunas equivalentes de cada fase. Os nomes vêm deste mapa fixo e
 * nunca do visitante; os valores de filtro entram sempre como parâmetros.
 */
const PHASES: Record<ExpensePhaseKey, { table: string; date: string; net: SQL }> = {
  empenho: {
    table: "commitments",
    date: "commitment_date",
    // Empenho líquido: valor inicial mais reforços, menos anulações.
    net: sql`(coalesce(e.committed_value, 0) + coalesce(e.reinforced_value, 0) - coalesce(e.cancelled_value, 0))`,
  },
  liquidacao: {
    table: "liquidations",
    date: "liquidation_date",
    net: sql`(coalesce(e.value, 0) - coalesce(e.cancelled_value, 0))`,
  },
  pagamento: {
    table: "payments",
    date: "payment_date",
    net: sql`(coalesce(e.value, 0) - coalesce(e.cancelled_value, 0))`,
  },
};

export interface Total {
  total: string;
  count: number;
}

export interface ExpenseListRow {
  id: string;
  externalId: string;
  number: string | null;
  date: string | null;
  value: string | null;
  description: string | null;
  expenseElement: string | null;
  legalBasis: string | null;
  bidReference: string | null;
  commitmentNumber: string | null;
  sourceUrl: string | null;
  contractId: string | null;
  agencyName: string | null;
  supplierName: string | null;
}

export interface PaymentObjectRow {
  id: string;
  date: string | null;
  value: string;
  supplierName: string | null;
  agencyName: string | null;
  description: string | null;
  expenseElement: string | null;
  contractId: string | null;
}

export interface MonthlySignal {
  month: number;
  total: string;
  previousTotal: string | null;
  change: string | null;
}

export interface SpendingIntelligence {
  topSupplierShare: number | null;
  topSupplierName: string | null;
  monthlySignal: MonthlySignal | null;
  largestPayments: PaymentObjectRow[];
}

/** Pagamento líquido: valor pago menos anulações. */
const paidNet = sql`(coalesce(${payments.value}, 0) - coalesce(${payments.cancelledValue}, 0))`;
const paidTotal = sql<string>`coalesce(sum(${paidNet}), 0)::text`;
const byPaidDesc = sql`sum(${paidNet}) desc nulls last`;
const PAYROLL_PREFIX = "FOLHA DE PAGAMENTO%";

async function rowsOf<T>(query: SQL): Promise<T[]> {
  return (await getDb().execute(query)) as unknown as T[];
}

/** Id da fonte de despesas de um poder. O slug vem do mapa fixo, nunca do visitante. */
const sourceOf = (branch: ExpenseBranch): SQL =>
  sql`(select id from sources where slug = ${BRANCHES[branch].sourceSlug})`;

/** Registros que sumiram da fonte ficam guardados, mas não entram nas somas. */
async function sumOf(phase: ExpensePhaseKey, year: number, branch: ExpenseBranch): Promise<Total> {
  const { table, net } = PHASES[phase];
  const [row] = await rowsOf<Total>(sql`
    select coalesce(sum(${net}), 0)::text as total, count(*)::int as count
      from ${sql.identifier(table)} e
     where e.fiscal_year = ${year} and e.source_missing_since is null
       and e.source_id = ${sourceOf(branch)}
  `);
  return row ?? { total: "0", count: 0 };
}

/** Total pago por um poder no ano, para a página inicial. */
export function getPaidTotal(year: number, branch: ExpenseBranch): Promise<Total> {
  return sumOf("pagamento", year, branch);
}

/** Anos com pagamentos importados; com `branch`, só os daquele poder. */
export async function listExpenseYears(branch?: ExpenseBranch): Promise<number[]> {
  const rows = await getDb()
    .selectDistinct({ year: payments.fiscalYear })
    .from(payments)
    .where(branch ? eq(payments.sourceId, sourceOf(branch)) : undefined)
    .orderBy(desc(payments.fiscalYear));
  return rows.map((row) => row.year);
}

/** Totais do ano e as quebras exibidas em /gastos. Cada linha leva à lista que a compõe. */
export async function getSpendingOverview(year: number, branch: ExpenseBranch) {
  const db = getDb();
  const paidInYear = and(
    eq(payments.fiscalYear, year),
    isNull(payments.sourceMissingSince),
    eq(payments.sourceId, sourceOf(branch)),
  );
  const month = sql<number>`extract(month from ${payments.paymentDate})::int`;

  const [
    committed,
    liquidated,
    paid,
    byAgency,
    byMonth,
    topSuppliers,
    byElement,
    linkedToContracts,
    largestPayments,
  ] = await Promise.all([
    sumOf("empenho", year, branch),
    sumOf("liquidacao", year, branch),
    sumOf("pagamento", year, branch),
    db
      .select({ id: agencies.id, name: agencies.name, total: paidTotal })
      .from(payments)
      .innerJoin(agencies, eq(agencies.id, payments.agencyId))
      .where(paidInYear)
      .groupBy(agencies.id, agencies.name)
      .orderBy(byPaidDesc),
    db
      .select({ month, total: paidTotal })
      .from(payments)
      .where(paidInYear)
      .groupBy(month)
      .orderBy(month),
    // Somente empresas: pessoas físicas não entram em lista de maiores recebedores.
    db
      .select({ id: suppliers.id, name: suppliers.legalName, total: paidTotal })
      .from(payments)
      .innerJoin(suppliers, eq(suppliers.id, payments.supplierId))
      .where(and(paidInYear, eq(suppliers.documentType, "cnpj")))
      .groupBy(suppliers.id, suppliers.legalName)
      .orderBy(byPaidDesc)
      .limit(TOP_LIMIT),
    db
      .select({ element: payments.expenseElement, total: paidTotal })
      .from(payments)
      .where(paidInYear)
      .groupBy(payments.expenseElement)
      .orderBy(byPaidDesc)
      .limit(TOP_LIMIT),
    db
      .select({ total: paidTotal, count: sql<number>`count(*)::int` })
      .from(payments)
      .where(and(paidInYear, isNotNull(payments.contractId))),
    db
      .select({
        id: payments.id,
        date: sql<string>`to_char(${payments.paymentDate}, 'YYYY-MM-DD')`,
        value: sql<string>`${paidNet}::text`,
        supplierName: suppliers.legalName,
        agencyName: agencies.name,
        description: payments.description,
        expenseElement: payments.expenseElement,
        contractId: payments.contractId,
      })
      .from(payments)
      .innerJoin(suppliers, eq(suppliers.id, payments.supplierId))
      .leftJoin(agencies, eq(agencies.id, payments.agencyId))
      .where(
        and(
          paidInYear,
          eq(suppliers.documentType, "cnpj"),
          sql`${suppliers.legalName} not ilike ${PAYROLL_PREFIX}`,
          sql`${paidNet} > 0`,
        ),
      )
      .orderBy(sql`${paidNet} desc nulls last`, desc(payments.paymentDate), desc(payments.id))
      .limit(6),
  ]);

  return {
    committed,
    liquidated,
    paid,
    byAgency,
    byMonth,
    topSuppliers,
    byElement,
    linkedToContracts: linkedToContracts[0] ?? { total: "0", count: 0 },
    intelligence: buildSpendingIntelligence({
      paidTotal: paid.total,
      byMonth,
      topSuppliers,
      largestPayments,
    }),
  };
}

export type SpendingOverview = Awaited<ReturnType<typeof getSpendingOverview>>;

interface BuildSpendingIntelligenceInput {
  paidTotal: string;
  byMonth: Array<{ month: number; total: string }>;
  topSuppliers: Array<{ name: string; total: string }>;
  largestPayments: PaymentObjectRow[];
}

/** O mês mais relevante é o que mais mudou em valor absoluto contra o mês anterior importado. */
export function largestMonthlySignal(
  rows: Array<{ month: number; total: string }>,
): MonthlySignal | null {
  const ordered = [...rows].sort((a, b) => a.month - b.month);
  if (ordered.length === 0) return null;
  if (ordered.length === 1) {
    const only = ordered[0]!;
    return { month: only.month, total: only.total, previousTotal: null, change: null };
  }

  return (
    ordered
      .slice(1)
      .map((row, index) => {
        const previous = ordered[index]!;
        const change = Number(row.total) - Number(previous.total);
        return {
          month: row.month,
          total: row.total,
          previousTotal: previous.total,
          change: change.toFixed(2),
        };
      })
      .sort((a, b) => Math.abs(Number(b.change)) - Math.abs(Number(a.change)))[0] ?? null
  );
}

export function buildSpendingIntelligence(
  input: BuildSpendingIntelligenceInput,
): SpendingIntelligence {
  const [topSupplier] = input.topSuppliers;
  const paid = Number(input.paidTotal);

  return {
    topSupplierShare:
      topSupplier && paid > 0 ? Math.round((Number(topSupplier.total) / paid) * 1000) / 10 : null,
    topSupplierName: topSupplier?.name ?? null,
    monthlySignal: largestMonthlySignal(input.byMonth),
    largestPayments: input.largestPayments,
  };
}

function buildWhere(filters: ExpenseFilters): SQL {
  const date = sql.identifier(PHASES[filters.phase].date);
  const pattern = filters.q ? likePattern(filters.q) : undefined;
  const conditions: SQL[] = [sql`e.source_missing_since is null`];

  if (filters.branch) conditions.push(sql`e.source_id = ${sourceOf(filters.branch)}`);
  if (filters.year !== undefined) conditions.push(sql`e.fiscal_year = ${filters.year}`);
  if (filters.month !== undefined) {
    conditions.push(sql`extract(month from e.${date}) = ${filters.month}`);
  }
  if (filters.agencyId) conditions.push(sql`e.agency_id = ${filters.agencyId}`);
  if (filters.supplierId) conditions.push(sql`e.supplier_id = ${filters.supplierId}`);
  if (pattern) {
    conditions.push(
      sql`(s.legal_name ilike ${pattern} or e.description ilike ${pattern} or e.expense_element ilike ${pattern})`,
    );
  }
  return sql.join(conditions, sql` and `);
}

/** Lista paginada de uma fase da despesa, com a soma de tudo que o filtro seleciona. */
export async function listExpenses(filters: ExpenseFilters) {
  const { table, date, net } = PHASES[filters.phase];
  const from = sql`
    from ${sql.identifier(table)} e
    left join agencies a on a.id = e.agency_id
    left join suppliers s on s.id = e.supplier_id
    where ${buildWhere(filters)}
  `;
  const dateColumn = sql.identifier(date);

  const [rows, [totals]] = await Promise.all([
    rowsOf<ExpenseListRow>(sql`
      select e.id, e.external_id as "externalId", e.number, to_char(e.${dateColumn}, 'YYYY-MM-DD') as date,
             ${net}::text as value, e.description, e.expense_element as "expenseElement",
             e.legal_basis as "legalBasis", e.bid_reference as "bidReference",
             e.commitment_number as "commitmentNumber", e.source_url as "sourceUrl",
             e.contract_id as "contractId", a.name as "agencyName", s.legal_name as "supplierName"
      ${from}
      order by e.${dateColumn} desc nulls last, e.id
      limit ${EXPENSES_PAGE_SIZE} offset ${(filters.page - 1) * EXPENSES_PAGE_SIZE}
    `),
    rowsOf<Total>(sql`
      select coalesce(sum(${net}), 0)::text as total, count(*)::int as count ${from}
    `),
  ]);

  return { rows, count: totals?.count ?? 0, total: totals?.total ?? "0" };
}

/** Nomes para o cabeçalho da lista quando ela está filtrada por órgão ou fornecedor. */
export async function getFilterNames(filters: ExpenseFilters) {
  const db = getDb();
  const [agency, supplier] = await Promise.all([
    filters.agencyId
      ? db.select({ name: agencies.name }).from(agencies).where(eq(agencies.id, filters.agencyId))
      : [],
    filters.supplierId
      ? db
          .select({ name: suppliers.legalName })
          .from(suppliers)
          .where(eq(suppliers.id, filters.supplierId))
      : [],
  ]);
  return { agencyName: agency[0]?.name ?? null, supplierName: supplier[0]?.name ?? null };
}

/** Total pago ligado a um contrato, para a página do contrato. */
export async function getPaidForContract(contractId: string): Promise<Total> {
  const [row] = await getDb()
    .select({ total: paidTotal, count: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(eq(payments.contractId, contractId), isNull(payments.sourceMissingSince)));
  return row ?? { total: "0", count: 0 };
}
