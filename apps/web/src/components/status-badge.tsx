import { STATUS_LABELS } from "@/lib/contract-filters";
import { WORK_STATUS_LABELS } from "@/lib/work-filters";

type Tone = "ativo" | "neutro" | "alerta" | "indefinido";

/** Situações de contratos e de obras; a chave em comum tem o mesmo rótulo nos dois. */
const LABELS: Record<string, string> = { ...STATUS_LABELS, ...WORK_STATUS_LABELS };

const TONES: Record<string, Tone> = {
  vigente: "ativo",
  em_andamento: "ativo",
  em_fiscalizacao: "ativo",
  vigencia_encerrada: "neutro",
  concluida: "neutro",
  nao_iniciada: "neutro",
  cancelado: "alerta",
  paralisada: "alerta",
  prazo_vencido: "alerta",
};

const STYLES: Record<Tone, string> = {
  ativo: "bg-azul/10 text-azul-forte",
  neutro: "bg-superficie text-suave",
  alerta: "bg-alerta/10 text-alerta",
  indefinido: "border border-dashed border-suave/60 text-suave",
};

type Props = {
  /** Situação calculada pelo portal. */
  status: string;
  /** Texto publicado pela fonte, quando a situação não é calculada por nós (licitações). */
  label?: string;
};

export function StatusBadge({ status, label: sourceLabel }: Props) {
  const label = sourceLabel ?? LABELS[status] ?? LABELS.informacao_insuficiente;
  const tone = sourceLabel ? "neutro" : (TONES[status] ?? "indefinido");

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ${STYLES[tone]}`}
    >
      {label}
    </span>
  );
}
