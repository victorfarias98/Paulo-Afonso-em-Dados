import { describe, expect, test } from "vitest";

import { parseSupplierFilters, supplierFiltersToQuery } from "./supplier-filters";

describe("parseSupplierFilters", () => {
  test("defaults to the highest paid first", () => {
    expect(parseSupplierFilters({})).toEqual({ sort: "maior_pago", page: 1 });
  });

  test("reads search text, sort and page", () => {
    expect(parseSupplierFilters({ q: " construtora ", ordem: "nome", pagina: "2" })).toEqual({
      q: "construtora",
      sort: "nome",
      page: 2,
    });
  });

  test("ignores an unknown sort and an invalid page", () => {
    expect(parseSupplierFilters({ ordem: "suspeitos", pagina: "-1" })).toEqual({
      sort: "maior_pago",
      page: 1,
    });
  });
});

describe("supplierFiltersToQuery", () => {
  test("omits defaults and writes active filters", () => {
    expect(supplierFiltersToQuery({ sort: "maior_pago", page: 1 })).toBe("");
    expect(supplierFiltersToQuery({ q: "abc", sort: "nome", page: 3 })).toBe(
      "?q=abc&ordem=nome&pagina=3",
    );
  });
});
