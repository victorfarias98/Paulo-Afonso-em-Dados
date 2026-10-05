import { load } from "cheerio";
import { z } from "zod";

import {
  emptyToNull,
  inputValue,
  optionSchema,
  parseGrid,
  selectedOption,
  tableRows,
  textareaValue,
} from "./html";

export interface SigerWorkListItem {
  /** Identificador interno do SIGER. */
  id: string;
  numero: string;
}

export interface SigerWorkListPage {
  total: number;
  items: SigerWorkListItem[];
}

const addressSchema = z.object({
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
});

/** Campos da obra exatamente como publicados pelo SIGER (datas dd/mm/aaaa, valores "1.234,56"). */
export const sigerWorkSchema = z.object({
  id: z.string().regex(/^\d+$/),
  numero: z.string().min(1),
  descricao: z.string().nullable(),
  objeto: z.string().nullable(),
  dataCadastro: z.string().nullable(),
  dataInicio: z.string().nullable(),
  prazoDias: z.string().nullable(),
  valor: z.string().nullable(),
  status: optionSchema.nullable(),
  tipoObra: optionSchema.nullable(),
  funcaoObra: optionSchema.nullable(),
  /** Contrato e licitação a que a própria fonte vincula a obra (código = id interno). */
  contrato: optionSchema.nullable(),
  licitacao: optionSchema.nullable(),
  enderecos: z.array(addressSchema),
  documentos: z.array(z.object({ descricao: z.string().nullable(), arquivo: z.string().min(1) })),
});

export type SigerWorkPayload = z.infer<typeof sigerWorkSchema>;

/** Interpreta uma página da listagem pública de obras do SIGER. */
export function parseWorkList(html: string): SigerWorkListPage {
  const grid = parseGrid(load(html), "CadObrasListExterno_datagrid", "obras");
  return {
    total: grid.total,
    items: grid.rows.map((row) => ({ id: row.id, numero: row.cells[1] ?? "" })),
  };
}

/** Interpreta a página pública de detalhe de uma obra do SIGER. */
export function parseWorkDetail(html: string): SigerWorkPayload {
  const $ = load(html);
  const id = inputValue($, "id");
  const numero = inputValue($, "ob_numero");

  if (!id || !numero) {
    throw new Error("Página não reconhecida como detalhe da obra no SIGER.");
  }

  // Colunas: tipo, logradouro, número, complemento, bairro, cidade. Tipo e cidade
  // vêm como códigos internos sem significado público e não são guardados.
  const enderecos = tableRows($, "cad_endereco_obra_obra_list").map((cells) => ({
    logradouro: emptyToNull(cells[1]),
    numero: emptyToNull(cells[2]),
    complemento: emptyToNull(cells[3]),
    bairro: emptyToNull(cells[4]),
  }));

  const documentos = tableRows($, "cad_documentos_obra_obra_list")
    .map((cells) => ({ descricao: emptyToNull(cells[0]), arquivo: cells[1] ?? "" }))
    .filter((document) => document.arquivo !== "");

  return sigerWorkSchema.parse({
    id,
    numero,
    descricao: inputValue($, "ob_descricao"),
    objeto: textareaValue($, "ob_objeto"),
    dataCadastro: inputValue($, "ob_dtcadastro"),
    dataInicio: inputValue($, "ob_dtinicio"),
    prazoDias: inputValue($, "ob_prazo"),
    valor: inputValue($, "ob_valor"),
    status: selectedOption($, "ob_status"),
    tipoObra: selectedOption($, "ob_tipotc"),
    funcaoObra: selectedOption($, "ob_funcaotc"),
    contrato: selectedOption($, "id_contrato"),
    licitacao: selectedOption($, "id_licitacao"),
    enderecos,
    documentos,
  });
}
