import { readFileSync } from "node:fs";

import { describe, expect, test, vi } from "vitest";

import { createSigerClient } from "./client";

const BASE_URL = "https://sigerweb.net.br/pm_pauloafonso";
const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("createSigerClient", () => {
  test("requests the list ordered by internal id, newest first", async () => {
    const fetchText = vi.fn(async () => fixture("contrato-lista-pagina-1.html"));
    const client = createSigerClient({ baseUrl: BASE_URL, fetchText });

    const page = await client.listContractsPage(3);

    expect(page.items).toHaveLength(20);
    expect(fetchText).toHaveBeenCalledWith(
      `${BASE_URL}/engine.php?class=CadContratoListExterno&method=onReload&offset=40&limit=20&direction=desc&page=3&first_page=1&order=id`,
    );
  });

  test("requests the contract detail by internal id", async () => {
    const fetchText = vi.fn(async () => fixture("contrato-detalhe-3753.html"));
    const client = createSigerClient({ baseUrl: BASE_URL, fetchText });

    const contract = await client.getContract("3753");

    expect(contract.numero).toBe("ATA-0083/2026");
    expect(fetchText).toHaveBeenCalledWith(
      `${BASE_URL}/engine.php?class=CadContratoFormExterno&method=onEdit&key=3753&id=3753`,
    );
  });

  test("rejects when the source returns a different contract than requested", async () => {
    const fetchText = vi.fn(async () => fixture("contrato-detalhe-3753.html"));
    const client = createSigerClient({ baseUrl: BASE_URL, fetchText });

    await expect(client.getContract("9999")).rejects.toThrow(/9999.*3753/);
  });

  test("rejects ids that are not numeric before calling the source", async () => {
    const fetchText = vi.fn(async () => "");
    const client = createSigerClient({ baseUrl: BASE_URL, fetchText });

    await expect(client.getContract("1&method=x")).rejects.toThrow(/identificador inválido/i);
    await expect(client.listContractsPage(0)).rejects.toThrow(/página inválida/i);
    expect(fetchText).not.toHaveBeenCalled();
  });
});
