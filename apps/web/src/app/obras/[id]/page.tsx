import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ManualCorrections } from "@/components/manual-corrections";
import { SourceTrail } from "@/components/source-trail";
import { StatusBadge } from "@/components/status-badge";
import { getManualWorkLink } from "@/lib/corrections";
import { formatDate, formatMoney } from "@/lib/format";
import { getWork, type WorkDetail } from "@/lib/works";
import { plainName } from "@/lib/plain";

interface PageProps {
  params: Promise<{ id: string }>;
}

const MS_PER_DAY = 86_400_000;
const TIME_ZONE = "America/Bahia";

/** Explica em uma frase por que a obra está nessa situação. */
const STATUS_REASON: Record<string, (work: WorkDetail["work"]) => string> = {
  prazo_vencido: (w) =>
    `O prazo combinado no início terminou em ${formatDate(w.expectedEndDate)} e a fonte ainda informa “${w.sourceStatus ?? ""}”. Prorrogações de prazo não aparecem nesta fonte.`,
  em_andamento: () => "É a situação informada pela Prefeitura; o prazo inicial ainda não terminou.",
  concluida: () => "A fonte informa que a obra foi concluída ou recebida.",
  paralisada: () => "A fonte informa que a obra está paralisada.",
  nao_iniciada: () => "A fonte informa que a obra não foi iniciada.",
  em_fiscalizacao: () => "A fonte informa que a obra está em fiscalização.",
  informacao_insuficiente: () => "A fonte não informa a situação desta obra.",
};

