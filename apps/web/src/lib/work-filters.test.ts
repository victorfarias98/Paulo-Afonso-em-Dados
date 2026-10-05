import { describe, expect, test } from "vitest";

import { parseWorkFilters, workFiltersToQuery } from "./work-filters";

describe("parseWorkFilters", () => {
  test("uses safe defaults when nothing is given", () => {
    expect(parseWorkFilters({})).toEqual({ sort: "recentes", page: 1 });
  });

  test("reads every supported filter from the URL", () => {
    expect(
      parseWorkFilters({
        q: " escola ",
        situacao: "prazo_vencido",
        bairro: "CENTRO",
        ordem: "maior_valor",
        pagina: "2",
      }),
    ).toEqual({ q: "escola", status: "prazo_vencido", neighborhood: "CENTRO", sort: "maior_valor", page: 2 });
  });

  test("ignores values outside the allowed lists", () => {
    expect(parseWorkFilters({ situacao: "atrasadissima", ordem: "x", pagina: "0" })).toEqual({
      sort: "recentes",
      page: 1,
    });
  });

  test("limits the size of free-text filters", () => {
    const filters = parseWorkFilters({ q: "a".repeat(300), bairro: "b".repeat(300) });

    expect(filters.q).toHaveLength(100);
    expect(filters.neighborhood).toHaveLength(100);
  });
});

describe("workFiltersToQuery", () => {
  test("omits defaults", () => {
    expect(workFiltersToQuery({ sort: "recentes", page: 1 })).toBe("");
  });

  test("writes the active filters with the public parameter names", () => {
    expect(
      workFiltersToQuery({ status: "em_andamento", neighborhood: "CENTRO", sort: "prazo", page: 3 }),
    ).toBe("?situacao=em_andamento&bairro=CENTRO&ordem=prazo&pagina=3");
  });
});
