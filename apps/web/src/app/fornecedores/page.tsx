import { AnalyticsResults } from "@/components/analytics-results";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, optionsFrom } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import type { RawSearchParams } from "@/lib/contract-filters";
import { formatDocument, formatMoney } from "@/lib/format";
import {
  parseSupplierFilters,
  SUPPLIER_SORT_LABELS,
  supplierFiltersToQuery,
} from "@/lib/supplier-filters";
import { listSuppliers, type SupplierRow, SUPPLIERS_PAGE_SIZE } from "@/lib/suppliers";
import { plainName } from "@/lib/plain";

export const metadata: Metadata = {
  title: "Quem recebe dinheiro público",
  description:
    "Empresas com contratos ou pagamentos da Prefeitura ou da Câmara de Paulo Afonso: valor contratado, valor recebido e contratos, com fonte oficial.",
};

function Row({ row }: { row: SupplierRow }) {
  return (
    <li className="grid gap-x-6 gap-y-1 border-b border-linha py-4 md:grid-cols-[minmax(0,1fr)_11rem_11rem]">
      <div>
        <h2 className="text-lg font-semibold">
          <Link href={`/fornecedores/${row.id}`} className="hover:text-azul hover:underline">
            {plainName(row.legalName)}
          </Link>
        </h2>
        <p className="text-sm text-suave">
          {formatDocument("cnpj", row.documentNumber)}
          <span className="ml-3">
            {row.contractCount === 1 ? "1 contrato" : `${row.contractCount} contratos`} importados
          </span>
        </p>
      </div>
      <p className="md:text-right">
        <span className="block text-sm text-suave">Contratado</span>
        <span className="font-display font-semibold tabular-nums">
          {formatMoney(row.contractedTotal)}
        </span>
      </p>
      <p className="md:text-right">
        <span className="block text-sm text-suave">Recebido</span>
        <span className="font-display font-semibold tabular-nums">{formatMoney(row.paidTotal)}</span>
      </p>
    </li>
  );
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseSupplierFilters(await searchParams);
  const { rows, total } = await listSuppliers(filters);

  return (
    <>
      <AnalyticsResults section="fornecedores" query={filters.q} count={total} />
      <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">Quem recebe dinheiro público</h1>
      <p className="mt-4 max-w-prose text-suave sm:text-lg">
        Empresas que aparecem em contratos ou pagamentos da Prefeitura e da Câmara já importados para o
        portal; os valores de cada empresa somam os dois.
        A lista mostra valores, não avaliações: receber mais não indica irregularidade. Pessoas
        físicas não são listadas. Entradas como “Folha de pagamento” são os salários dos
        servidores, que a Prefeitura registra como um único recebedor por secretaria.
      </p>

      <FilterBar
        action="/fornecedores"
        fields={[
          { kind: "search", name: "q", label: "Buscar por nome ou CNPJ", value: filters.q },
          {
            kind: "select",
            name: "ordem",
            label: "Ordenar por",
            value: filters.sort,
            defaultValue: "maior_pago",
            options: optionsFrom(SUPPLIER_SORT_LABELS),
          },
        ]}
      />

      <p className="mt-10 border-b-2 border-tinta pb-2 font-medium" aria-live="polite">
        {total === 1 ? "1 empresa" : `${total.toLocaleString("pt-BR")} empresas`}
      </p>

      {rows.length === 0 ? (
        <p className="py-10 text-suave">
          Nenhuma empresa encontrada.{" "}
          <Link href="/fornecedores" className="link">
            Ver todas
          </Link>
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      )}

      <Pagination
        page={filters.page}
        total={total}
        pageSize={SUPPLIERS_PAGE_SIZE}
        hrefFor={(page) => `/fornecedores${supplierFiltersToQuery({ ...filters, page })}`}
      />
    </>
  );
}