function daysSince(isoDate: string): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
  return Math.floor((Date.parse(today) - Date.parse(isoDate)) / MS_PER_DAY);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const detail = await getWork((await params).id);
  if (!detail) return { title: "Obra não encontrada" };

  return {
    title: detail.work.title,
    description:
      "Veja valor, empresa responsável, contrato, prazo, situação e fontes oficiais desta obra da Prefeitura de Paulo Afonso.",
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

function formatAddress(address: WorkDetail["addresses"][number]): string {
  return [address.street, address.number, address.complement, address.neighborhood]
    .filter(Boolean)
    .join(", ");
}

export default async function WorkPage({ params }: PageProps) {
  const detail = await getWork((await params).id);
  if (!detail) notFound();

  const { work, source, addresses, attachments, versions, supplierName } = detail;
  const reason = STATUS_REASON[work.status]?.(work);
  const elapsed = work.startDate ? daysSince(work.startDate) : null;
  const amendmentCount = attachments.filter((item) => /aditivo/i.test(item.title)).length;
  const manualLink = work.contractId ? await getManualWorkLink(work.id, work.contractId) : null;

  return (
    <article>
      <p>
        <Link href="/obras" className="link">
          Todas as obras
        </Link>
      </p>

      <header className="mt-6 max-w-4xl">
        <p className="text-suave">Obra nº {work.number}</p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-medium tracking-tight sm:text-5xl">
          {plainName(work.title)}
        </h1>
        {work.description && work.description !== work.title && (
          <p className="mt-3 max-w-prose text-suave sm:text-lg">{work.description}</p>
        )}
        <p className="mt-8 text-4xl sm:text-6xl">
          <span className={work.initialValue === null ? "text-suave" : "valor"}>
            {formatMoney(work.initialValue)}
          </span>
        </p>
        <p className="mt-2 text-suave">Valor informado da obra</p>
        <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <StatusBadge status={work.status} />
          {reason && <span className="max-w-prose text-suave">{reason}</span>}
        </p>
        {work.status === "prazo_vencido" && amendmentCount > 0 && (
          <p className="mt-4 max-w-prose border-l-4 border-azul bg-superficie px-4 py-3">
            Esta obra tem {amendmentCount === 1 ? "1 termo aditivo anexado" : `${amendmentCount} termos aditivos anexados`}{" "}
            na fonte. Aditivos podem prorrogar o prazo; confira os documentos abaixo antes de
            concluir que a obra está atrasada.
          </p>
        )}
      </header>

      <dl className="mt-12 grid max-w-4xl gap-x-10 gap-y-6 border-t border-linha pt-8 sm:grid-cols-2">
        <Fact label="Início">
          {formatDate(work.startDate)}
          {elapsed !== null && elapsed >= 0 && (
            <span className="block text-sm font-normal text-suave">
              {elapsed.toLocaleString("pt-BR")} dias desde o início
            </span>
          )}
        </Fact>
        <Fact label="Prazo inicial">
          {formatDate(work.expectedEndDate)}
          {work.deadlineDays !== null && (
            <span className="block text-sm font-normal text-suave">
              {work.deadlineDays} dias a partir do início (calculado por nós)
            </span>
          )}
        </Fact>
        <Fact label="Empresa responsável">
          {supplierName ? plainName(supplierName) : "Ainda não sabemos: o contrato não foi encontrado"}
        </Fact>
        <Fact label="Contrato">
          {work.contractId ? (
            <Link href={`/contratos/${work.contractId}`} className="link">
              {detail.contractNumber ?? work.contractNumber}
            </Link>
          ) : (
            (work.contractNumber ?? "A fonte não indica contrato")
          )}
          {work.contractId && (
            <span className="block text-sm font-normal text-suave">
              {manualLink
                ? `Vínculo feito pela equipe do portal em ${manualLink.createdAt}, não pela fonte. Motivo: ${manualLink.justification ?? "não registrado"}`
                : "Vínculo informado pela própria fonte"}
            </span>
          )}
          {!work.contractId && work.contractNumber && (
            <span className="block text-sm font-normal text-suave">
              Instrumento indicado pela fonte, ainda não importado para o portal
            </span>
          )}
        </Fact>
        <Fact label="Licitação">
          {work.bidId ? (
            <Link href={`/licitacoes/${work.bidId}`} className="link">
              {work.bidNumber}
            </Link>
          ) : (
            (work.bidNumber ?? "A fonte não indica licitação")
          )}
        </Fact>
        <Fact label="Situação informada pela fonte">{work.sourceStatus ?? "Não informada"}</Fact>
        {work.workType && <Fact label="Tipo">{work.workType}</Fact>}
        {work.workFunction && <Fact label="Finalidade">{work.workFunction}</Fact>}
        <Fact label={addresses.length > 1 ? "Locais" : "Local"}>
          {addresses.length === 0
            ? "Não informado"
            : addresses.map((address) => (
                <span key={address.id} className="block">
                  {formatAddress(address) || "Não informado"}
                </span>
              ))}
        </Fact>
      </dl>

      {attachments.length > 0 && (
        <section aria-labelledby="documentos" className="mt-10 max-w-4xl border-t border-linha pt-6">
          <h2 id="documentos" className="font-display text-xl font-semibold">
            Documentos publicados pela fonte
          </h2>
          <ul className="mt-3 space-y-2">
            {attachments.map((attachment) => (
              <li key={attachment.sourceUrl}>
                <a href={attachment.sourceUrl} rel="noopener noreferrer" className="link">
                  {attachment.title}
                </a>{" "}
                <span className="text-sm text-suave">(PDF no sistema da Prefeitura)</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 max-w-prose text-suave">
        Percentual de execução e mapa não estão disponíveis: a fonte não publica percentual nem
        coordenadas. Os pagamentos ligados ao contrato, quando identificados, aparecem na página do
        contrato.
      </p>

      <ManualCorrections entityType="public_work" entityId={work.id} />

      <SourceTrail
        source={source}
        sourceUrl={work.sourceUrl}
        externalId={work.externalId}
        sourceMissingSince={work.sourceMissingSince}
        versions={versions}
        linkLabel="Abrir esta obra no sistema da Prefeitura"
        fieldLabels={{ initialValue: "Valor", startDate: "Data de início" }}
        notes={[
          "O prazo inicial é calculado por nós: data de início mais os dias de prazo informados.",
          "A situação combina o que a fonte informa com esse prazo calculado.",
        ]}
      />
    </article>
  );
}
