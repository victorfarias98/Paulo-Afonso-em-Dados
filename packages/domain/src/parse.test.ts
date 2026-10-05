import { describe, expect, test } from "vitest";

import { normalizeName, onlyDigits, parseBrDate, parseBrMoney, redactCpf } from "./parse";

describe("parseBrMoney", () => {
  test("converts a Brazilian formatted value into a decimal string", () => {
    expect(parseBrMoney("454.404,56")).toBe("454404.56");
  });

  test("accepts the currency prefix used by the council portal", () => {
    expect(parseBrMoney("R$ 150.000,00")).toBe("150000.00");
  });

  test("pads values published without cents", () => {
    expect(parseBrMoney("1.500")).toBe("1500.00");
    expect(parseBrMoney("10,5")).toBe("10.50");
  });

  test("returns null for empty or missing values", () => {
    expect(parseBrMoney("")).toBeNull();
    expect(parseBrMoney("   ")).toBeNull();
    expect(parseBrMoney(null)).toBeNull();
  });

  test("throws when the value is not a recognizable amount", () => {
    expect(() => parseBrMoney("a combinar")).toThrow(/valor monetário/i);
  });
});

describe("parseBrDate", () => {
  test("converts dd/mm/yyyy into ISO date", () => {
    expect(parseBrDate("15/07/2026")).toBe("2026-07-15");
  });

  test("returns null for empty values", () => {
    expect(parseBrDate("")).toBeNull();
    expect(parseBrDate(undefined)).toBeNull();
  });

  test("throws for impossible dates instead of guessing", () => {
    expect(() => parseBrDate("31/02/2026")).toThrow(/data inválida/i);
    expect(() => parseBrDate("2026-07-15")).toThrow(/data inválida/i);
  });
});

describe("onlyDigits", () => {
  test("removes punctuation from a document number", () => {
    expect(onlyDigits("10.780.363/0001-40")).toBe("10780363000140");
  });
});

describe("redactCpf", () => {
  test("masks a formatted CPF, keeping only the middle digits", () => {
    expect(redactCpf("123.456.789-09 - FULANO DE TAL")).toBe("***.456.789-** - FULANO DE TAL");
  });

  test("leaves a CNPJ and other text untouched", () => {
    const label = "10.780.363/0001-40 - DISTRILEV COMERCIO E INDUSTRIA LTDA";
    expect(redactCpf(label)).toBe(label);
  });
});

describe("normalizeName", () => {
  test("removes accents, case and repeated spaces", () => {
    expect(normalizeName("  Construtora   Cênio  LTDA - EPP ")).toBe("CONSTRUTORA CENIO LTDA - EPP");
  });
});
