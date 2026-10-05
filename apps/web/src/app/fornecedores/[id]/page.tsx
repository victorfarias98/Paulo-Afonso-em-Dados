import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDocument, formatMoney } from "@/lib/format";
import { getSupplier } from "@/lib/suppliers";
import { plainName } from "@/lib/plain";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const detail = await getSupplier((await params).id);
  if (!detail) return { title: "Empresa não encontrada" };

  return {
    title: detail.supplier.legalName,
    description: `Contratos e pagamentos da Prefeitura e da Câmara de Paulo Afonso para ${detail.supplier.legalName}, com fonte oficial.`,
  };
}

export default async function SupplierPage({ params }: PageProps) {
  const detail = await getSupplier((await params).id);
  if (!detail) notFound();

  const { supplier, contracts, paidByYear, agencies } = detail;

  return (
    <article>
      <p>
        <Link href="/fornecedores" className="link">
          Todos os fornecedores
        </Link>
      </p>

      <header className="mt-6 max-w-4xl">
        <h1 className="font-display text-3xl leading-tight font-medium tracking-tight sm:text-5xl">
          {plainName(supplier.legalName)}
        </h1>
        <p className="mt-2 text-suave">{formatDocument("cnpj", supplier.documentNumber)}</p>
      </header>

      <dl className="mt-10 grid max-w-4xl gap-8 border-t-2 border-tinta pt-6 sm:grid-cols-2">
        <div>
          <dt className="text-suave">Valor contratado</dt>
          <dd className="mt-1 text-3xl">
            <span className="valor">{formatMoney(supplier.contractedTotal)}</span>
          </dd>
          <dd className="mt-2 text-sm text-suave">
            Soma do valor inicial dos{" "}
            {supplier.contractCount === 1 ? "1 contrato" : `${supplier.contractCount} contratos`}{" "}
            já importados.
          </dd>
        </div>
        <div>
          <dt className="text-suave">Valor recebido</dt>
          <dd className="mt-1 text-3xl">
            <span className="valor">{formatMoney(supplier.paidTotal)}</span>
          </dd>
          <dd className="mt-2 text-sm text-suave">
            Soma dos pagamentos já importados.{" "}
            <Link
              href={`/gastos/registros?fase=pagamento&fornecedor=${supplier.id}`}
              className="link"
            >
              Ver cada pagamento
            </Link>
          </dd>
        </div>
      </dl>

      {paidByYear.length > 0 && (
        <section aria-labelledby="por-ano" className="mt-12 max-w-4xl">
          <h2 id="por-ano" className="font-display text-2xl font-semibold">
            Recebido por ano
          </h2>
          <ul className="mt-3">
            {paidByYear.map((row) => (
              <li
                key={row.year}
                className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-linha py-3"
              >
                <Link
                  href={`/gastos/registros?fase=pagamento&ano=${row.year}&fornecedor=${supplier.id}`}
                  className="link"
                >
                  {row.year} ({row.count.toLocaleString("pt-BR")} pagamentos)
                </Link>
                <span className="font-display font-semibold tabular-nums">
                  {formatMoney(row.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="contratos" className="mt-12 max-w-4xl">
        <h2 id="contratos" className="font-display text-2xl font-semibold">
          Contratos
        </h2>
        {contracts.length === 0 ? (
          <p className="mt-2 max-w-prose text-suave">
            Nenhum contrato desta empresa foi importado ainda. Ela aparece aqui por causa de
            pagamentos registrados.
          </p>
        ) : (
          <ul className="mt-3">
            {contracts.map((contract) => (
              <li
                key={contract.id}
                className="grid gap-x-6 gap-y-1 border-b border-linha py-4 md:grid-cols-[minmax(0,1fr)_10rem]"
              >
                <div>
                  <p className="text-sm text-suave">
                    {contract.number}, assinado em {formatDate(contract.signedAt)}
                  </p>
                  <p className="font-medium">
                    <Link
                      href={`/contratos/${contract.id}`}
                      className="hover:text-azul hover:underline"
                    >
                      <span className="line-clamp-2">
                        {contract.description ? contract.description : "A fonte não diz para que é"}
                      </span>
                    </Link>
                  </p>
                  <p className="mt-1">
                    <StatusBadge status={contract.status} />
                  </p>
                </div>
                <p className="font-display font-semibold tabular-nums md:text-right">
                  {formatMoney(contract.originalValue)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {agencies.length > 0 && (
        <section aria-labelledby="orgaos" className="mt-12 max-w-4xl">
          <h2 id="orgaos" className="font-display text-2xl font-semibold">
            Secretarias com contratos ou pagamentos
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {agencies.map((agency) => (
              <li key={agency.id}>{plainName(agency.name)}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 max-w-prose text-sm text-suave">
        Esta página reúne o que as fontes oficiais publicam sobre a empresa nos contratos e
        pagamentos já importados. Não é uma avaliação da empresa. A origem de cada contrato e de
        cada pagamento está na página do respectivo registro.
      </p>
    </article>
  );
}
