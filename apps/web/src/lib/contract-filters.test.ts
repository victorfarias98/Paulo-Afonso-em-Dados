import { describe, expect, test } from "vitest";

import { filtersToQuery, parseContractFilters } from "./contract-filters";

describe("parseContractFilters", () => {
  test("uses safe defaults when nothing is given", () => {
    expect(parseContractFilters({})).toEqual({ sort: "recentes", page: 1 });
  });

  test("reads every supported filter from the URL", () => {
    expect(
      parseContractFilters({
        q: "  merenda  ",
        situacao: "vigente",
        tipo: "ata_registro_precos",
        ano: "2026",
        ordem: "maior_valor",
        pagina: "3",
      }),
    ).toEqual({
      q: "merenda",
      status: "vigente",
      kind: "ata_registro_precos",
      year: 2026,
      sort: "maior_valor",
      page: 3,
    });
  });

  test("ignores values that are not in the allowed lists", () => {
    expect(
      parseContractFilters({
        situacao: "'; drop table contracts; --",
        tipo: "x",
        ano: "20x6",
        ordem: "aleatoria",
        pagina: "-4",
      }),
    ).toEqual({ sort: "recentes", page: 1 });
  });

  test("uses the first value when a parameter is repeated", () => {
    expect(parseContractFilters({ situacao: ["cancelado", "vigente"] }).status).toBe("cancelado");
  });

  test("limits the size of the search text", () => {
    expect(parseContractFilters({ q: "a".repeat(500) }).q).toHaveLength(100);
  });
});

describe("filtersToQuery", () => {
  test("omits defaults so links stay short", () => {
    expect(filtersToQuery({ sort: "recentes", page: 1 })).toBe("");
  });

  test("writes the active filters back using the public parameter names", () => {
    expect(
      filtersToQuery({ q: "merenda", status: "vigente", year: 2026, sort: "maior_valor", page: 2 }),
    ).toBe("?q=merenda&situacao=vigente&ano=2026&ordem=maior_valor&pagina=2");
  });
});
