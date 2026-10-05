import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseBidDetail, parseBidList } from "./bid";

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseBidList", () => {
  const page = parseBidList(fixture("licitacao-lista-pagina-1.html"));

  test("reads the total and the internal id of every row", () => {
    expect(page.total).toBe(631);
    expect(page.items).toHaveLength(20);
    expect(page.items[0]).toEqual({ id: "2116", numero: "PE0080/2026" });
  });

  test("throws when the page is not the bids list", () => {
    expect(() => parseBidList("<html></html>")).toThrow(/listagem de licitações/i);
  });
});

describe("parseBidDetail", () => {
  const bid = parseBidDetail(fixture("licitacao-detalhe-2116.html"));

  test("keeps the published fields without converting them", () => {
    expect(bid).toMatchObject({
      id: "2116",
      numero: "PE0080/2026",
      processo: "001584/000138/2026",
      valor: "680.786,48",
      dataInicioDisputa: "02/10/2026",
      dataPublicacao: "15/09/2026",
      dataHomologacao: null,
      imprensa: "DIARIO OFICIAL",
    });
    expect(bid.objeto).toMatch(/^CONTRATAÇÃO DE EMPRESA ESPECIALIZADA/);
  });

  test("reads only the selected option of each select", () => {
    expect(bid.modalidade).toEqual({ codigo: "6", rotulo: "PE - PREGÃO ELETRÔNICO" });
    expect(bid.orgao).toEqual({ codigo: "10", rotulo: "SECRETARIA MUNICIPAL DE EDUCACAO" });
    expect(bid.status).toEqual({ codigo: "1", rotulo: "Publicado" });
    expect(bid.criterio?.rotulo).toBe("12 - (Lei 14133/21) Menor preço");
  });

  test("returns an empty participants list when the source publishes none", () => {
    expect(bid.participantes).toEqual([]);
  });

  test("throws when the page is not a bid detail", () => {
    expect(() => parseBidDetail("<html></html>")).toThrow(/detalhe da licitação/i);
  });
});
