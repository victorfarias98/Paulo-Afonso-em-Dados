import { readFileSync } from "node:fs";

import { describe, expect, test, vi } from "vitest";

import { createMunicipioOnlineClient, parseExpenseTable } from "./expenses";

const PAGE_URL = "https://www.municipioonline.com.br/ba/prefeitura/pauloafonso/cidadao/despesa";
const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseExpenseTable", () => {
  test("reads commitments keyed by the source column names", () => {
    const rows = parseExpenseTable(fixture("empenhos-2026-09.html"), "commitment");

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      Chave: "1035_2026",
      "Órgão": "08 - SECRETARIA MUNICIPAL DE FAZENDA",
      Data: "30/09/2026",
      Empenho: "09300001",
      "CPF/CNPJ Credor": "00.400.247/0001-03",
      Credor: "GARD TERCERIZACAO DE SERVIÇOS LTDA.",
      Empenhado: "R$ 474.516,63",
    });
  });

  test("reads settlements and payments with their own value columns", () => {
    const [settlement] = parseExpenseTable(fixture("liquidacoes-2026-09.html"), "liquidation");
    const [payment] = parseExpenseTable(fixture("pagamentos-2026-09.html"), "payment");

    expect(settlement).toMatchObject({ Chave: "5567_2026", Liquidado: "R$ 1.459,70" });
    expect(payment).toMatchObject({ Chave: "1297_2026", Pago: "R$ 585,03" });
  });

  test("throws when the expected table is not in the page", () => {
    expect(() => parseExpenseTable(fixture("empenhos-2026-09.html"), "payment")).toThrow(
      /tabela de pagamentos/i,
    );
  });

  test("throws when a row has no key instead of importing it", () => {
    const broken = fixture("empenhos-2026-09.html").replace("1035_2026</td>", "</td>");

    expect(() => parseExpenseTable(broken, "commitment")).toThrow(/sem chave/i);
  });
});

describe("createMunicipioOnlineClient", () => {
  test("loads the page once, then posts the form state with year and month", async () => {
    const fetchText = vi.fn(async (_url: string, _init?: { body?: string }) =>
      fixture("empenhos-2026-09.html"),
    );
    const client = createMunicipioOnlineClient({ pageUrl: PAGE_URL, fetchText });

    const rows = await client.fetchMonth("commitment", 2026, 9);

    expect(rows).toHaveLength(4);
    expect(fetchText).toHaveBeenCalledTimes(2);
    expect(fetchText.mock.calls[0]).toEqual([PAGE_URL]);

    const body = new URLSearchParams(fetchText.mock.calls[1]?.[1]?.body);
    expect(body.get("__VIEWSTATE")).toBe("VS");
    expect(body.get("ctl00$body$hfAnoEmpenhos")).toBe("2026");
    expect(body.get("ctl00$body$hfMesEmpenhos")).toBe("09");
    expect(body.get("ctl00$body$btnFiltrarEmpenhosS")).toBe("Button");
  });

  test("rejects an invalid month before calling the source", async () => {
    const fetchText = vi.fn(async () => "");
    const client = createMunicipioOnlineClient({ pageUrl: PAGE_URL, fetchText });

    await expect(client.fetchMonth("payment", 2026, 13)).rejects.toThrow(/mês inválido/i);
    expect(fetchText).not.toHaveBeenCalled();
  });
});
