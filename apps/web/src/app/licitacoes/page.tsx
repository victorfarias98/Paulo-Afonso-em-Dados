import { AnalyticsResults } from "@/components/analytics-results";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, optionsFrom, yearOptions } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import {
  BID_OWNER_LABELS,
  BID_SORT_LABELS,
  type BidFilters,
  bidFiltersToQuery,
  parseBidFilters,
} from "@/lib/bid-filters";
import { type BidListRow, BIDS_PAGE_SIZE, listBidFacets, listBids } from "@/lib/bids";
import type { RawSearchParams } from "@/lib/contract-filters";
import { formatDate, formatMoney } from "@/lib/format";
import { plainModality, plainName } from "@/lib/plain";
import { Explica } from "@/components/explica";

export const metadata: Metadata = {
  title: "Licitações",
  description:
    "Licitações da Prefeitura e da Câmara de Paulo Afonso: número, modalidade, objeto, órgão, valor estimado e situação, com a fonte oficial.",
};

type Facets = Awaited<ReturnType<typeof listBidFacets>>;

function Filters({ filters, facets }: { filters: BidFilters; facets: Facets }) {
  return (
    <FilterBar
      action="/licitacoes"
      fields={[
        { kind: "search", name: "q", label: "Buscar por objeto ou número", value: filters.q },
        {
          kind: "select",
          name: "poder",
          label: "De quem",
          value: filters.owner,
          allLabel: "Prefeitura e Câmara",
          options: optionsFrom(BID_OWNER_LABELS),
        },
        {
          kind: "select",
          name: "situacao",
          label: "Situação",
          value: filters.status,
          allLabel: "Todas",
          options: facets.statuses.map((status) => ({ value: status.key, label: status.label })),
        },
        {
          kind: "select",
          name: "modalidade",
          label: "Tipo de licitação",
          value: filters.modality,
          allLabel: "Todas",
          options: facets.modalities.map((modality) => ({ value: modality, label: modality })),
        },
        {
          kind: "select",
          name: "ano",
          label: "Ano",
          value: filters.year?.toString(),
          allLabel: "Todos",
          options: yearOptions(facets.years),
        },
        {
          kind: "select",
          name: "ordem",
          label: "Ordenar por",
          value: filters.sort,
          defaultValue: "recentes",
          options: optionsFrom(BID_SORT_LABELS),
        },
      ]}
    />
  );
}

function BidRow({ row }: { row: BidListRow }) {
  return (
    <li className="grid gap-x-6 gap-y-2 border-b border-linha py-5 md:grid-cols-[minmax(0,1fr)_12rem_10rem] md:items-start">
      <div>
        <p className="text-sm text-suave">
          {row.number}
          {row.modality && <span> ({plainModality(row.modality)})</span>}
        </p>
        <h2 className="mt-0.5 text-lg leading-snug font-semibold">
          <Link href={`/licitacoes/${row.id}`} className="hover:text-azul hover:underline">
            <span className="line-clamp-2">{row.description ? row.description : "A fonte não diz o que será comprado"}</span>
          </Link>
        </h2>
        <p className="mt-1 text-suave">{row.agencyName ? plainName(row.agencyName) : "Secretaria não informada"}</p>
      </div>
      <div>
        <StatusBadge status="" label={row.sourceStatus ?? "Situação não informada"} />
        <p className="mt-1.5 text-sm text-suave">Publicada em {formatDate(row.publishedAt)}</p>
      </div>
      <p className="text-xl md:text-right">
        <span className={row.estimatedValue === null ? "text-suave" : "valor"}>
          {formatMoney(row.estimatedValue)}
        </span>
      </p>
    </li>
  );
}

export default async function BidsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseBidFilters(await searchParams);
  const [{ rows, total }, facets] = await Promise.all([listBids(filters), listBidFacets()]);

  return (
    <>
      <AnalyticsResults section="licitacoes" query={filters.q} count={total} />
      <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">Licitações</h1>
      <p className="mt-4 max-w-prose text-suave sm:text-lg">
        O que a Prefeitura e a Câmara estão comprando ou contratando, e como escolhem de quem. O
        valor mostrado é quanto se esperava gastar antes da disputa; a Câmara não publica esse
        valor.
      </p>
      <Explica termo="licitacao" rotulo="O que é uma licitação?" />
      <Explica termo="dispensa" rotulo="E quando compram sem disputa?" />

      <Filters filters={filters} facets={facets} />

      <p className="mt-10 border-b-2 border-tinta pb-2 font-medium" aria-live="polite">
        {total === 1
          ? "1 licitação encontrada"
          : `${total.toLocaleString("pt-BR")} licitações encontradas`}
      </p>

      {rows.length === 0 ? (
        <p className="py-10 text-suave">
          Nenhuma licitação corresponde a esses filtros.{" "}
          <Link href="/licitacoes" className="link">
            Ver todas as licitações
          </Link>
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <BidRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <Pagination
        page={filters.page}
        total={total}
        pageSize={BIDS_PAGE_SIZE}
        hrefFor={(page) => `/licitacoes${bidFiltersToQuery({ ...filters, page })}`}
      />
    </>
  );
}
