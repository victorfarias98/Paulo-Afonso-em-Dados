/**
 * As fontes oficiais publicam quase tudo EM MAIÚSCULAS. Para leitura, o portal
 * mostra em caixa normal os NOMES (secretarias, empresas, obras, bairros). É só
 * apresentação: o dado guardado continua exatamente como a fonte publicou.
 *
 * Descrições longas não são convertidas: elas trazem nomes de pessoas e lugares
 * que ficariam escritos errado em minúsculas.
 */

/** Palavras que ficam em minúsculas no meio de um nome. */
const SMALL_WORDS = new Set([
  "a", "à", "ao", "aos", "as", "às", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas",
  "no", "nos", "o", "os", "ou", "para", "pela", "pelo", "por", "sem", "sob", "um", "uma",
]);

/** Siglas que continuam em maiúsculas. */
const ACRONYMS = new Set([
  "BA", "BTN", "CAPS", "CEO", "CMPA", "CNPJ", "CPF", "CRAS", "CREAS", "EPI", "EPP", "FMS", "GLP",
  "IPTU", "ISS", "ME", "MEI", "NASF", "PMPA", "PSF", "SA", "SAMU", "SUS", "TI", "UBS", "UPA", "UTI",
]);

/** Formas fixas de escrever algumas palavras. */
const FIXED: Record<string, string> = { LTDA: "Ltda", EIRELI: "Eireli" };

const ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const HAS_LETTER = /\p{L}/u;
const HAS_LOWER = /\p{Ll}/u;
const EDGE_PUNCTUATION = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u;
const JOINER = /([-/])/;

/** Verdadeiro quando o texto tem letras e nenhuma delas é minúscula. */
export function isAllCaps(text: string): boolean {
  return HAS_LETTER.test(text) && !HAS_LOWER.test(text);
}

const upper = (text: string): string => text.toLocaleUpperCase("pt-BR");
const lower = (text: string): string => text.toLocaleLowerCase("pt-BR");
const capitalize = (word: string): string => upper(word.charAt(0)) + lower(word.slice(1));

/** Sigla, número romano de mais de uma letra ou código com dígitos: fica como está. */
function keepsCase(part: string): boolean {
  const text = upper(part);
  return ACRONYMS.has(text) || /\d/.test(part) || (part.length > 1 && ROMAN.test(text));
}

/** Aplica `convert` a cada pedaço de cada palavra, preservando pontuação, hífens e barras. */
function mapWords(text: string, convert: (part: string, isFirstWord: boolean) => string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((token, index) => {
      const [, before = "", core = "", after = ""] = EDGE_PUNCTUATION.exec(token) ?? [];
      if (core === "") return token;
      const converted = core
        .split(JOINER)
        .map((part) => {
          if (part === "" || JOINER.test(part)) return part;
          if (keepsCase(part)) return upper(part);
          return FIXED[upper(part)] ?? convert(part, index === 0);
        })
        .join("");
      return `${before}${converted}${after}`;
    })
    .join(" ");
}

/**
 * Nome próprio em caixa normal: "SECRETARIA MUNICIPAL DE SAÚDE" vira
 * "Secretaria Municipal de Saúde". Texto que já tem minúsculas não é alterado,
 * e nenhum acento é acrescentado.
 */
export function plainName(text: string): string {
  if (!isAllCaps(text)) return text;
  return mapWords(text, (part, isFirstWord) => {
    const small = lower(part);
    // "I" sozinho no fim de um nome é numeral ("BTN I"), não a conjunção.
    if (part === "I") return part;
    return !isFirstWord && SMALL_WORDS.has(small) ? small : capitalize(part);
  });
}

const CODE_PREFIX = /^[A-Z]{2,3}\s*-\s*/;

/**
 * Tipo de licitação sem o código da fonte: "PE - PREGÃO ELETRÔNICO" vira
 * "Pregão Eletrônico".
 */
export function plainModality(text: string): string {
  return plainName(text.replace(CODE_PREFIX, ""));
}
