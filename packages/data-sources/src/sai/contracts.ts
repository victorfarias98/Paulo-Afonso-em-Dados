import { redactCpf } from "@pad/domain";
import { z } from "zod";

import type { FetchText } from "../http";

/** Contrato como devolvido pela API do portal da Câmara (SAI/IMAP). Campos não usados são ignorados. */
export const saiContractSchema = z.object({
  CodigoContrato: z.number(),
  NumeroContrato: z.string().min(1),
  OrigemRegistro: z.string().min(1),
  Objeto: z.string().nullable(),
  NumeroProcessoLicitatorio: z.string().nullable(),
  DataInicioVigencia: z.string().nullable(),
  DataFimVigencia: z.string().nullable(),
  DataAssinatura: z.string().nullable(),
  Modalidade: z.string().nullable(),
  Contratado: z.string().nullable(),
  CNPJ_CPF: z.string().nullable(),
  Valor: z.string().nullable(),
  TipoContrato: z.string().nullable(),
});

export type SaiContract = z.infer<typeof saiContractSchema>;

export interface SaiClient {
  listContracts(): Promise<SaiContract[]>;
}

export interface SaiClientOptions {
  /** Ex.: https://sai2.io.org.br/v3 */
  apiUrl: string;
  /** Identifica o órgão para a API. Câmara de Paulo Afonso: "ba/camarapauloafonso". */
  govPath: string;
  /** Código do órgão na API. Câmara de Paulo Afonso: 2370. */
  orgCode: number;
  fetchText: FetchText;
}

/**
 * Identificador do contrato: origem + código + número. O código sozinho se
 * repete (146 códigos para 176 contratos, verificado em 2026-10-04).
 */
export function saiContractKey(contract: SaiContract): string {
  return `${contract.OrigemRegistro}:${contract.CodigoContrato}:${contract.NumeroContrato}`;
}

/** Valida a resposta da API e mascara qualquer CPF completo antes de o dado seguir adiante. */
export function parseSaiContracts(json: string): SaiContract[] {
  const data: unknown = JSON.parse(redactCpf(json));
  return z.array(saiContractSchema).parse(data);
}

export function createSaiClient(options: SaiClientOptions): SaiClient {
  const { apiUrl, govPath, orgCode, fetchText } = options;

  return {
    async listContracts() {
      const body = JSON.stringify({
        contratado: "",
        valor: "",
        bit_aditivo: "",
        objeto: "",
        cnpj_cpf: "",
        numeroContrato: "",
        dataInicioVigencia: "",
        dataFimVigencia: "",
        cod_tipo_contrato_tic: "",
        palavra_chave: "",
        exercicio: "",
        cod_orgao_org: orgCode,
        id: null,
      });
      const json = await fetchText(`${apiUrl}/contrato/ListarContratos`, {
        body,
        contentType: "application/json",
        headers: { "gov-path": govPath, Accept: "application/json" },
      });
      return parseSaiContracts(json);
    },
  };
}
