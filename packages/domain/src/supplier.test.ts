import { describe, expect, test } from "vitest";

import { parseSupplierLabel } from "./supplier";

describe("parseSupplierLabel", () => {
  test("extracts the full CNPJ and legal name of a company", () => {
    expect(parseSupplierLabel("10.780.363/0001-40 - DISTRILEV COMERCIO E INDUSTRIA LTDA")).toEqual({
      documentType: "cnpj",
      documentNumber: "10780363000140",
      isDocumentMasked: false,
      legalName: "DISTRILEV COMERCIO E INDUSTRIA LTDA",
      nameNormalized: "DISTRILEV COMERCIO E INDUSTRIA LTDA",
    });
  });

  test("never keeps the full CPF of an individual", () => {
    const supplier = parseSupplierLabel("123.456.789-09 - FULANO DE TAL");

    expect(supplier.documentType).toBe("cpf");
    expect(supplier.isDocumentMasked).toBe(true);
    expect(supplier.documentNumber).toBe("***.456.789-**");
    expect(supplier.legalName).toBe("FULANO DE TAL");
  });

  test("recognizes a CPF that was already masked at collection time", () => {
    const supplier = parseSupplierLabel("***.456.789-** - FULANO DE TAL");

    expect(supplier.documentType).toBe("cpf");
    expect(supplier.isDocumentMasked).toBe(true);
    expect(supplier.documentNumber).toBe("***.456.789-**");
    expect(supplier.legalName).toBe("FULANO DE TAL");
  });

  test("keeps the name when the source publishes no document", () => {
    expect(parseSupplierLabel("- CASA DE REPOUSO SÃO VICENTE DE PAULO")).toEqual({
      documentType: "unknown",
      documentNumber: null,
      isDocumentMasked: false,
      legalName: "CASA DE REPOUSO SÃO VICENTE DE PAULO",
      nameNormalized: "CASA DE REPOUSO SAO VICENTE DE PAULO",
    });
  });

  test("keeps hyphens that belong to the company name", () => {
    const supplier = parseSupplierLabel("09.456.650/0001-10 - CONSTRUTORA CENIO LTDA - EPP");

    expect(supplier.legalName).toBe("CONSTRUTORA CENIO LTDA - EPP");
  });

  test("throws when there is no name to show", () => {
    expect(() => parseSupplierLabel("-")).toThrow(/fornecedor sem nome/i);
  });
});
