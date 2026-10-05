const BR_MONEY = /^(?:R\$\s*)?(-?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/;
const BR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

type Nullable = string | null | undefined;

/**
 * Converte um valor no formato brasileiro ("454.404,56") em decimal com ponto
 * ("454404.56"). Devolve texto para não perder precisão em ponto flutuante.
 */
export function parseBrMoney(value: Nullable): string | null {
  const text = value?.trim() ?? "";
  if (text === "") return null;

  const match = BR_MONEY.exec(text);
  if (!match) {
    throw new Error(`Valor monetário não reconhecido: "${text}"`);
  }
  const [, sign = "", integerPart = "0", cents = ""] = match;
  return `${sign}${integerPart.replaceAll(".", "")}.${cents.padEnd(2, "0")}`;
}

/** Converte "dd/mm/aaaa" em "aaaa-mm-dd". Datas impossíveis geram erro. */
export function parseBrDate(value: Nullable): string | null {
  const text = value?.trim() ?? "";
  if (text === "") return null;

  const match = BR_DATE.exec(text);
  if (!match) {
    throw new Error(`Data inválida: "${text}"`);
  }
  const [, day = "", month = "", year = ""] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Data inválida: "${text}"`);
  }
  return iso;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const FORMATTED_CPF = /(?<!\d)\d{3}\.(\d{3})\.(\d{3})-\d{2}(?!\d)/g;

/**
 * Mascara todo CPF formatado de um texto ("123.456.789-09" → "***.456.789-**").
 * Usada na coleta, para que o CPF completo nunca chegue ao payload armazenado.
 */
export function redactCpf(text: string): string {
  return text.replace(FORMATTED_CPF, "***.$1.$2-**");
}

/** Forma canônica de um nome para comparação: sem acentos, maiúsculas, espaços simples. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
