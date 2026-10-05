import { redactCpf } from "@pad/domain";
import type { CheerioAPI } from "cheerio";
import { z } from "zod";

/** Opção selecionada de um campo de seleção do SIGER: código interno e texto exibido. */
export const optionSchema = z.object({ codigo: z.string(), rotulo: z.string().min(1) });
export type SigerOption = z.infer<typeof optionSchema>;

export interface GridRow {
  /** Identificador interno do registro, lido de `row_<id>`. */
  id: string;
  cells: string[];
}

export interface Grid {
  /** Total de registros anunciado pela fonte no rodapé da listagem. */
  total: number;
  rows: GridRow[];
}

const TOTAL = /de\s+([\d.]+)\s+registros/i;
const ROW_ID = /^row_(\d+)$/;

export const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

export function emptyToNull(text: string | undefined): string | null {
  const value = collapse(text ?? "");
  return value === "" ? null : value;
}

export function inputValue($: CheerioAPI, name: string): string | null {
  return emptyToNull($(`input[name="${name}"]`).first().attr("value"));
}

export function textareaValue($: CheerioAPI, name: string): string | null {
  return emptyToNull($(`textarea[name="${name}"]`).first().text());
}

/** Lê somente a opção selecionada; as demais opções do campo são ignoradas. CPF é mascarado. */
export function selectedOption($: CheerioAPI, name: string): SigerOption | null {
  const option = $(`select[name="${name}"] option[selected]`).first();
  const rotulo = emptyToNull(option.text());
  if (!rotulo) return null;
  return { codigo: option.attr("value") ?? "", rotulo: redactCpf(rotulo) };
}

/** Texto das células de cada linha de uma tabela interna do formulário. */
export function tableRows($: CheerioAPI, tableId: string): string[][] {
  return $(`#${tableId} tbody tr`)
    .toArray()
    .map((row) =>
      $(row)
        .find("td")
        .toArray()
        .map((cell) => collapse($(cell).text())),
    );
}

/** Lê uma listagem pública do SIGER; `entity` entra na mensagem de erro de layout. */
export function parseGrid($: CheerioAPI, gridId: string, entity: string): Grid {
  const grid = $(`#${gridId}`);
  const totalMatch = TOTAL.exec($(".tpagenavigation_resume").text());

  if (grid.length === 0 || !totalMatch?.[1]) {
    throw new Error(`Página não reconhecida como listagem de ${entity} do SIGER.`);
  }

  const rows = grid
    .find("tbody tr")
    .toArray()
    .map((row): GridRow => {
      const id = ROW_ID.exec($(row).attr("id") ?? "")?.[1];
      if (!id) {
        throw new Error(`Linha da listagem de ${entity} sem identificador interno.`);
      }
      const cells = $(row)
        .find("td")
        .toArray()
        .map((cell) => collapse($(cell).text()));
      return { id, cells };
    });

  return { total: Number(totalMatch[1].replaceAll(".", "")), rows };
}
