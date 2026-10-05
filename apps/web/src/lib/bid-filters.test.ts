import { describe, expect, test } from "vitest";

import { bidFiltersToQuery, parseBidFilters } from "./bid-filters";

describe("parseBidFilters", () => {
  test("uses safe defaults when nothing is given", () => {
    expect(parseBidFilters({})).toEqual({ sort: "recentes", page: 1 });
  });

  test("reads every supported filter from the URL", () => {
    expect(
      parseBidFilters({
        q: " merenda ",
        situacao: "publicado",
        modalidade: "PE - PREGÃO ELETRÔNICO",
        ano: "2026",
        ordem: "maior_valor",
        pagina: "4",
      }),
    ).toEqual({
      q: "merenda",
      status: "publicado",
      modality: "PE - PREGÃO ELETRÔNICO",
      year: 2026,
      sort: "maior_valor",
      page: 4,
    });
  });

  test("accepts only status keys in the stored format", () => {
    expect(parseBidFilters({ situacao: "Publicado; drop" }).status).toBeUndefined();
    expect(parseBidFilters({ situacao: "homologado_e_adjudicado" }).status).toBe(
      "homologado_e_adjudicado",
    );
  });

  test("ignores invalid year, sort and page", () => {
    expect(parseBidFilters({ ano: "1800", ordem: "x", pagina: "abc" })).toEqual({
      sort: "recentes",
      page: 1,
    });
  });
});

describe("bidFiltersToQuery", () => {
  test("omits defaults and writes active filters", () => {
    expect(bidFiltersToQuery({ sort: "recentes", page: 1 })).toBe("");
    expect(bidFiltersToQuery({ status: "publicado", year: 2026, sort: "maior_valor", page: 2 })).toBe(
      "?situacao=publicado&ano=2026&ordem=maior_valor&pagina=2",
    );
  });
});
