import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseContractDetail } from "./contract-detail";

const fixture = readFileSync(
  new URL("./__fixtures__/contrato-detalhe-3753.html", import.meta.url),
  "utf8",
);

describe("parseContractDetail", () => {
  const contract = parseContractDetail(fixture);

  test("keeps identifiers exactly as published", () => {
    expect(contract.id).toBe("3753");
    expect(contract.numero).toBe("ATA-0083/2026");
    expect(contract.licitacao).toBe("PE90027/2026");
    expect(contract.processo).toBe("001347/000128/2026");
    expect(contract.competencia).toBe("2026");
  });

  test("keeps dates and value in the source format, without converting", () => {
    expect(contract.dataAssinatura).toBe("15/07/2026");
    expect(contract.dataVencimento).toBe("15/07/2027");
    expect(contract.dataCadastro).toBe("20/07/2026");
    expect(contract.valor).toBe("454.404,56");
  });

  test("reads only the selected option of each select field", () => {
    expect(contract.fornecedor).toEqual({
      codigo: "91006",
      rotulo: "10.780.363/0001-40 - DISTRILEV COMERCIO E INDUSTRIA LTDA",
    });
    expect(contract.modalidade).toEqual({ codigo: "6", rotulo: "PE - PREGÃO ELETRÔNICO" });
    expect(contract.status).toEqual({ codigo: "N", rotulo: "NORMAL" });
    expect(contract.tipoContrato?.codigo).toBe("23");
  });

  test("leaves the amendment order empty for an ordinary contract", () => {
    expect(contract.aditivo).toBeNull();
  });

  test("reads the amendment order when the record is an amendment term", () => {
    const amendment = fixture.replace(
      /(<select[^>]*name="con_aditivo"[^>]*>)\s*(<\/select>)/,
      '$1<option value="1" selected="1"> 1º</option><option value="2"> 2º</option>$2',
    );

    expect(amendment).not.toBe(fixture);
    expect(parseContractDetail(amendment).aditivo).toBe("1º");
  });

  test("reads the object description", () => {
    expect(contract.objeto).toMatch(/^FORMAÇÃO DE REGISTRO DE PREÇOS/);
  });

  test("lists departments and budget lines", () => {
    expect(contract.secretarias).toEqual([
      "SECRETARIA MUNICIPAL DE EDUCACAO",
      "FUNDO MUNICIPAL DE EDUCACAO",
    ]);
    expect(contract.dotacoes).toHaveLength(2);
    expect(contract.dotacoes[0]).toMatch(/^10 - SECRETARIA MUNICIPAL DE EDUCACAO .* FONTE - 1552$/);
    expect(contract.dotacoes[1]).toMatch(/FONTE - 1500$/);
  });

  test("masks the CPF when the supplier is an individual", () => {
    const html = fixture.replace(
      "10.780.363/0001-40 - DISTRILEV COMERCIO E INDUSTRIA LTDA",
      "123.456.789-09 - FULANO DE TAL",
    );

    const individual = parseContractDetail(html);

    expect(individual.fornecedor?.rotulo).toBe("***.456.789-** - FULANO DE TAL");
    expect(JSON.stringify(individual)).not.toContain("123.456.789-09");
  });

  test("throws when the contract id is missing instead of returning a partial record", () => {
    expect(() => parseContractDetail("<html><body>erro</body></html>")).toThrow(
      /detalhe do contrato/i,
    );
  });
});
