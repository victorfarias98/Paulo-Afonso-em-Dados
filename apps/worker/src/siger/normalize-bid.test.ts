import type { SigerBidPayload } from "@pad/data-sources";
import { describe, expect, test } from "vitest";

import { normalizeSigerBid } from "./normalize-bid";

const payload: SigerBidPayload = {
  id: "2116",
  numero: "PE0080/2026",
  processo: "001584/000138/2026",
  valor: "680.786,48",
  dataInicioDisputa: "02/10/2026",
  dataPublicacao: "15/09/2026",
  dataHomologacao: null,
  dataRatificacao: null,
  imprensa: "DIARIO OFICIAL",
  objeto: "CONTRATAÇÃO DE EMPRESA ESPECIALIZADA",
  modalidade: { codigo: "6", rotulo: "PE - PREGÃO ELETRÔNICO" },
  orgao: { codigo: "10", rotulo: "SECRETARIA MUNICIPAL DE EDUCACAO" },
  criterio: { codigo: "C", rotulo: "12 - (Lei 14133/21) Menor preço" },
  status: { codigo: "1", rotulo: "Publicado" },
  participantes: [],
};

const baseUrl = "https://sigerweb.net.br/pm_pauloafonso";

describe("normalizeSigerBid", () => {
  const result = normalizeSigerBid(payload, { baseUrl });

  test("converts value and dates and builds the official page URL", () => {
    expect(result.bid).toMatchObject({
      externalId: "2116",
      number: "PE0080/2026",
      modality: "PE - PREGÃO ELETRÔNICO",
      processNumber: "001584/000138/2026",
      description: "CONTRATAÇÃO DE EMPRESA ESPECIALIZADA",
      estimatedValue: "680786.48",
      publishedAt: "2026-09-15",
      openingDate: "2026-10-02",
    });
    expect(result.bid.sourceUrl).toBe(
      `${baseUrl}/index.php?class=LicLicitacaoFormExternoView&method=onEdit&key=2116&id=2116`,
    );
  });

  test("keeps the source status text and stores a stable key for filtering", () => {
    expect(result.bid.sourceStatus).toBe("Publicado");
    expect(result.bid.status).toBe("publicado");
    expect(
      normalizeSigerBid({ ...payload, status: { codigo: "3", rotulo: "Homologado e Adjudicado" } }, { baseUrl })
        .bid.status,
    ).toBe("homologado_e_adjudicado");
  });

  test("is 'informacao_insuficiente' when the source publishes no status", () => {
    expect(normalizeSigerBid({ ...payload, status: null }, { baseUrl }).bid.status).toBe(
      "informacao_insuficiente",
    );
  });

  test("passes the agency name through and records the conversions", () => {
    expect(result.agencyName).toBe("SECRETARIA MUNICIPAL DE EDUCACAO");
    expect(result.transformations.map((item) => item.field)).toEqual(
      expect.arrayContaining(["estimatedValue", "publishedAt", "openingDate"]),
    );
  });
});
