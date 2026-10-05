import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseContractList } from "./contract-list";

const fixture = readFileSync(
  new URL("./__fixtures__/contrato-lista-pagina-1.html", import.meta.url),
  "utf8",
);

describe("parseContractList", () => {
  test("reads the total number of records announced by the source", () => {
    expect(parseContractList(fixture).total).toBe(1339);
  });

  test("returns one item per row with the internal id and published number", () => {
    const { items } = parseContractList(fixture);

    expect(items).toHaveLength(20);
    expect(items[0]).toEqual({
      id: "624",
      numero: "TERMO DE COLABORACAO 01/2025",
      tipo: "CONTRATO",
    });
    expect(items.map((item) => item.tipo)).toContain("ATA");
  });

  test("returns only numeric, unique ids", () => {
    const ids = parseContractList(fixture).items.map((item) => item.id);

    expect(ids.every((id) => /^\d+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("throws when the page layout is not the contracts list", () => {
    expect(() => parseContractList("<html><body>manutenção</body></html>")).toThrow(
      /listagem de contratos/i,
    );
  });
});
