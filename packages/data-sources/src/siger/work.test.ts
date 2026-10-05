import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseWorkDetail, parseWorkList } from "./work";

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseWorkList", () => {
  const page = parseWorkList(fixture("obra-lista-pagina-1.html"));

  test("reads the total announced by the source", () => {
    expect(page.total).toBe(35);
  });

  test("returns the internal id of every row", () => {
    expect(page.items).toHaveLength(20);
    expect(page.items[0]).toEqual({ id: "36", numero: "406" });
    expect(new Set(page.items.map((item) => item.id)).size).toBe(20);
  });

  test("throws when the page is not the works list", () => {
    expect(() => parseWorkList("<html></html>")).toThrow(/listagem de obras/i);
  });
});

describe("parseWorkDetail", () => {
  const work = parseWorkDetail(fixture("obra-detalhe-16.html"));

  test("keeps the published fields without converting them", () => {
    expect(work).toMatchObject({
      id: "16",
      numero: "383",
      descricao: "manutenção de rede de esgoto",
      objeto: "MANUTENÇÃO CONTÍNUA DO ESGOTO NO MUNICÍPIO DE PAULO AFONSO",
      dataCadastro: "02/03/2026",
      dataInicio: "16/07/2025",
      prazoDias: "360",
      valor: "640.728,23",
    });
  });

  test("reads only the selected option of each select", () => {
    expect(work.status).toEqual({ codigo: "1", rotulo: "Em andamento" });
    expect(work.tipoObra?.rotulo).toBe("4 - Serviços de manutenção");
    expect(work.funcaoObra?.rotulo).toBe("11.99 - Outras obras ou serviços de esgotos sanitários");
  });

  test("reads the contract and bid the source links to the work", () => {
    expect(work.contrato).toEqual({ codigo: "1091", rotulo: "ATA-0015/2025" });
    expect(work.licitacao).toEqual({ codigo: "1585", rotulo: "PE90037/2025" });
  });

  test("lists addresses and attached documents", () => {
    expect(work.enderecos).toEqual([
      { logradouro: "ZONA URBANA", numero: null, complemento: null, bairro: "DIVERSOS" },
    ]);
    expect(work.documentos).toEqual([
      {
        descricao: "PUBLICAÇÃO ATA DE REGISTRO DE PREÇOS",
        arquivo: "obra_doc/29/69a5a73291b07_extrato_de_ata_00152025.pdf",
      },
    ]);
  });

  test("throws when the page is not a work detail", () => {
    expect(() => parseWorkDetail("<html></html>")).toThrow(/detalhe da obra/i);
  });
});
