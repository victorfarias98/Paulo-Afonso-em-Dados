import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ManualCorrections } from "@/components/manual-corrections";
import { SourceTrail } from "@/components/source-trail";
import { StatusBadge } from "@/components/status-badge";
import { KIND_LABELS } from "@/lib/contract-filters";
import { type ContractDetail, getContract } from "@/lib/contracts";
import { getPaidForContract } from "@/lib/expenses";
import { formatDate, formatDocument, formatMoney } from "@/lib/format";
import { listWorksOfContract } from "@/lib/works";
import { plainName } from "@/lib/plain";

interface PageProps {
  params: Promise<{ id: string }>;
}

const TITLE_MAX_LENGTH = 70;

/** Explica em uma frase por que o contrato está nessa situação. */
const STATUS_REASON: Record<string, (contract: ContractDetail["contract"]) => string> = {
  vigente: (c) => `A data final de vigência (${formatDate(c.endsAt)}) ainda não passou.`,
  vigencia_encerrada: (c) => `A data final de vigência (${formatDate(c.endsAt)}) já passou.`,
  cancelado: () => "A fonte oficial informa que o contrato foi cancelado.",
  informacao_insuficiente: () => "A fonte oficial não informa a data final de vigência.",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const detail = await getContract((await params).id);
  if (!detail) return { title: "Contrato não encontrado" };

  const { contract, supplier } = detail;
  const subject = contract.description ?? contract.number;
  const title =
    subject.length > TITLE_MAX_LENGTH ? `${subject.slice(0, TITLE_MAX_LENGTH).trim()}…` : subject;

  return {
    title,
    description: `${KIND_LABELS[contract.kind]} ${contract.number}${
      supplier ? ` com ${supplier.legalName}` : ""
    }: veja valor, vigência, secretaria responsável e a fonte oficial.`,
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

export default async function ContractPage({ params }: PageProps) {
  const detail = await getContract((await params).id);
  if (!detail) notFound();

  const { contract, supplier, agencies, budgetLines } = detail;
  const isAmendment = contract.kind === "termo_aditivo";
  const document = supplier ? formatDocument(supplier.documentType, supplier.documentNumber) : null;
  const reason = STATUS_REASON[contract.status]?.(contract);
  const [works, paid] = await Promise.all([
    listWorksOfContract(contract.id),
    getPaidForContract(contract.id),
  ]);

  return (
    <article>
      <p>
        <Link href="/contratos" className="link">
          Todos os contratos
        </Link>
      </p>

      <header className="mt-6 max-w-4xl">
        <p className="text-suave">
          {KIND_LABELS[contract.kind]} {contract.number}
        </p>
        <h1 className="mt-2 font-display text-2xl leading-tight font-medium tracking-tight sm:text-4xl">
          {contract.description ? contract.description : "A fonte não diz para que é este contrato"}
        </h1>
        <p className="mt-8 text-4xl sm:text-6xl">
          <span className={contract.originalValue === null ? "text-suave" : "valor"}>
            {formatMoney(contract.originalValue)}
          </span>
        </p>
        <p className="mt-2 text-suave">
          {isAmendment ? "Valor informado no termo aditivo" : "Valor inicial do contrato"}
        </p>
        {isAmendment && (
          <p className="mt-4 max-w-prose border-l-4 border-azul bg-superficie px-4 py-3">
            Este registro é um termo aditivo: altera um contrato já existente. A fonte não informa,
            nesta página, qual é o contrato original nem se o valor acima é o acréscimo ou o novo
            total; por isso ele não entra nas somas de valor contratado do portal.
          </p>
        )}
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={contract.status} />
          {reason && <span className="text-suave">{reason}</span>}
        </p>
      </header>

      <dl className="mt-12 grid max-w-4xl gap-x-10 gap-y-6 border-t border-linha pt-8 sm:grid-cols-2">
        <Fact label="Empresa ou pessoa contratada">
          {supplier?.legalName ? plainName(supplier.legalName) : "Não informado"}
          {document && <span className="block text-sm font-normal text-suave">{document}</span>}
        </Fact>
        <Fact label={agencies.length > 1 ? "Secretarias responsáveis" : "Secretaria responsável"}>
          {agencies.length === 0
            ? "Não informado"
            : agencies.map((agency) => (
                <span key={agency.id} className="block">
                  {agency.name}
                </span>
              ))}
        </Fact>
        <Fact label="Assinatura">{formatDate(contract.signedAt)}</Fact>
        <Fact label="Fim da vigência">{formatDate(contract.endsAt)}</Fact>
        <Fact label="Licitação de origem">
          {contract.bidId ? (
            <Link href={`/licitacoes/${contract.bidId}`} className="link">
              {contract.bidNumber}
            </Link>
          ) : (
            (contract.bidNumber ?? "Não informada")
          )}
          {contract.modality && (
            <span className="block text-sm font-normal text-suave">{contract.modality}</span>
          )}
        </Fact>
        <Fact label="Número do processo">{contract.processNumber ?? "Não informado"}</Fact>
        {contract.contractType && <Fact label="Classificação na fonte">{contract.contractType}</Fact>}
        {contract.sourceStatus && (
          <Fact label="Situação informada pela fonte">{contract.sourceStatus}</Fact>
        )}
      </dl>

      {budgetLines.length > 0 && (
        <details className="mt-10 max-w-4xl border-t border-linha pt-6">
          <summary className="cursor-pointer font-display text-xl font-semibold">
            De qual parte do orçamento sai o dinheiro ({budgetLines.length})
          </summary>
          <ul className="mt-4 space-y-3 text-sm">
            {budgetLines.map((line) => (
              <li key={line} className="border-l-2 border-linha pl-3">
                {line}
              </li>
            ))}
          </ul>
        </details>
      )}

      {works.length > 0 && (
        <section aria-labelledby="obras" className="mt-10 max-w-4xl border-t border-linha pt-6">
          <h2 id="obras" className="font-display text-xl font-semibold">
            Obras ligadas a este contrato
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

      <section aria-labelledby="pagamentos" className="mt-10 max-w-4xl border-t border-linha pt-6">
        <h2 id="pagamentos" className="font-display text-xl font-semibold">
          Pagamentos ligados a este contrato
        </h2>
        {paid.count === 0 ? (
          <p className="mt-2 max-w-prose text-suave">
            Nenhum pagamento ligado até agora. Isso não quer dizer que nada foi pago: só ligamos um
            pagamento a um contrato quando a licitação e quem recebeu apontam para um único contrato.
          </p>
        ) : (
          <p className="mt-2 max-w-prose">
            <span className="valor text-2xl">{formatMoney(paid.total)}</span> em{" "}
            {paid.count === 1 ? "1 pagamento" : `${paid.count.toLocaleString("pt-BR")} pagamentos`}{" "}
            importados.
            <span className="mt-2 block text-sm text-suave">
              Ligação feita por nós, pela licitação de origem e por quem recebeu cada pagamento.
              Confiança média: pode faltar pagamento, e o total cobre só os meses já importados.
            </span>
          </p>
        )}
      </section>

      <p className="mt-10 max-w-prose text-suave">
        O portal não consegue listar os aditivos deste contrato: a fonte não publica essa relação
        de forma que possa ser lida. Consulte a página oficial indicada abaixo.
      </p>

      <ManualCorrections entityType="contract" entityId={contract.id} />

      <SourceTrail
        source={detail.source}
        sourceUrl={contract.sourceUrl}
        externalId={contract.externalId}
        sourceMissingSince={contract.sourceMissingSince}
        versions={detail.versions}
        linkLabel="Abrir este contrato no sistema da Prefeitura"
        fieldLabels={{
          originalValue: "Valor",
          signedAt: "Data de assinatura",
          endsAt: "Fim da vigência",
        }}
        notes={[
          "O nome e o documento do fornecedor vêm juntos na fonte; aqui aparecem separados.",
          "A situação é calculada por nós a partir da data final de vigência.",
        ]}
      />
    </article>
  );
}
