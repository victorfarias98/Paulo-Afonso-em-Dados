export type ContractStatus =
  | "vigente"
  | "vigencia_encerrada"
  | "cancelado"
  | "informacao_insuficiente";

export interface ContractStatusInput {
  /** Situação como publicada pela fonte (ex.: "NORMAL", "CANCELADO", "VENCIDO"). */
  sourceStatus: string | null;
  /** Data final de vigência, em AAAA-MM-DD. */
  endsAt: string | null;
  /** Data de referência, em AAAA-MM-DD. */
  today: string;
}

/**
 * Situação objetiva do contrato. Regras, em ordem:
 * 1. a fonte informa cancelamento                → "cancelado"
 * 2. não há data final de vigência               → "informacao_insuficiente"
 * 3. data final anterior à data de referência    → "vigencia_encerrada"
 * 4. caso contrário (inclui o último dia)        → "vigente"
 *
 * A vigência é calculada pela data, não pelo rótulo da fonte, porque o rótulo
 * pode estar desatualizado. Datas ISO comparam corretamente como texto.
 */
export function deriveContractStatus(input: ContractStatusInput): ContractStatus {
  if (input.sourceStatus?.trim().toUpperCase().startsWith("CANCELAD")) {
    return "cancelado";
  }
  if (!input.endsAt) {
    return "informacao_insuficiente";
  }
  return input.endsAt < input.today ? "vigencia_encerrada" : "vigente";
}
