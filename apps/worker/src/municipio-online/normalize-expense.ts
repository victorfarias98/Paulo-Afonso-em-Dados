import type { ExpensePhase, ExpenseRow } from "@pad/data-sources";
import type { Transformation } from "@pad/database";
import { parseBrDate, parseBrMoney, parseCreditor, type ParsedSupplier } from "@pad/domain";

export interface NormalizedExpense {
  record: {
    externalId: string;
    sourceUrl: string;
    fiscalYear: number;
    number: string | null;
    date: string | null;
    budgetUnit: string | null;
    expenseElement: string | null;
    description: string | null;
    legalBasis: string | null;
    /** Número da licitação/dispensa como aparece nos contratos (sem o ano repetido). */
    bidReference: string | null;
    /** Número do empenho citado pela liquidação ou pelo pagamento; null no próprio empenho. */
    commitmentNumber: string | null;
    commitmentDescription: string | null;
    value: string | null;
    cancelledValue: string | null;
    reinforcedValue: string | null;
    retainedValue: string | null;
  };
  agency: { name: string; alias: string } | null;
  supplier: ParsedSupplier | null;
  transformations: Transformation[];
}

/** Colunas que mudam de nome conforme a fase. */
const COLUMNS: Record<ExpensePhase, { number: string; value: string; cancelled: string }> = {
  commitment: { number: "Empenho", value: "Empenhado", cancelled: "Anulado" },
  liquidation: { number: "Liq", value: "Liquidado", cancelled: "Anulação" },
  payment: { number: "Processo", value: "Pago", cancelled: "Anulação" },
};

const YEAR_IN_KEY = /_(\d{4})$/;
const CODE_PREFIX = /^\d+\s*-\s*/;
const REPEATED_YEAR = /^(.+\/\d{4})\/\d{4}$/;

const text = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

/** "CR0012/2026/2026" → "CR0012/2026": a fonte repete o ano ao final do número da licitação. */
function bidReference(value: string | undefined): string | null {
  const reference = text(value);
  if (!reference) return null;
  return REPEATED_YEAR.exec(reference)?.[1] ?? reference;
}

/**
 * Identificador do registro: CNPJ da unidade gestora + chave da fonte. A chave
 * sozinha se repete entre unidades gestoras (Prefeitura, fundos de saúde,
 * educação...) — verificado nos dados de 2026, onde só o par é único.
 */
export function expenseKey(row: ExpenseRow): string {
  const unit = row.CNPJ?.replace(/\D/g, "") ?? "";
  const key = row.Chave?.trim() ?? "";
  if (unit === "") {
    throw new Error(`Registro ${key || "sem chave"} sem CNPJ da unidade gestora.`);
  }
  if (key === "") {
    throw new Error("Registro sem chave.");
  }
  return `${unit}:${key}`;
}

/** Converte uma linha de empenho, liquidação ou pagamento do Município Online. */
export function normalizeExpense(
  phase: ExpensePhase,
  row: ExpenseRow,
  pageUrl: string,
): NormalizedExpense {
  const key = row.Chave ?? "";
  const year = YEAR_IN_KEY.exec(key)?.[1];
  if (!year) {
    throw new Error(`Chave sem ano reconhecível: "${key}"`);
  }
  const externalId = expenseKey(row);

  const columns = COLUMNS[phase];
  const date = parseBrDate(row.Data);
  const value = parseBrMoney(row[columns.value]);
  const agencyAlias = text(row["Órgão"]);
  const creditorName = text(row.Credor);
  const rawBidReference = row["Licitacao/Dispensa/Inexigibilidade"];
  const reference = bidReference(rawBidReference);

  return {
    record: {
      externalId,
      sourceUrl: pageUrl,
      fiscalYear: Number(year),
      number: text(row[columns.number]),
      date,
      budgetUnit: text(row.Unidade),
      expenseElement: text(row.Elemento),
      description: text(row["Histórico"]) ?? text(row.DsEmpenho),
      legalBasis: text(row.NmBaseLegal),
      bidReference: reference,
      commitmentNumber: phase === "commitment" ? null : text(row.Empenho),
      commitmentDescription: text(row.DsEmpenho),
      value,
      cancelledValue: parseBrMoney(row[columns.cancelled]),
      reinforcedValue: parseBrMoney(row["Reforçado"]),
      retainedValue: parseBrMoney(row.Retido),
    },
    agency: agencyAlias
      ? { name: agencyAlias.replace(CODE_PREFIX, ""), alias: agencyAlias }
      : null,
    supplier: creditorName ? parseCreditor(row["CPF/CNPJ Credor"] ?? "", creditorName) : null,
    transformations: [
      { field: "value", from: row[columns.value] ?? null, to: value, rule: "br_money_to_decimal" },
      { field: "date", from: row.Data ?? null, to: date, rule: "br_date_to_iso" },
      {
        field: "bidReference",
        from: text(rawBidReference),
        to: reference,
        rule: "drop_repeated_year",
      },
    ],
  };
}
