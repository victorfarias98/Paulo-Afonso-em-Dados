import { AnalyticsResults } from "@/components/analytics-results";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, optionsFrom, QuickFilters } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import type { RawSearchParams } from "@/lib/contract-filters";
import { formatDate, formatMoney } from "@/lib/format";
import {
  parseWorkFilters,
  WORK_SORT_LABELS,
  WORK_STATUS_LABELS,
  type WorkFilters,
  workFiltersToQuery,
} from "@/lib/work-filters";
import { countWorksByStatus, listWorkNeighborhoods, listWorks, type WorkListRow, WORKS_PAGE_SIZE } from "@/lib/works";
import { plainName } from "@/lib/plain";

export const metadata: Metadata = {
  title: "Obras públicas",
  description:
    "Obras da Prefeitura de Paulo Afonso: valor, bairro, empresa, início, prazo e situação, com a fonte oficial de cada dado.",
};

/** Situações oferecidas como atalho de um toque, na ordem em que mais interessam. */
const QUICK_STATUSES = ["em_andamento", "prazo_vencido", "concluida", "paralisada"] as const;

function Filters({ filters, neighborhoods }: { filters: WorkFilters; neighborhoods: string[] }) {
  return (
    <FilterBar
      action="/obras"
      fields={[
        { kind: "search", name: "q", label: "Buscar por obra ou empresa", value: filters.q },
        {
          kind: "select",
          name: "situacao",
          label: "Situação",
          value: filters.status,
          allLabel: "Todas",
          options: optionsFrom(WORK_STATUS_LABELS),
        },
        {
          kind: "select",
          name: "bairro",
          label: "Bairro ou localidade",
          value: filters.neighborhood,
          allLabel: "Todos",
          options: neighborhoods.map((name) => ({ value: name, label: name })),
        },
        {
          kind: "select",
          name: "ordem",
          label: "Ordenar por",
          value: filters.sort,
          defaultValue: "recentes",
          options: optionsFrom(WORK_SORT_LABELS),
        },
      ]}
    />
  );
}

function WorkRow({ row }: { row: WorkListRow }) {
  return (
    <li className="grid gap-x-6 gap-y-2 border-b border-linha py-5 md:grid-cols-[minmax(0,1fr)_13rem_10rem] md:items-start">
      <div>
        <h2 className="text-lg leading-snug font-semibold">
          <Link href={`/obras/${row.id}`} className="hover:text-azul hover:underline">
            {plainName(row.title)}
          </Link>
        </h2>
        <p className="mt-1 text-suave">
          {row.neighborhood ? plainName(row.neighborhood) : "Local não informado"}
          {row.supplierName && <span className="block">{plainName(row.supplierName)}</span>}
        </p>
      </div>
      <div>
        <StatusBadge status={row.status} />
        <p className="mt-1.5 text-sm text-suave">
          Início em {formatDate(row.startDate)}
          <span className="block">Prazo inicial: {formatDate(row.expectedEndDate)}</span>
        </p>
      </div>
      <p className="text-xl md:text-right">
        <span className={row.initialValue === null ? "text-suave" : "valor"}>
          {formatMoney(row.initialValue)}
        </span>
      </p>
    </li>
  );
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseWorkFilters(await searchParams);
  const [{ rows, total }, neighborhoods, byStatus] = await Promise.all([
    listWorks(filters),
    listWorkNeighborhoods(),
    countWorksByStatus(),
  ]);
  const all = Object.values(byStatus).reduce((sum, value) => sum + value, 0);
  const shortcut = (status?: WorkFilters["status"]) => {
    const { status: _current, ...rest } = filters;
    return `/obras${workFiltersToQuery({ ...rest, ...(status && { status }), page: 1 })}`;
  };

  return (
    <>
      <AnalyticsResults section="obras" query={filters.q} count={total} />
      <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">Obras públicas</h1>
      <p className="mt-4 max-w-prose text-suave sm:text-lg">
        As obras que a Prefeitura cadastrou: onde ficam, quem está fazendo, quanto custam e até
        quando deveriam ficar prontas. O prazo mostrado é o combinado no início; ele pode ter sido
        esticado depois, e a Prefeitura não avisa isso aqui.
      </p>

      <QuickFilters
        label="Situação das obras"
        items={[
          { label: "Todas", href: shortcut(), count: all, isCurrent: !filters.status },
          ...QUICK_STATUSES.filter((status) => byStatus[status]).map((status) => ({
            label: WORK_STATUS_LABELS[status],
            href: shortcut(status),
            count: byStatus[status] ?? 0,
            isCurrent: filters.status === status,
          })),
        ]}
      />
      <Filters filters={filters} neighborhoods={neighborhoods} />

      <p className="mt-10 border-b-2 border-tinta pb-2 font-medium" aria-live="polite">
        {total === 1 ? "1 obra encontrada" : `${total.toLocaleString("pt-BR")} obras encontradas`}
      </p>

      {rows.length === 0 ? (
        <p className="py-10 text-suave">
          Nenhuma obra corresponde a esses filtros.{" "}
          <Link href="/obras" className="link">
            Ver todas as obras
          </Link>
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <WorkRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <Pagination
        page={filters.page}
        total={total}
        pageSize={WORKS_PAGE_SIZE}
        hrefFor={(page) => `/obras${workFiltersToQuery({ ...filters, page })}`}
      />
    </>
  );
}
