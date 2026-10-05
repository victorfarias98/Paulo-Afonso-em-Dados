import { type CheerioAPI, load } from "cheerio";
import { z } from "zod";

import {
  collapse,
  inputValue,
  optionSchema,
  selectedOption,
  textareaValue,
} from "./html";

/**
 * Campos do contrato exatamente como publicados pelo SIGER (datas dd/mm/aaaa,
 * valores "1.234,56"). A única alteração feita na coleta é mascarar CPF.
 */
export const sigerContractSchema = z.object({
  id: z.string().regex(/^\d+$/),
  numero: z.string().min(1),
  licitacao: z.string().nullable(),
  processo: z.string().nullable(),
  aditivo: z.string().nullable(),
  dataAssinatura: z.string().nullable(),
  dataVencimento: z.string().nullable(),
  dataCadastro: z.string().nullable(),
  valor: z.string().nullable(),
  competencia: z.string().nullable(),
  objeto: z.string().nullable(),
  fiscal: z.string().nullable(),
  gestor: z.string().nullable(),
  fornecedor: optionSchema.nullable(),
  modalidade: optionSchema.nullable(),
  tipoContrato: optionSchema.nullable(),
  status: optionSchema.nullable(),
  situacao: optionSchema.nullable(),
  secretarias: z.array(z.string().min(1)),
  dotacoes: z.array(z.string().min(1)),
});

export type SigerContractPayload = z.infer<typeof sigerContractSchema>;

function firstCellTexts($: CheerioAPI, tableId: string): string[] {
  return $(`#${tableId} tbody tr`)
    .toArray()
    .map((row) => {
      const cell = $(row).find("td").first();
      const label = cell.find("label").first();
      return collapse((label.length > 0 ? label : cell).text().replace(/-{5,}/g, " "));
    })
    .filter((text) => text !== "");
}

/** Interpreta a página pública de detalhe de um contrato do SIGER. */
export function parseContractDetail(html: string): SigerContractPayload {
  const $ = load(html);
  const id = inputValue($, "id");
  const numero = inputValue($, "con_numero");

  if (!id || !numero) {
    throw new Error("Página não reconhecida como detalhe do contrato no SIGER.");
  }

  return sigerContractSchema.parse({
    id,
    numero,
    licitacao: inputValue($, "con_licitacao"),
    processo: inputValue($, "con_processo"),
    // Campo de seleção: preenchido (ex.: "1º") só quando o registro é um termo aditivo.
    aditivo: selectedOption($, "con_aditivo")?.rotulo ?? null,
    dataAssinatura: inputValue($, "con_dt_ini"),
    dataVencimento: inputValue($, "con_dt_fim"),
    dataCadastro: inputValue($, "con_dt_cadastro"),
    valor: inputValue($, "con_valor"),
    competencia: inputValue($, "con_competencia"),
    objeto: textareaValue($, "con_objeto"),
    fiscal: inputValue($, "con_fiscal"),
    gestor: inputValue($, "con_gestor"),
    fornecedor: selectedOption($, "id_fornecedor"),
    modalidade: selectedOption($, "con_modalidade"),
    tipoContrato: selectedOption($, "con_tipo_contrato"),
    status: selectedOption($, "con_status"),
    situacao: selectedOption($, "con_situacao"),
    secretarias: firstCellTexts($, "cad_contrato_secretaria_contrato_list"),
    dotacoes: firstCellTexts($, "cad_contrato_dotacao_contrato_list"),
  });
}
