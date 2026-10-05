import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ManualCorrections } from "@/components/manual-corrections";
import { SourceTrail } from "@/components/source-trail";
import { StatusBadge } from "@/components/status-badge";
import { getBid } from "@/lib/bids";
import { formatDate, formatMoney } from "@/lib/format";
import { plainModality, plainName } from "@/lib/plain";

interface PageProps {
  params: Promise<{ id: string }>;
}

const TITLE_MAX_LENGTH = 70;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const detail = await getBid((await params).id);
  if (!detail) return { title: "Licitação não encontrada" };

  const subject = detail.bid.description ?? detail.bid.number;
  return {
    title:
      subject.length > TITLE_MAX_LENGTH ? `${subject.slice(0, TITLE_MAX_LENGTH).trim()}…` : subject,
    description: `Licitação ${detail.bid.number}: veja modalidade, órgão, valor estimado, contratos resultantes e a fonte oficial.`,
  };
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-suave">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export default async function BidPage({ params }: PageProps) {
  const detail = await getBid((await params).id);
  if (!detail) notFound();

  const { bid, source, agencyName, contracts, works, versions } = detail;

  return (
    <article>
      <p>
        <Link href="/licitacoes" className="link">
          Todas as licitações
        </Link>
      </p>

      <header className="mt-6 max-w-4xl">
        <p className="text-suave">Licitação {bid.number}</p>
        <h1 className="mt-2 font-display text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
          {bid.description ? bid.description : "A fonte não diz o que será comprado"}
        </h1>
        <p className="mt-8 text-4xl sm:text-6xl">
          <span className={bid.estimatedValue === null ? "text-suave" : "valor"}>
            {formatMoney(bid.estimatedValue)}
          </span>
        </p>
        <p className="mt-2 text-suave">Valor estimado antes da disputa</p>
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status="" label={bid.sourceStatus ?? "Situação não informada"} />
          <span className="text-suave">Situação como informada pela fonte.</span>
        </p>
      </header>

      <dl className="mt-12 grid max-w-4xl gap-x-10 gap-y-6 border-t border-linha pt-8 sm:grid-cols-2">
        <Fact label="Tipo de licitação">{bid.modality ? plainModality(bid.modality) : "Não informado"}</Fact>
        <Fact label="Secretaria ou órgão">{agencyName ? plainName(agencyName) : "Não informado"}</Fact>
        {bid.homologatedValue !== null && (
          <Fact label="Valor final aprovado">{formatMoney(bid.homologatedValue)}</Fact>
        )}
        <Fact label="Publicação">{formatDate(bid.publishedAt)}</Fact>
        <Fact label="Início da disputa">{formatDate(bid.openingDate)}</Fact>
        <Fact label="Número do processo">{bid.processNumber ?? "Não informado"}</Fact>
      </dl>

      <section aria-labelledby="contratos" className="mt-10 max-w-4xl border-t border-linha pt-6">
        <h2 id="contratos" className="font-display text-xl font-semibold">
          Contratos que resultaram desta licitação
        </h2>
        {contracts.length === 0 ? (
          <p className="mt-2 max-w-prose text-suave">
            Nenhum contrato ligado até agora. Pode ser que a licitação ainda não tenha gerado
            contrato, ou que o contrato ainda não tenha sido importado para o portal.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-suave">
              Ligados pelo número da licitação informado em cada contrato.
            </p>
            <ul className="mt-3">
              {contracts.map((contract) => (
                <li
                  key={contract.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-linha py-3"
                >
                  <span>
                    <Link href={`/contratos/${contract.id}`} className="link font-medium">
                      {contract.number}
                    </Link>
                    <span className="block text-suave">
                      {contract.supplierName ? plainName(contract.supplierName) : "Empresa não informada"}
                    </span>
                  </span>
                  <span className={contract.originalValue === null ? "text-suave" : "valor"}>
                    {formatMoney(contract.originalValue)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {works.length > 0 && (
        <section aria-labelledby="obras" className="mt-10 max-w-4xl border-t border-linha pt-6">
          <h2 id="obras" className="font-display text-xl font-semibold">
            Obras ligadas a esta licitação
          </h2>
          <p className="mt-1 text-sm text-suave">Vínculo informado pela própria fonte.</p>
          <ul className="mt-3 space-y-2">
            {works.map((work) => (
              <li key={work.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/obras/${work.id}`} className="link">
                  {work.title}
                </Link>
                <StatusBadge status={work.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 max-w-prose text-suave">
        Participantes, propostas e documentos do edital ainda não estão disponíveis aqui. Consulte
        a página oficial indicada abaixo.
      </p>

      <ManualCorrections entityType="bid" entityId={bid.id} />

      <SourceTrail
        source={source}
        sourceUrl={bid.sourceUrl}
        externalId={bid.externalId}
        sourceMissingSince={bid.sourceMissingSince}
        versions={versions}
        linkLabel={
          source.slug === "sai-cmpa"
            ? "Abrir a lista de licitações no portal da Câmara"
            : "Abrir esta licitação no sistema da Prefeitura"
        }
        fieldLabels={{
          estimatedValue: "Valor estimado",
          publishedAt: "Data de publicação",
          openingDate: "Início da disputa",
        }}
        notes={["A situação é exibida como a fonte publica, sem cálculo nosso."]}
      />
    </article>
  );
}
