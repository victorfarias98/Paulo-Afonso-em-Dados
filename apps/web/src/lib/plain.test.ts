import { describe, expect, test } from "vitest";

import { isAllCaps, plainModality, plainName } from "./plain";

describe("isAllCaps", () => {
  test("is true only when the text has letters and none is lowercase", () => {
    expect(isAllCaps("SECRETARIA DE SAÚDE")).toBe(true);
    expect(isAllCaps("Secretaria de Saúde")).toBe(false);
    expect(isAllCaps("123/2026")).toBe(false);
  });
});

describe("plainName", () => {
  test("shows an all-caps name in normal case, with small words in lowercase", () => {
    expect(plainName("SECRETARIA MUNICIPAL DE SAÚDE")).toBe("Secretaria Municipal de Saúde");
    expect(plainName("FUNDO MUNICIPAL DE ASSISTÊNCIA SOCIAL")).toBe(
      "Fundo Municipal de Assistência Social",
    );
  });

  test("keeps acronyms, roman numerals and company suffixes readable", () => {
    expect(plainName("CONSTR. DE PRAÇA BTN I")).toBe("Constr. de Praça BTN I");
    expect(plainName("REFORMA DA ESCOLA DO BTN III")).toBe("Reforma da Escola do BTN III");
    expect(plainName("QAMP SERVICOS DE CONSTRUCOES LTDA")).toBe("Qamp Servicos de Construcoes Ltda");
    expect(plainName("GARD TERCERIZACAO DE SERVIÇOS LTDA.")).toBe(
      "Gard Tercerizacao de Serviços Ltda.",
    );
    expect(plainName("POSTO SAO JOSE EPP")).toBe("Posto Sao Jose EPP");
  });

  test("handles names joined by a hyphen or with punctuation around them", () => {
    expect(plainName("FOLHA DE PAGAMENTO - SEC. DE SAÚDE")).toBe(
      "Folha de Pagamento - Sec. de Saúde",
    );
    expect(plainName("(CÂMARA MUNICIPAL)")).toBe("(Câmara Municipal)");
    expect(plainName("PRAINHA-CENTRO")).toBe("Prainha-Centro");
  });

  test("does not touch a name the source already wrote in normal case", () => {
    expect(plainName("m10 Construcoes e Empreendimentos Ltda")).toBe(
      "m10 Construcoes e Empreendimentos Ltda",
    );
    expect(plainName("Câmara Municipal de Paulo Afonso")).toBe("Câmara Municipal de Paulo Afonso");
  });

  test("does not invent accents the source did not publish", () => {
    expect(plainName("SECRETARIA MUNICIPAL DE EDUCACAO")).toBe("Secretaria Municipal de Educacao");
  });
});

describe("plainModality", () => {
  test("drops the source code and shows the bid type in normal case", () => {
    expect(plainModality("PE - PREGÃO ELETRÔNICO")).toBe("Pregão Eletrônico");
    expect(plainModality("Inexigibilidade")).toBe("Inexigibilidade");
  });
});
