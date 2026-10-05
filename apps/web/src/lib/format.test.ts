import { describe, expect, test } from "vitest";

import { formatDate, formatDocument, formatMoney, formatMoneySpoken } from "./format";

/** O Intl usa espaço não separável entre "R$" e o número. */
const plain = (text: string): string => text.replace(/\u00a0/g, " ");

describe("formatMoney", () => {
  test("formats a decimal string as Brazilian currency", () => {
    expect(plain(formatMoney("454404.56"))).toBe("R$ 454.404,56");
  });

  test("keeps cents exact for large values", () => {
    expect(plain(formatMoney("10796000.00"))).toBe("R$ 10.796.000,00");
  });

  test("says the value was not published instead of showing zero", () => {
    expect(formatMoney(null)).toBe("Não informado");
  });
});

describe("formatDate", () => {
  test("formats an ISO date as dd/mm/aaaa without timezone shift", () => {
    expect(formatDate("2026-07-15")).toBe("15/07/2026");
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
  });

  test("says the date was not published", () => {
    expect(formatDate(null)).toBe("Não informada");
  });
});

describe("formatDocument", () => {
  test("formats a CNPJ", () => {
    expect(formatDocument("cnpj", "10780363000140")).toBe("CNPJ 10.780.363/0001-40");
  });

  test("shows an individual's document only in masked form", () => {
    expect(formatDocument("cpf", "***.456.789-**")).toBe("CPF ***.456.789-**");
  });

  test("returns null when there is no document to show", () => {
    expect(formatDocument("unknown", null)).toBeNull();
  });
});

describe("formatMoneySpoken", () => {
  test("says large values the way people speak them", () => {
    expect(plain(formatMoneySpoken("421173833.19"))).toBe("R$ 421,2 milhões");
    expect(plain(formatMoneySpoken(1_300_000))).toBe("R$ 1,3 milhão");
    expect(plain(formatMoneySpoken(2_450_000_000))).toBe("R$ 2,5 bilhões");
  });

  test("shows values under a million in whole reais", () => {
    expect(plain(formatMoneySpoken("84750.40"))).toBe("R$ 84.750");
  });
});
