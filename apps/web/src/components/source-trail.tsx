import { formatDate, formatDateTime } from "@/lib/format";
import type { RecordVersion } from "@/lib/provenance";

type Props = {
  source: { name: string; agencyName: string };
  sourceUrl: string | null;
  externalId: string;
  sourceMissingSince: string | null;
  versions: RecordVersion[];
  /** Texto do link para a página oficial do registro. */
  linkLabel: string;
  /** Campos convertidos que vale mostrar ao leitor, com o nome em linguagem comum. */
  fieldLabels: Record<string, string>;
  /** Outras transformações, explicadas em frases. */
  notes: string[];
};

const HASH_PREVIEW_LENGTH = 12;

const show = (value: unknown): string =>
  value === null || value === undefined
    ? "vazio"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);

/**
 * Recibo de origem do dado: de onde veio, quando foi coletado e o que foi
 * convertido em relação ao que a fonte oficial publicou.
 */
export function SourceTrail({
  source,
  sourceUrl,
  externalId,
  sourceMissingSince,
  versions,
  linkLabel,
  fieldLabels,
  notes,
}: Props) {
  const current = versions.find((version) => version.isPrimary) ?? versions.at(-1);
  const firstSeen = versions[0]?.firstSeenAt;
  const conversions = (current?.transformations ?? []).filter(
    (item) => item.field in fieldLabels && item.from !== null,
  );

  return (
    <section
      aria-labelledby="origem"
      className="mt-16 border-t-2 border-dashed border-tinta/30 bg-superficie px-5 py-8 sm:px-8"
    >
      <h2 id="origem" className="font-display text-2xl font-semibold">
        De onde vem este dado
      </h2>
      <p className="mt-2 max-w-prose text-suave">
        Copiamos esta informação de uma página oficial. Confira você mesmo no link abaixo: se
        encontrar diferença, vale o que está na fonte.
      </p>

      <dl className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-suave">Fonte</dt>
          <dd className="font-medium">{source.name}</dd>
          <dd className="text-sm text-suave">{source.agencyName}</dd>
        </div>
        <div>
          <dt className="text-sm text-suave">Página oficial</dt>
          <dd>
            {sourceUrl ? (
              <a href={sourceUrl} data-analytics-source rel="noopener noreferrer" className="link">
                {linkLabel}
              </a>
            ) : (
              "Não disponível"
            )}
          </dd>
          <dd className="text-sm text-suave">Identificador na fonte: {externalId}</dd>
        </div>
        <div>
          <dt className="text-sm text-suave">Última conferência na fonte</dt>
          <dd className="font-medium">
            {current ? formatDateTime(current.lastSeenAt) : "Não informado"}
          </dd>
          {firstSeen && (
            <dd className="text-sm text-suave">Primeira coleta: {formatDateTime(firstSeen)}</dd>
          )}
        </div>
        <div>
          <dt className="text-sm text-suave">Versões registradas</dt>
          <dd className="font-medium">
            {versions.length === 1
              ? "1 versão. A fonte não mudou desde a primeira coleta."
              : `${versions.length} versões. A fonte alterou este registro.`}
          </dd>
          {current && (
            <dd className="text-sm text-suave" title={current.payloadHash}>
              Impressão digital do conteúdo: {current.payloadHash.slice(0, HASH_PREVIEW_LENGTH)}…
            </dd>
          )}
        </div>
      </dl>

      {sourceMissingSince && (
        <p className="mt-6 border-l-4 border-alerta bg-fundo px-4 py-3">
          Este registro deixou de aparecer na fonte oficial em {formatDate(sourceMissingSince)}.
          Mantemos a última versão coletada.
        </p>
      )}

      <details data-analytics-explanation="origem-dos-dados" className="mt-6">
        <summary className="cursor-pointer font-medium">
          O que convertemos em relação ao original
        </summary>
        <ul className="mt-3 space-y-1.5 text-sm">
          {conversions.map((item) => (
            <li key={item.field}>
              {fieldLabels[item.field]}: a fonte publica “{show(item.from)}”, guardamos “
              {show(item.to)}”.
            </li>
          ))}
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
