import type { SigerBidPayload } from "@pad/data-sources";
import type { Transformation } from "@pad/database";
import { normalizeName, parseBrDate, parseBrMoney } from "@pad/domain";

export interface NormalizedBid {
  bid: {
    externalId: string;
    sourceUrl: string;
    number: string;
    modality: string | null;
    processNumber: string | null;
    description: string | null;
    estimatedValue: string | null;
    /** Valor homologado, quando a fonte o publica. */
    homologatedValue?: string | null;
    publishedAt: string | null;
    openingDate: string | null;
    sourceStatus: string | null;
    /** Chave estável derivada do texto da fonte, usada só para filtrar. */
    status: string;
  };
  agencyName: string | null;
  transformations: Transformation[];
}

export function bidPageUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/index.php?class=LicLicitacaoFormExternoView&method=onEdit&key=${id}&id=${id}`;
}

/** "Homologado e Adjudicado" → "homologado_e_adjudicado". Não interpreta: só padroniza a grafia. */
export function statusKey(label: string | null): string {
  if (!label) return "informacao_insuficiente";
  return normalizeName(label).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

/**
 * Converte o registro bruto de licitação do SIGER. A situação da licitação não
 * é calculada: o portal mostra o texto da fonte.
 */
export function normalizeSigerBid(payload: SigerBidPayload, options: { baseUrl: string }): NormalizedBid {
  const estimatedValue = parseBrMoney(payload.valor);
  const publishedAt = parseBrDate(payload.dataPublicacao);
  const openingDate = parseBrDate(payload.dataInicioDisputa);
  const sourceStatus = payload.status?.rotulo ?? null;

  return {
    bid: {
      externalId: payload.id,
      sourceUrl: bidPageUrl(options.baseUrl, payload.id),
      number: payload.numero,
      modality: payload.modalidade?.rotulo ?? null,
      processNumber: payload.processo,
      description: payload.objeto,
      estimatedValue,
      publishedAt,
      openingDate,
      sourceStatus,
      status: statusKey(sourceStatus),
    },
    agencyName: payload.orgao?.rotulo ?? null,
    transformations: [
      { field: "estimatedValue", from: payload.valor, to: estimatedValue, rule: "br_money_to_decimal" },
      { field: "publishedAt", from: payload.dataPublicacao, to: publishedAt, rule: "br_date_to_iso" },
      { field: "openingDate", from: payload.dataInicioDisputa, to: openingDate, rule: "br_date_to_iso" },
    ],
  };
}
