import { redactCpf } from "@pad/domain";
import { load } from "cheerio";

import type { FetchText } from "../http";

/** Fases da despesa pública publicadas pelo Município Online. */
export type ExpensePhase = "commitment" | "liquidation" | "payment";

/** Uma linha da tabela, com as colunas nomeadas como na fonte e os valores como texto. */
export type ExpenseRow = Record<string, string>;

export interface MunicipioOnlineClient {
  /** Registros de uma fase em um mês (1 a 12) de um ano. */
  fetchMonth(phase: ExpensePhase, year: number, month: number): Promise<ExpenseRow[]>;
}

export interface MunicipioOnlineClientOptions {
  /** Ex.: https://www.municipioonline.com.br/ba/prefeitura/pauloafonso/cidadao/despesa */
  pageUrl: string;
  fetchText: FetchText;
}

/** Nome da aba no formulário da fonte e o nome usado nas mensagens de erro. */
const TABS: Record<ExpensePhase, { tab: string; label: string }> = {
  commitment: { tab: "Empenhos", label: "empenhos" },
  liquidation: { tab: "Liquidacoes", label: "liquidações" },
  payment: { tab: "Pagamentos", label: "pagamentos" },
};

const KEY_COLUMN = "Chave";
const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Interpreta a tabela de uma fase da despesa na página do Município Online. */
export function parseExpenseTable(html: string, phase: ExpensePhase): ExpenseRow[] {
  const $ = load(html);
  const { tab, label } = TABS[phase];
  const table = $(`#dataTables-${tab}`);
  const headers = table
    .find("thead th")
    .toArray()
    .map((cell) => collapse($(cell).text()));

  if (table.length === 0 || !headers.includes(KEY_COLUMN)) {
    throw new Error(`Tabela de ${label} não encontrada na página do Município Online.`);
  }

  return (
    table
      .find("tbody tr")
      .toArray()
      .map((row) => $(row).find("td").toArray())
      // Tabela vazia vem com uma única célula de aviso ocupando todas as colunas.
      .filter((cells) => cells.length === headers.length)
      .map((cells) => {
        const entries = headers
          .map((header, index) => [header, redactCpf(collapse($(cells[index]).text()))] as const)
          .filter(([header]) => header !== "");
        const record: ExpenseRow = Object.fromEntries(entries);
        if (!record[KEY_COLUMN]) {
          throw new Error(`Linha de ${label} sem chave na página do Município Online.`);
        }
        return record;
      })
  );
}

function hiddenFields(html: string): Record<string, string> {
  const $ = load(html);
  const fields: Record<string, string> = {};
  for (const input of $('input[type="hidden"]').toArray()) {
    const name = $(input).attr("name");
    if (name) fields[name] = $(input).attr("value") ?? "";
  }
  return fields;
}

/**
 * Cliente da página de despesas. A fonte é um formulário ASP.NET: cada consulta
 * reenvia o estado da página recebido na resposta anterior, mais ano e mês.
 */
export function createMunicipioOnlineClient(
  options: MunicipioOnlineClientOptions,
): MunicipioOnlineClient {
  const { pageUrl, fetchText } = options;
  let formState: Record<string, string> | null = null;

  return {
    async fetchMonth(phase, year, month) {
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error(`Mês inválido: ${String(month)}`);
      }
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new Error(`Ano inválido: ${String(year)}`);
      }

      formState ??= hiddenFields(await fetchText(pageUrl));
      const { tab } = TABS[phase];
      const body = new URLSearchParams({
        ...formState,
        [`ctl00$body$hfAno${tab}`]: String(year),
        [`ctl00$body$hfMes${tab}`]: String(month).padStart(2, "0"),
        [`ctl00$body$btnFiltrar${tab}S`]: "Button",
      }).toString();

      const html = await fetchText(pageUrl, { body });
      const nextState = hiddenFields(html);
      if (nextState.__VIEWSTATE) formState = nextState;
      return parseExpenseTable(html, phase);
    },
  };
}
