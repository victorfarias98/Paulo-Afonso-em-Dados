import { normalizeName } from "./parse";

export type WorkStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "paralisada"
  | "em_fiscalizacao"
  | "concluida"
  | "prazo_vencido"
  | "informacao_insuficiente";

export interface WorkStatusInput {
  /** Situação como publicada pela fonte (ex.: "Em andamento", "Paralisada"). */
  sourceStatus: string | null;
  /** Data prevista de término, em AAAA-MM-DD. */
  expectedEndDate: string | null;
  /** Data de referência, em AAAA-MM-DD. */
  today: string;
}

/** Rótulos do SIGER (sem acento, em maiúsculas) e a situação correspondente. */
const BY_SOURCE_LABEL: Record<string, WorkStatus> = {
  "NAO INICIADA": "nao_iniciada",
  "EM ANDAMENTO": "em_andamento",
  PARALISADA: "paralisada",
  "EM FISCALIZACAO": "em_fiscalizacao",
  CONCLUIDA: "concluida",
  "RECBTO PROVISORIO": "concluida",
  "RECBTO DEFINITIVO": "concluida",
};

const MS_PER_DAY = 86_400_000;

/** Soma dias a uma data AAAA-MM-DD, em UTC para não sofrer com fuso ou horário de verão. */
export function addDays(isoDate: string, days: number): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`) + days * MS_PER_DAY;
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Situação objetiva da obra. Regras, em ordem:
 * 1. a fonte não informa situação, ou informa uma desconhecida → "informacao_insuficiente"
 * 2. a fonte informa conclusão ou recebimento                  → "concluida"
 * 3. há data prevista de término e ela já passou               → "prazo_vencido"
 * 4. caso contrário                                            → a situação informada pela fonte
 *
 * A regra 3 vale para qualquer obra não concluída, inclusive paralisada. O
 * último dia do prazo ainda está dentro do prazo.
 */
export function deriveWorkStatus(input: WorkStatusInput): WorkStatus {
  const fromSource = input.sourceStatus
    ? BY_SOURCE_LABEL[normalizeName(input.sourceStatus)]
    : undefined;

  if (!fromSource) return "informacao_insuficiente";
  if (fromSource === "concluida") return "concluida";
  if (input.expectedEndDate && input.expectedEndDate < input.today) return "prazo_vencido";
  return fromSource;
}
