import { describe, expect, test } from "vitest";

import { expenseFiltersToQuery, parseBranch, parseExpenseFilters } from "./expense-filters";

const ID = "3f2c1a9e-5b7d-4c8e-9a1b-2d3e4f5a6b7c";

describe("parseExpenseFilters", () => {
  test("defaults to payments, first page, no year", () => {
    expect(parseExpenseFilters({})).toEqual({ phase: "pagamento", page: 1 });
  });

  test("reads every supported filter from the URL", () => {
    expect(
      parseExpenseFilters({
        fase: "empenho",
        ano: "2026",
        mes: "9",
        orgao: ID,
        fornecedor: ID,
        q: " merenda ",
        pagina: "3",
      }),
    ).toEqual({
      phase: "empenho",
      year: 2026,
      month: 9,
      agencyId: ID,
      supplierId: ID,
      q: "merenda",
      page: 3,
    });
  });

  test("ignores invalid phase, month and ids", () => {
    expect(
      parseExpenseFilters({ fase: "propina", mes: "13", orgao: "1 or 1=1", fornecedor: "x" }),
    ).toEqual({ phase: "pagamento", page: 1 });
  });
});

describe("expenseFiltersToQuery", () => {
  test("always writes the phase and omits empty filters", () => {
    expect(expenseFiltersToQuery({ phase: "pagamento", page: 1 })).toBe("?fase=pagamento");
    expect(
      expenseFiltersToQuery({ phase: "liquidacao", year: 2026, month: 9, agencyId: ID, page: 2 }),
    ).toBe(`?fase=liquidacao&ano=2026&mes=9&orgao=${ID}&pagina=2`);
  });
});

describe("poder (Prefeitura ou Câmara)", () => {
  test("reads the branch from the URL and writes it back", () => {
    const filters = parseExpenseFilters({ poder: "camara", ano: "2026" });

    expect(filters.branch).toBe("camara");
    expect(expenseFiltersToQuery(filters)).toBe("?fase=pagamento&poder=camara&ano=2026");
  });

  test("leaves the branch undefined when absent or unknown, so the list covers both", () => {
    expect(parseExpenseFilters({}).branch).toBeUndefined();
    expect(parseExpenseFilters({ poder: "estado" }).branch).toBeUndefined();
    expect(parseBranch(["camara", "prefeitura"])).toBe("camara");
    expect(parseBranch("__proto__")).toBeUndefined();
  });
});
