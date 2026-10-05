import { redactCpf } from "@pad/domain";
import { z } from "zod";

import type { FetchText } from "../http";

/**
 * Licitação como devolvida por `Licitacao/Filtro` na API do portal da Câmara
 * (verificado em 2026-10-05). `DataLicitacao` falta em parte dos registros
 * antigos; os valores vêm como número e são 0 quando não informados.
 */
export const saiBidSchema = z.object({
  NumeroLicitacao: z.string().min(1),
  NumeroProcesso: z.string().nullable(),
  Objeto: z.string().nullable(),
  Tabela: z.number(),
  Detalhes: z.union([z.string(), z.number()]).transform(String),
  Modalidade: z.string().nullable(),
  Status: z.string().nullable(),
  DataLicitacao: z.string().nullable().optional(),
  ValorEstimado: z.number().nullable().optional(),
  ValorHomologado: z.number().nullable().optional(),
});

export type SaiBid = z.infer<typeof saiBidSchema>;

const yearOptionSchema = z.object({ Value: z.string().regex(/^\d{4}$/) });

export interface SaiBidsClient {
  /** Anos para os quais a fonte diz ter licitações. */
  listBidYears(): Promise<number[]>;
  listBids(year: number): Promise<SaiBid[]>;
}

export interface SaiBidsClientOptions {
  /** Ex.: https://sai2.io.org.br/v3 */
  apiUrl: string;
  govPath: string;
  orgCode: number;
  fetchText: FetchText;
}

/**
 * Identificador da licitação: tabela de origem + código interno. O número da
 * licitação se repete entre modalidades (ex.: "001/2019" aparece 5 vezes).
 */
export function saiBidKey(bid: SaiBid): string {
  return `${bid.Tabela}:${bid.Detalhes}`;
}

/** Valida a resposta da API e mascara qualquer CPF completo antes de o dado seguir adiante. */
export function parseSaiBids(json: string): SaiBid[] {
  const data: unknown = JSON.parse(redactCpf(json));
  return z.array(saiBidSchema).parse(data);
}

export function parseSaiBidYears(json: string): number[] {
  const data: unknown = JSON.parse(json);
  return z
    .array(yearOptionSchema)
    .parse(data)
    .map((option) => Number(option.Value));
}

export function createSaiBidsClient(options: SaiBidsClientOptions): SaiBidsClient {
  const { apiUrl, govPath, orgCode, fetchText } = options;
  const headers = { "gov-path": govPath, Accept: "application/json" };

  return {
    async listBidYears() {
      return parseSaiBidYears(
        await fetchText(`${apiUrl}/Licitacao/DropDownAnosLicitacao?cod_orgao_org=${orgCode}`, {
          headers,
        }),
      );
    },

    async listBids(year) {
      // Mesmo corpo que o formulário de busca do portal envia, só com o ano preenchido.
      const body = JSON.stringify({
        Ano: String(year),
        Mes: null,
        NumeroProcesso: "",
        Objeto: "",
        cod_orgao_org: orgCode,
        Modalidade: "",
        Status: "",
        cod_licitacao_contrato_situacao_certame_lcs: "",
        Fase: "",
        order: "",
        desc: "",
        Bit_Covid: "",
        cnpjOrCpf: "",
        num_edital: "",
        dataInicio: "",
        dataFim: "",
        _bit_registro_preco_mod: "",
        palavraChave: "",
      });
      return parseSaiBids(
        await fetchText(`${apiUrl}/Licitacao/Filtro`, {
          body,
          contentType: "application/json",
          headers,
        }),
      );
    },
  };
}
