import type { Metadata } from "next";

import { formatDateTime } from "@/lib/format";
import { type DatasetStatus, listSourceStatus } from "@/lib/overview";

export const metadata: Metadata = {
  title: "Fontes dos dados",
  description:
    "De onde vêm os dados do portal, quando cada fonte foi consultada pela última vez e se houve falhas.",
};

/** A situação das coletas vem do banco a cada visita; a página não é gerada no build. */
export const dynamic = "force-dynamic";

const ENTITY_LABELS: Record<string, string> = {
  contract: "Contratos",
  public_work: "Obras",
  bid: "Licitações",
  commitment: "Empenhos",
  liquidation: "Liquidações",
  payment: "Pagamentos",
};

const RUN_LABELS: Record<string, string> = {
  success: "Concluída sem falhas",
  partial: "Concluída com falhas em alguns registros",
  failed: "Falhou",
  suspect: "Suspeita: a fonte devolveu muito menos registros que antes",
  running: "Em andamento ou interrompida",
};

function Dataset({ row }: { row: DatasetStatus }) {
  const hasProblem = row.lastStatus !== null && row.lastStatus !== "success";

  return (
    <li className="grid gap-x-6 gap-y-1 border-b border-linha py-3 sm:grid-cols-[10rem_minmax(0,1fr)_9rem]">
      <p className="font-medium">{ENTITY_LABELS[row.entityType ?? ""] ?? row.entityType}</p>
      <div className="text-sm">
        {row.lastStartedAt ? (
          <>
            <p className={hasProblem ? "font-medium text-alerta" : undefined}>
              {RUN_LABELS[row.lastStatus ?? ""] ?? row.lastStatus}
            </p>
            <p className="text-suave">
              Última coleta em {formatDateTime(row.lastStartedAt)}
              {row.lastSuccessAt && (
                <span>; última concluída em {formatDateTime(row.lastSuccessAt)}</span>
              )}
            </p>
          </>
        ) : (
          <p className="text-suave">Ainda não coletado</p>
        )}
        {row.failedRecords > 0 && (
          <p className="text-alerta">
            {row.failedRecords.toLocaleString("pt-BR")} registros não puderam ser interpretados e
            não aparecem no portal.
          </p>
        )}
      </div>
      <p className="tabular-nums sm:text-right">
        {row.records.toLocaleString("pt-BR")}{" "}
        <span className="text-sm text-suave">registros</span>
      </p>
    </li>
  );
}

/** Agrupa as linhas (uma por conjunto de dados) pela fonte a que pertencem. */
function groupBySource(rows: DatasetStatus[]): DatasetStatus[][] {
  const groups = new Map<string, DatasetStatus[]>();
  for (const row of rows) {
    groups.set(row.sourceName, [...(groups.get(row.sourceName) ?? []), row]);
  }
  return [...groups.values()];
}

export default async function SourcesPage() {
  const sources = groupBySource(await listSourceStatus());

  return (
    <>
      <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">Fontes dos dados</h1>
      <p className="mt-4 max-w-prose text-suave sm:text-lg">
        Tudo o que o portal mostra vem das fontes oficiais abaixo. Guardamos uma cópia de cada
        registro como foi publicado, com a data da coleta, e nunca apagamos um registro que some da
        fonte: ele passa a ser marcado como ausente.
      </p>

      {sources.map((datasets) => {
        const [source] = datasets;
        if (!source) return null;
        const collected = datasets.filter((row) => row.entityType !== null);

        return (
          <section key={source.sourceName} className="mt-12 max-w-4xl border-t-2 border-tinta pt-5">
            <h2 className="font-display text-2xl font-semibold">{source.sourceName}</h2>
            <p className="mt-1 text-suave">{source.agencyName}</p>
            {source.notes && <p className="mt-2 max-w-prose">{source.notes}</p>}
            <p className="mt-2 text-sm">
              <a href={source.baseUrl} rel="noopener noreferrer" className="link break-all">
                {source.baseUrl}
              </a>
              <span className="mt-1 block text-suave">
                {source.isDocumented
                  ? "API pública documentada"
                  : "Sem API documentada: lemos as páginas públicas"}
              </span>
            </p>
            {collected.length === 0 ? (
              <p className="mt-4 text-suave">Ainda não coletamos dados desta fonte.</p>
            ) : (
              <ul className="mt-4">
                {collected.map((row) => (
                  <Dataset key={row.entityType} row={row} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <p className="mt-12 max-w-prose text-sm text-suave">
        Encontrou diferença entre o portal e a fonte? Vale o que está na fonte. Avise em{" "}
        <a href="mailto:contato@baiustecnologia.com.br" className="link">
          contato@baiustecnologia.com.br
        </a>
        .
      </p>
    </>
  );
}
