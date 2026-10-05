import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  listActiveOverrides,
  listAlerts,
  listCollectionRequests,
  listFailedRecords,
  listManualLinks,
  listRecentRuns,
  listUnlinkedWorks,
} from "@/lib/admin";
import { CORRECTABLE, correctedFieldLabel, type CorrectableType } from "@/lib/admin-actions";

import {
  CollectionForm,
  JOB_LABELS,
  LinkWorkForm,
  OverrideForm,
  RevokeLinkForm,
  RevokeOverrideForm,
} from "./forms";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false },
};

const ENTITY_LABELS: Record<string, string> = {
  contract: "Contratos",
  public_work: "Obras",
  bid: "Licitações",
  commitment: "Empenhos",
  liquidation: "Liquidações",
  payment: "Pagamentos",
};

const entity = (type: string): string => ENTITY_LABELS[type] ?? type;

const REQUEST_STATUS: Record<string, string> = {
  pending: "aguardando o worker",
  running: "em execução",
  done: "concluído",
  failed: "falhou",
};

/** Endereço público do registro corrigido. */
const ENTITY_PATHS: Record<CorrectableType, string> = {
  contract: "/contratos",
  public_work: "/obras",
  bid: "/licitacoes",
};

function recordPath(type: string, id: string): string | null {
  return type in CORRECTABLE ? `${ENTITY_PATHS[type as CorrectableType]}/${id}` : null;
}

