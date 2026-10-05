import { AnalyticsResults } from "@/components/analytics-results";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, optionsFrom, QuickFilters, yearOptions } from "@/components/filter-bar";
import { StatusBadge } from "@/components/status-badge";
import {
  type ContractFilters,
  filtersToQuery,
  KIND_LABELS,
  parseContractFilters,
  type RawSearchParams,
  SORT_LABELS,
  STATUS_LABELS,
} from "@/lib/contract-filters";
import { type ContractListRow, countContractsByStatus, listContracts, listContractYears, PAGE_SIZE } from "@/lib/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { plainName } from "@/lib/plain";
import { Explica } from "@/components/explica";

export const metadata: Metadata = {
  title: "Contratos",
  description:
    "Contratos e atas de registro de preços da Prefeitura de Paulo Afonso: objeto, fornecedor, valor, vigência e fonte oficial.",
};

function Filters({ filters, years }: { filters: ContractFilters; years: number[] }) {
  return (
    <FilterBar
      action="/contratos"
      fields={[
        { kind: "search", name: "q", label: "Buscar por objeto, número ou empresa", value: filters.q },
        {
          kind: "select",
          name: "situacao",
          label: "Situação",
          value: filters.status,
          allLabel: "Todas",
          options: optionsFrom(STATUS_LABELS),
        },
        {
          kind: "select",
          name: "tipo",
          label: "Tipo",
          value: filters.kind,
          allLabel: "Todos",
          options: optionsFrom(KIND_LABELS),
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
          name: "ordem",
          label: "Ordenar por",
          value: filters.sort,
          defaultValue: "recentes",
          options: optionsFrom(SORT_LABELS),
        },
      ]}
    />
  );
}

function ContractRow({ row }: { row: ContractListRow }) {
  return (
    <li className="grid gap-x-6 gap-y-2 border-b border-linha py-5 md:grid-cols-[minmax(0,1fr)_11rem_10rem] md:items-start">
      <div>
        <p className="text-sm text-suave">
          {KIND_LABELS[row.kind]} {row.number}
        </p>
        <h2 className="mt-0.5 text-lg leading-snug font-semibold">
          <Link href={`/contratos/${row.id}`} className="hover:text-azul hover:underline">
            <span className="line-clamp-2">{row.description ? row.description : "A fonte não diz para que é"}</span>
          </Link>
        </h2>
        <p className="mt-1 text-suave">
          {row.supplierName ? plainName(row.supplierName) : "Empresa não informada"}
          {row.agencyName && <span className="block text-sm">{plainName(row.agencyName)}</span>}
        </p>
      </div>
      <div className="flex items-center gap-3 md:block">
        <StatusBadge status={row.status} />
        <p className="text-sm text-suave md:mt-1.5">até {formatDate(row.endsAt)}</p>
      </div>
      <p className="text-xl md:text-right">
        <span className={row.originalValue === null ? "text-suave" : "valor"}>
          {formatMoney(row.originalValue)}
        </span>
      </p>
    </li>
  );
}

function Pagination({ filters, total }: { filters: ContractFilters; total: number }) {
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (lastPage === 1) return null;
  const href = (page: number): string => `/contratos${filtersToQuery({ ...filters, page })}`;

  return (
    <nav aria-label="Páginas" className="mt-8 flex items-center justify-between gap-4">
      {filters.page > 1 ? (
        <Link href={href(filters.page - 1)} rel="prev" className="link font-medium">
          Página anterior
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-suave">
        Página {filters.page} de {lastPage}
      </p>
      {filters.page < lastPage ? (
        <Link href={href(filters.page + 1)} rel="next" className="link font-medium">
          Próxima página
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseContractFilters(await searchParams);
  const [{ rows, total }, years, byStatus] = await Promise.all([
    listContracts(filters),
    listContractYears(),
    countContractsByStatus(),
  ]);
  const all = Object.values(byStatus).reduce((sum, value) => sum + value, 0);
  const shortcut = (status?: ContractFilters["status"]) => {
    const { status: _current, ...rest } = filters;
    return `/contratos${filtersToQuery({ ...rest, ...(status && { status }), page: 1 })}`;
  };

  return (
    <>
      <AnalyticsResults section="contratos" query={filters.q} count={total} />
      <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
        Contratos
      </h1>
      <p className="mt-4 max-w-prose text-suave sm:text-lg">
        Contratos e atas de registro de preços da Prefeitura e contratos da Câmara Municipal de
        Paulo Afonso. A carga dos contratos da Prefeitura está em andamento: nem todos os
        publicados já aparecem aqui.
      </p>

      <Explica termo="ata" rotulo="O que é uma “lista de preços (ata)”?" />
      <QuickFilters
        label="Situação dos contratos"
        items={[
          { label: "Todos", href: shortcut(), count: all, isCurrent: !filters.status },
          ...(["vigente", "vigencia_encerrada"] as const).map((status) => ({
            label: STATUS_LABELS[status],
            href: shortcut(status),
            count: byStatus[status] ?? 0,
            isCurrent: filters.status === status,
          })),
        ]}
      />
      <Filters filters={filters} years={years} />

      <p className="mt-10 border-b-2 border-tinta pb-2 font-medium" aria-live="polite">
        {total === 1 ? "1 contrato encontrado" : `${total.toLocaleString("pt-BR")} contratos encontrados`}
      </p>

      {rows.length === 0 ? (
        <p className="py-10 text-suave">
          Nenhum contrato corresponde a esses filtros.{" "}
          <Link href="/contratos" className="link">
            Ver todos os contratos
          </Link>
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <ContractRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <Pagination filters={filters} total={total} />
    </>
  );
}
