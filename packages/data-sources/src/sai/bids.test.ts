import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { createSaiBidsClient, parseSaiBids, parseSaiBidYears, saiBidKey } from "./bids";

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseSaiBids", () => {
  const recent = parseSaiBids(fixture("licitacoes-camara-2026.json"));
  const old = parseSaiBids(fixture("licitacoes-camara-2019.json"));

  test("reads the bids of a year as published", () => {
    expect(recent).toHaveLength(6);
    expect(recent[0]).toMatchObject({
      NumeroLicitacao: "006/2026",
      NumeroProcesso: "095/2026",
      Modalidade: "Inexigibilidade",
      Status: "Finalizado",
      DataLicitacao: "2026-08-11T00:00:00",
      Detalhes: "168631",
    });
  });

  test("accepts older records that come without the bid date", () => {
    expect(old).toHaveLength(28);
    expect(old.some((bid) => bid.DataLicitacao === undefined)).toBe(true);
  });

  test("identifies each bid by table and internal code, since the number repeats", () => {
    const numbers = new Set(old.map((bid) => bid.NumeroLicitacao));
    const keys = new Set(old.map(saiBidKey));
    const [first] = recent;

    expect(numbers.size).toBeLessThan(old.length);
    expect(keys.size).toBe(old.length);
    expect(first && saiBidKey(first)).toBe("2:168631");
  });

  test("rejects a response that is not a list of bids", () => {
    expect(() => parseSaiBids('{"erro":"x"}')).toThrow();
    expect(() => parseSaiBids('[{"NumeroLicitacao":""}]')).toThrow();
  });
});

describe("parseSaiBidYears", () => {
  test("reads the years offered by the source", () => {
    expect(
      parseSaiBidYears('[{"Value":"2026","Text":"2026"},{"Value":"2025","Text":"2025"}]'),
    ).toEqual([2026, 2025]);
  });
});

describe("createSaiBidsClient", () => {
  test("asks for one year, identifying the agency by header and code", async () => {
    const calls: Array<{ url: string; body?: string; headers?: Record<string, string> }> = [];
    const client = createSaiBidsClient({
      apiUrl: "https://api.exemplo/v3",
      govPath: "ba/camarapauloafonso",
      orgCode: 2370,
      fetchText: async (url, init) => {
        calls.push({ url, ...init });
        return "[]";
      },
    });

    await client.listBids(2025);

    expect(calls[0]?.url).toBe("https://api.exemplo/v3/Licitacao/Filtro");
    expect(calls[0]?.headers).toMatchObject({ "gov-path": "ba/camarapauloafonso" });
    expect(JSON.parse(calls[0]?.body ?? "{}")).toMatchObject({ Ano: "2025", cod_orgao_org: 2370 });
  });
});