interface PageProps {
  searchParams: Promise<{ ok?: string | string[]; erro?: string | string[] }>;
}

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="border-b-2 border-tinta pb-2 font-display text-2xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function AdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const done = first(params.ok);
  const error = first(params.erro);
  const [alerts, runs, failed, unlinked, requests, manualLinks, overrides] = await Promise.all([
    listAlerts(),
    listRecentRuns(),
    listFailedRecords(),
    listUnlinkedWorks(),
    listCollectionRequests(),
    listManualLinks(),
    listActiveOverrides(),
  ]);
  const alertTitle =
    alerts.length === 1 ? "1 coleta precisa de atenção" : `${alerts.length} coletas precisam de atenção`;

  return (
    <>
      <h1 className="font-display text-4xl font-medium tracking-tight">Administração</h1>
      <p className="mt-3 max-w-prose text-suave">
        Dados oficiais nunca são editados aqui. Vínculos e correções feitos à mão ficam
        registrados com autor, data e motivo, e aparecem como tal nas páginas públicas.
      </p>

      {done && (
        <p role="status" className="mt-6 border-l-4 border-azul bg-superficie px-4 py-3 font-medium">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 border-l-4 border-alerta bg-alerta/10 px-4 py-3 font-medium text-alerta">
          {error}
        </p>
      )}

      {alerts.length === 0 ? (
        <p className="mt-8 border-l-4 border-azul bg-superficie px-4 py-3">
          Todas as coletas estão em dia e sem falhas.
        </p>
      ) : (
        <div role="alert" className="mt-8 border-l-4 border-alerta bg-alerta/10 px-4 py-3">
          <p className="font-semibold text-alerta">{alertTitle}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {alerts.map((alert) => (
              <li key={`${alert.sourceName}-${alert.entityType}`}>
                {alert.sourceName}, {entity(alert.entityType).toLowerCase()}: {alert.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section id="pedir-coleta" title="Pedir uma coleta agora">
        <p className="mt-3 max-w-prose text-sm text-suave">
          O pedido entra em uma fila. O worker a consulta a cada minuto e executa um pedido por
          vez, respeitando o intervalo entre requisições às fontes.
        </p>
        <CollectionForm />
        {requests.length > 0 && (
          <ul className="mt-5 text-sm">
            {requests.map((request) => (
              <li key={request.id} className="border-b border-linha py-2">
                <span className="font-medium">{JOB_LABELS[request.job] ?? request.job}</span>:{" "}
                <span className={request.status === "failed" ? "font-semibold text-alerta" : ""}>
                  {REQUEST_STATUS[request.status] ?? request.status}
                </span>
                <span className="ml-2 text-suave">
                  pedido em {request.requestedAt}
                  {request.author && ` por ${request.author}`}
                  {request.finishedAt && `, terminou em ${request.finishedAt}`}
                </span>
                {request.message && <span className="block text-suave">{request.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="execucoes" title="Últimas coletas">
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[52rem] text-left text-sm">
            <thead className="text-suave">
              <tr>
                <th className="py-2 pr-4 font-medium">Início</th>
                <th className="py-2 pr-4 font-medium">Fonte</th>
                <th className="py-2 pr-4 font-medium">Dados</th>
                <th className="py-2 pr-4 font-medium">Situação</th>
                <th className="py-2 pr-4 text-right font-medium">Encontrados</th>
                <th className="py-2 pr-4 text-right font-medium">Novos</th>
                <th className="py-2 pr-4 text-right font-medium">Alterados</th>
                <th className="py-2 pr-4 text-right font-medium">Falhas</th>
                <th className="py-2 text-right font-medium">Ausentes</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-linha align-top">
                  <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{run.startedAt}</td>
                  <td className="py-2 pr-4">{run.sourceName}</td>
                  <td className="py-2 pr-4">{entity(run.entityType)}</td>
                  <td className={run.status === "success" ? "py-2 pr-4" : "py-2 pr-4 font-semibold text-alerta"}>
                    {run.status}
                    {run.errorSummary && (
                      <details className="mt-1 font-normal text-tinta">
                        <summary className="cursor-pointer">Erros</summary>
                        <pre className="mt-1 max-w-md text-xs whitespace-pre-wrap">
                          {run.errorSummary}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{run.found}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{run.created}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{run.updated}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{run.failed}</td>
                  <td className="py-2 text-right tabular-nums">{run.missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="falhas" title={`Registros que não puderam ser interpretados (${failed.length})`}>
        {failed.length === 0 ? (
          <p className="mt-3 text-suave">Nenhum.</p>
        ) : (
          <ul className="mt-3">
            {failed.map((record) => (
              <li
                key={`${record.entityType}-${record.externalId}`}
                className="border-b border-linha py-3 text-sm"
              >
                <p className="font-medium">
                  {record.sourceName}, {entity(record.entityType).toLowerCase()}, registro{" "}
                  {record.externalId}
                </p>
                <p className="text-alerta">{record.error}</p>
                <p className="text-suave">
                  Visto em {record.lastSeenAt}.{" "}
                  <a href={record.sourceUrl} rel="noopener noreferrer" className="link">
                    Abrir na fonte
                  </a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        id="sem-vinculo"
        title={`Obras com contrato indicado pela fonte e não ligado (${unlinked.length})`}
      >
        <p className="mt-3 max-w-prose text-sm text-suave">
          O contrato indicado ainda não foi importado ou não está na listagem pública (caso dos
          aditivos). Se o contrato correto estiver no portal, ligue-o à mão e diga o motivo.
        </p>
        <ul className="mt-3">
          {unlinked.map((work) => (
            <li key={work.id} className="border-b border-linha py-2 text-sm">
              <Link href={`/obras/${work.id}`} className="link">
                {work.title}
              </Link>
              <span className="ml-3 text-suave">
                {work.contractNumber} (id {work.contractExternalId} na fonte)
              </span>
              <LinkWorkForm workId={work.id} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="vinculos-manuais" title={`Vínculos feitos à mão (${manualLinks.length})`}>
        {manualLinks.length === 0 ? (
          <p className="mt-3 text-suave">Nenhum.</p>
        ) : (
          <ul className="mt-3">
            {manualLinks.map((link) => (
              <li key={link.id} className="border-b border-linha py-3 text-sm">
                <p>
                  <Link href={`/obras/${link.workId}`} className="link">
                    {link.workTitle}
                  </Link>{" "}
                  ligada ao contrato{" "}
                  <Link href={`/contratos/${link.contractId}`} className="link">
                    {link.contractNumber}
                  </Link>
                </p>
                <p className="text-suave">
                  Motivo: {link.justification} Por {link.author ?? "autor não registrado"} em{" "}
                  {link.createdAt}.
                </p>
                <RevokeLinkForm linkId={link.id} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="correcoes" title={`Correções manuais em vigor (${overrides.length})`}>
        <p className="mt-3 max-w-prose text-sm text-suave">
          A correção não substitui o dado oficial: a página pública mostra os dois, com o motivo.
        </p>
        <OverrideForm />
        {overrides.length > 0 && (
          <ul className="mt-6">
            {overrides.map((override) => {
              const path = recordPath(override.entityType, override.entityId);
              return (
                <li key={override.id} className="border-b border-linha py-3 text-sm">
                  <p className="font-medium">
                    {entity(override.entityType)},{" "}
                    {correctedFieldLabel(override.entityType, override.field)}
                    {path && (
                      <Link href={path} className="link ml-3 font-normal">
                        Ver registro
                      </Link>
                    )}
                  </p>
                  <p>
                    Na fonte: {override.original ?? "sem valor"}. Corrigido para:{" "}
                    <strong>{override.corrected}</strong>
                  </p>
                  <p className="text-suave">
                    Motivo: {override.justification} Por {override.author} em {override.createdAt}.
                  </p>
                  <RevokeOverrideForm overrideId={override.id} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
