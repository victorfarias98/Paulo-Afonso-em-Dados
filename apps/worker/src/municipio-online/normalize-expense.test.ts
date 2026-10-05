import { describe, expect, test } from "vitest";

import { expenseKey, normalizeExpense } from "./normalize-expense";

const PAGE_URL = "https://www.municipioonline.com.br/ba/prefeitura/pauloafonso/cidadao/despesa";

const commitmentRow = {
  "Órgão": "12 - SECRETARIA MUNICIPAL DE SAÚDE",
  Unidade: "1201 - FUNDO MUNICIPAL DE SAUDE",
  Data: "30/09/2026",
  Empenho: "09300001",
  Elemento: "33903900 - Outros Serviços de Terceiros",
  "CPF/CNPJ Credor": "00.400.247/0001-03",
  Credor: "GARD TERCERIZACAO DE SERVIÇOS LTDA.",
  Empenhado: "R$ 474.516,63",
  Anulado: "R$ 0,00",
  "Reforçado": "R$ 10,50",
  CNPJ: "08704475000170",
  NmBaseLegal: "Pregão Eletrônico - Art. 29 Lei 14.133/2021",
  "Licitacao/Dispensa/Inexigibilidade": "CR0012/2026/2026",
  Chave: "1035_2026",
  "Histórico": "EMPENHO REFERENTE AO CONTRATO",
};

describe("normalizeExpense", () => {
  test("normalizes a commitment", () => {
    const result = normalizeExpense("commitment", commitmentRow, PAGE_URL);

    expect(result.record).toMatchObject({
      externalId: "08704475000170:1035_2026",
      sourceUrl: PAGE_URL,
      fiscalYear: 2026,
      number: "09300001",
      date: "2026-09-30",
      budgetUnit: "1201 - FUNDO MUNICIPAL DE SAUDE",
      expenseElement: "33903900 - Outros Serviços de Terceiros",
      description: "EMPENHO REFERENTE AO CONTRATO",
      legalBasis: "Pregão Eletrônico - Art. 29 Lei 14.133/2021",
      bidReference: "CR0012/2026",
      value: "474516.63",
      cancelledValue: "0.00",
      reinforcedValue: "10.50",
    });
  });

  test("strips the code prefix from the agency name and keeps the full text as alias", () => {
    const result = normalizeExpense("commitment", commitmentRow, PAGE_URL);

    expect(result.agency).toEqual({
      name: "SECRETARIA MUNICIPAL DE SAÚDE",
      alias: "12 - SECRETARIA MUNICIPAL DE SAÚDE",
    });
  });

  test("identifies a company by its full CNPJ", () => {
    expect(normalizeExpense("commitment", commitmentRow, PAGE_URL).supplier).toMatchObject({
      documentType: "cnpj",
      documentNumber: "00400247000103",
      legalName: "GARD TERCERIZACAO DE SERVIÇOS LTDA.",
    });
  });

  test("keeps an individual's document masked exactly as the source publishes it", () => {
    const row = { ...commitmentRow, "CPF/CNPJ Credor": "222.***.***-15", Credor: "FULANA DE TAL" };

    expect(normalizeExpense("commitment", row, PAGE_URL).supplier).toMatchObject({
      documentType: "cpf",
      documentNumber: "222.***.***-15",
      isDocumentMasked: true,
    });
  });

  test("reads the value columns of settlements and payments", () => {
    const settlement = {
      ...commitmentRow,
      Liquidado: "R$ 1.459,70",
      Retido: "R$ 9,00",
      "Anulação": "R$ 0,00",
      Liq: "09300150",
      Chave: "5567_2026",
    };
    const payment = {
      ...commitmentRow,
      Pago: "R$ 585,03",
      Retido: "R$ 0,00",
      "Anulação": "R$ 1,00",
      Processo: "09300031",
      Chave: "1297_2026",
    };

    expect(normalizeExpense("liquidation", settlement, PAGE_URL).record).toMatchObject({
      externalId: "08704475000170:5567_2026",
      number: "09300150",
      value: "1459.70",
      retainedValue: "9.00",
    });
    expect(normalizeExpense("payment", payment, PAGE_URL).record).toMatchObject({
      externalId: "08704475000170:1297_2026",
      number: "09300031",
      value: "585.03",
      cancelledValue: "1.00",
    });
  });

  test("leaves the bid reference empty when the source publishes none", () => {
    const row = { ...commitmentRow, "Licitacao/Dispensa/Inexigibilidade": "" };

    expect(normalizeExpense("commitment", row, PAGE_URL).record.bidReference).toBeNull();
  });

  test("builds the identifier from the management unit and the key, which repeats across units", () => {
    const health = expenseKey({ ...commitmentRow, CNPJ: "08704475000170", Chave: "98_2026" });
    const cityHall = expenseKey({ ...commitmentRow, CNPJ: "14217327000124", Chave: "98_2026" });

    expect(health).toBe("08704475000170:98_2026");
    expect(cityHall).not.toBe(health);
  });

  test("throws when the management unit is missing, since the key alone is not unique", () => {
    expect(() => expenseKey({ ...commitmentRow, CNPJ: "" })).toThrow(/unidade gestora/i);
  });

  test("throws when the year cannot be read from the key", () => {
    expect(() => normalizeExpense("commitment", { ...commitmentRow, Chave: "1035" }, PAGE_URL)).toThrow(
      /chave/i,
    );
  });
});
