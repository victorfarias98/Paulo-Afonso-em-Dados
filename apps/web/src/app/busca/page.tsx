import { AnalyticsResults } from "@/components/analytics-results";
import type { Metadata } from "next";
import Link from "next/link";

import type { RawSearchParams } from "@/lib/contract-filters";
import { type SearchHit, searchEverything } from "@/lib/overview";

export const metadata: Metadata = {
  title: "Busca",
  robots: { index: false, follow: true },
};

const MIN_LENGTH = 3;
const MAX_LENGTH = 100;

function Group({ title, base, hits }: { title: string; base: string; hits: SearchHit[] }) {
  if (hits.length === 0) return null;

  return (
    <section className="mt-10 max-w-4xl">
      <h2 className="border-b-2 border-tinta pb-2 font-display text-2xl font-semibold">{title}</h2>
      <ul>
        {hits.map((hit) => (
          <li key={hit.id} className="border-b border-linha py-3">
            <Link href={`${base}/${hit.id}`} className="font-medium hover:text-azul hover:underline">
              {hit.title}
            </Link>
            {hit.detail && <p className="line-clamp-2 text-sm text-suave">{hit.detail}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, MAX_LENGTH) ?? "";
  const results = query.length >= MIN_LENGTH ? await searchEverything(query) : null;
  const isEmpty = results !== null && Object.values(results).every((hits) => hits.length === 0);

  return (
    <>
      {results !== null && (
        <AnalyticsResults
          section="busca"
          query={query}
          count={Object.values(results).reduce((sum, hits) => sum + hits.length, 0)}
          categories={[
            ...(results.suppliers.length > 0 ? ["Empresas"] : []),
            ...(results.works.length > 0 ? ["Obras"] : []),
            ...(results.contracts.length > 0 ? ["Contratos"] : []),
            ...(results.bids.length > 0 ? ["Licitações"] : []),
          ]}
        />
      )}
      <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">Busca</h1>

      <form method="get" action="/busca" role="search" className="mt-6 flex max-w-2xl gap-3">
        <label className="flex-1">
          <span className="sr-only">Pesquise uma obra, empresa, contrato ou licitação</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            minLength={MIN_LENGTH}
            maxLength={MAX_LENGTH}
            placeholder="Pesquise uma obra, empresa, contrato ou licitação"
            className="campo"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-azul px-5 py-2.5 font-semibold text-fundo hover:bg-azul-forte"
        >
          Buscar
        </button>
      </form>

      {results === null && (
        <p className="mt-8 text-suave">Digite pelo menos {MIN_LENGTH} letras para buscar.</p>
      )}
      {isEmpty && (
        <p className="mt-8 max-w-prose text-suave">
          Nada encontrado para “{query}”. A busca cobre só o que já foi importado para o portal.
        </p>
      )}
      {results && (
        <>
          <Group title="Empresas" base="/fornecedores" hits={results.suppliers} />
          <Group title="Obras" base="/obras" hits={results.works} />
          <Group title="Contratos" base="/contratos" hits={results.contracts} />
          <Group title="Licitações" base="/licitacoes" hits={results.bids} />
        </>
      )}
    </>
  );
}
