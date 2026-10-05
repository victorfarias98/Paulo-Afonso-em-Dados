import { redactCpf } from "@pad/domain";
import { load } from "cheerio";
import { z } from "zod";

import {
  inputValue,
  optionSchema,
  parseGrid,
  selectedOption,
  tableRows,
  textareaValue,
} from "./html";

export interface SigerBidListItem {
  /** Identificador interno do SIGER. */
  id: string;
  numero: string;
}

export interface SigerBidListPage {
  total: number;
  items: SigerBidListItem[];
}

/** Campos da licitação exatamente como publicados pelo SIGER. */
export const sigerBidSchema = z.object({
  id: z.string().regex(/^\d+$/),
  numero: z.string().min(1),
  processo: z.string().nullable(),
  valor: z.string().nullable(),
  dataInicioDisputa: z.string().nullable(),
  dataPublicacao: z.string().nullable(),
  dataHomologacao: z.string().nullable(),
  dataRatificacao: z.string().nullable(),
  imprensa: z.string().nullable(),
  objeto: z.string().nullable(),
  modalidade: optionSchema.nullable(),
  orgao: optionSchema.nullable(),
  /** Critério de julgamento (ex.: menor preço). */
  criterio: optionSchema.nullable(),
  status: optionSchema.nullable(),
  /**
   * Linhas da aba "Participantes" como texto, com CPF mascarado. Ficam só no
   * registro bruto: a estrutura ainda não foi confirmada com um caso real.
   */
  participantes: z.array(z.array(z.string())),
});

export type SigerBidPayload = z.infer<typeof sigerBidSchema>;

/** Interpreta uma página da listagem pública de licitações do SIGER. */
export function parseBidList(html: string): SigerBidListPage {
  const grid = parseGrid(load(html), "LicLicitacaoListExterno_datagrid", "licitações");
  return {
    total: grid.total,
    items: grid.rows.map((row) => ({ id: row.id, numero: row.cells[1] ?? "" })),
  };
}

/** Interpreta a página pública de detalhe de uma licitação do SIGER. */
export function parseBidDetail(html: string): SigerBidPayload {
  const $ = load(html);
  const id = inputValue($, "id");
  const numero = inputValue($, "lic_numero");

  if (!id || !numero) {
    throw new Error("Página não reconhecida como detalhe da licitação no SIGER.");
  }

  // A última coluna da tabela é um campo oculto de controle e é descartada.
  const participantes = tableRows($, "lic_licitacao_fornecedor_licitacao_list")
    .map((cells) => cells.slice(0, -1).map(redactCpf))
    .filter((cells) => cells.some((cell) => cell !== ""));

  return sigerBidSchema.parse({
    id,
    numero,
    processo: inputValue($, "lic_processo"),
    valor: inputValue($, "lic_valor"),
    dataInicioDisputa: inputValue($, "lic_dt_inicio"),
    dataPublicacao: inputValue($, "lic_dt_publicacao"),
    dataHomologacao: inputValue($, "lic_dt_homologacao"),
    dataRatificacao: inputValue($, "lic_dt_ratificacao"),
    imprensa: inputValue($, "lic_imprensa"),
    objeto: textareaValue($, "lic_objeto"),
    modalidade: selectedOption($, "lic_modalidade_siga"),
    orgao: selectedOption($, "id_orgao"),
    criterio: selectedOption($, "lic_tipo"),
    status: selectedOption($, "lic_status"),
    participantes,
  });
}
