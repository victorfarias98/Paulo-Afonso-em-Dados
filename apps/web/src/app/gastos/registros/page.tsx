import { AnalyticsResults } from "@/components/analytics-results";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, optionsFrom, yearOptions } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import type { RawSearchParams } from "@/lib/contract-filters";
import {
  type ExpenseFilters,
  BRANCHES,
  expenseFiltersToQuery,
  MONTH_NAMES,
  parseExpenseFilters,
  PHASE_LABELS,
} from "@/lib/expense-filters";
import {
  type ExpenseListRow,
  EXPENSES_PAGE_SIZE,
  getFilterNames,
  listExpenses,
  listExpenseYears,
} from "@/lib/expenses";
import { formatDate, formatMoney } from "@/lib/format";
import { plainName } from "@/lib/plain";

export const metadata: Metadata = {
  title: "Registros de despesa",
  description:
    "Empenhos, liquidações e pagamentos da Prefeitura e da Câmara de Paulo Afonso, registro por registro, com filtros por mês, órgão e fornecedor.",
  // Listas filtradas geram combinações demais; a página indexável é /gastos.
  robots: { index: false, follow: true },
};

function Filters({
  filters,
  years,
  names,
}: {
  filters: ExpenseFilters;
  years: number[];
  names: { agencyName: string | null; supplierName: string | null };
}) {
  return (
    <FilterBar
      action="/gastos/registros"
      fields={[
        {
          kind: "search",
          name: "q",
          label: "Buscar por quem recebeu ou pelo motivo",
          value: filters.q,
        },
        {
          kind: "select",
          name: "fase",
          label: "O que mostrar",
          value: filters.phase,
          defaultValue: filters.phase,
          keep: true,
          options: optionsFrom(PHASE_LABELS),
        },
        {
          kind: "select",
          name: "poder",
          label: "De quem",
          value: filters.branch,
          allLabel: "Prefeitura e Câmara",
          options: [
            { value: "prefeitura", label: BRANCHES.prefeitura.name },
            { value: "camara", label: BRANCHES.camara.name },
          ],
        },
        {
          kind: "select",
          name: "ano",
          label: "Ano",
          value: filters.year?.toString(),
          allLabel: "Todos",
          options: yearOptions(years),
        },
        {
          kind: "select",
          name: "mes",
          label: "Mês",
          value: filters.month?.toString(),
          allLabel: "Todos",
          options: MONTH_NAMES.map((name, index) => ({ value: String(index + 1), label: name })),
        },
        {
          kind: "context",
          name: "orgao",
          label: "Secretaria",
          value: filters.agencyId,
          display: names.agencyName,
        },
        {
          kind: "context",
          name: "fornecedor",
          label: "Quem recebeu",
          value: filters.supplierId,
          display: names.supplierName,
        },
      ]}
    />
  );
}

function ExpenseRow({ row }: { row: ExpenseListRow }) {
  return (
    <li className="grid gap-x-6 gap-y-1 border-b border-linha py-4 md:grid-cols-[6.5rem_minmax(0,1fr)_10rem]">
      <p className="text-suave tabular-nums">{formatDate(row.date)}</p>
      <div>
        <p className="font-semibold">
          {row.supplierName ? plainName(row.supplierName) : "Recebedor não informado"}
        </p>
        <p className="text-sm text-suave">
          {row.agencyName ? plainName(row.agencyName) : "Secretaria não informada"}
          {row.expenseElement && <span className="block">{row.expenseElement}</span>}
        </p>
        {row.description && <p className="mt-1 line-clamp-2 text-sm">{row.description}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={
              row.contractId ? "bg-azul px-2 py-1 text-white" : "bg-superficie px-2 py-1 text-suave"
            }
          >
            {row.contractId ? "Contrato identificado" : "Contrato ainda não ligado"}
          </span>
          {row.contractId && (
            <Link href={`/contratos/${row.contractId}`} className="link">
              Abrir contrato
            </Link>
          )}
        </p>
        <details className="mt-3 border-t border-linha pt-2 text-sm">
          <summary className="cursor-pointer font-medium text-azul-forte">
            Entender este registro
          </summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-suave">O que a fonte descreve</dt>
              <dd>{row.description ?? "Não informado"}</dd>
            </div>
            <div>
              <dt className="text-suave">Tipo de gasto</dt>
              <dd>{row.expenseElement ?? "Não informado"}</dd>
            </div>
            <div>
              <dt className="text-suave">Empenho de origem</dt>
              <dd>{row.commitmentNumber ?? row.number ?? "Este vínculo não foi informado"}</dd>
            </div>
            <div>
              <dt className="text-suave">Licitação, dispensa ou inexigibilidade</dt>
              <dd>{row.bidReference ?? "Não informada"}</dd>
            </div>
            <div>
              <dt className="text-suave">Base legal</dt>
              <dd>{row.legalBasis ?? "Não informada"}</dd>
            </div>
            <div>
              <dt className="text-suave">Identificador na fonte</dt>
              <dd>{row.externalId}</dd>
            </div>
          </dl>
          {row.sourceUrl ? (
            <a href={row.sourceUrl} rel="noopener noreferrer" className="link mt-3 inline-block">
              Conferir na fonte oficial
            </a>
          ) : (
            <p className="mt-3 text-suave">Fonte oficial registrada sem URL direta.</p>
          )}
        </details>
      </div>
      <p className="font-display text-lg font-semibold tabular-nums md:text-right">
        {formatMoney(row.value)}
      </p>
    </li>
  );
}

export default async function ExpenseRecordsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseExpenseFilters(await searchParams);
  const [{ rows, count, total }, years, names] = await Promise.all([
    listExpenses(filters),
    listExpenseYears(filters.branch),
    getFilterNames(filters),
  ]);

  return (
    <>
      <AnalyticsResults section="gastos" query={filters.q} count={count} />
      <p>
        <Link
          href={filters.branch === "camara" ? "/gastos?poder=camara" : "/gastos"}
          className="link"
        >
          Gastos {filters.branch ? BRANCHES[filters.branch].of : "da Prefeitura e da Câmara"}
        </Link>
      </p>
      <h1 className="mt-6 font-display text-4xl font-medium tracking-tight sm:text-5xl">
        {PHASE_LABELS[filters.phase]}
        {filters.branch ? ` ${BRANCHES[filters.branch].of}` : ""}
      </h1>
      {!filters.branch && (
        <p className="mt-3 max-w-prose text-suave">
          Esta lista reúne registros da Prefeitura e da Câmara; o órgão de cada um aparece na linha.
        </p>
      )}
      {names.agencyName && <p className="mt-3 text-xl">{names.agencyName}</p>}
      {names.supplierName && <p className="mt-3 text-xl">{names.supplierName}</p>}

      <Filters filters={filters} years={years} names={names} />

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b-2 border-tinta pb-2">
        <p className="font-medium" aria-live="polite">
          {count === 1 ? "1 registro" : `${count.toLocaleString("pt-BR")} registros`}
        </p>
        <p>
          Soma destes registros: <span className="valor text-xl">{formatMoney(total)}</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-suave">Nenhum registro corresponde a esses filtros.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <ExpenseRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <Pagination
        page={filters.page}
        total={count}
        pageSize={EXPENSES_PAGE_SIZE}
        hrefFor={(page) => `/gastos/registros${expenseFiltersToQuery({ ...filters, page })}`}
      />

      <p className="mt-12 max-w-prose text-sm text-suave">
        Fonte: páginas de despesas{" "}
        {(filters.branch ? [filters.branch] : (["prefeitura", "camara"] as const)).map(
          (branch, index) => (
            <span key={branch}>
              {index > 0 && " e "}
              <a href={BRANCHES[branch].sourceUrl} rel="noopener noreferrer" className="link">
                {BRANCHES[branch].of}
              </a>
            </span>
          ),
        )}{" "}
        no Município Online. Para conferir um registro, escolha lá a mesma etapa, ano e mês.
        Vínculos com contratos são feitos por nós quando a licitação e quem recebeu apontam para um
        único contrato.
      </p>
    </>
  );
}
