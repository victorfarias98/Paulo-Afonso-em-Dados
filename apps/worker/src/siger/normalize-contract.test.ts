import type { SigerContractPayload } from "@pad/data-sources";
import { describe, expect, test } from "vitest";

import { normalizeSigerContract, type SigerContractRecord } from "./normalize-contract";

const payload: SigerContractPayload = {
  id: "3753",
  numero: "ATA-0083/2026",
  licitacao: "PE90027/2026",
  processo: "001347/000128/2026",
  aditivo: null,
  dataAssinatura: "15/07/2026",
  dataVencimento: "15/07/2027",
  dataCadastro: "20/07/2026",
  valor: "454.404,56",
  competencia: "2026",
  objeto: "FORMAÇÃO DE REGISTRO DE PREÇOS PARA AQUISIÇÃO DE GÊNEROS ALIMENTÍCIOS.",
  fiscal: null,
  gestor: null,
  fornecedor: { codigo: "91006", rotulo: "10.780.363/0001-40 - DISTRILEV COMERCIO E INDUSTRIA LTDA" },
  modalidade: { codigo: "6", rotulo: "PE - PREGÃO ELETRÔNICO" },
  tipoContrato: { codigo: "23", rotulo: "23 - Aquisição e fornecimento de bens de consumo)" },
  status: { codigo: "N", rotulo: "NORMAL" },
  situacao: { codigo: "V", rotulo: "Normal" },
  secretarias: ["SECRETARIA MUNICIPAL DE EDUCACAO", "FUNDO MUNICIPAL DE EDUCACAO"],
  dotacoes: ["10 - SECRETARIA MUNICIPAL DE EDUCACAO 1001 - FUNDO MUNICIPAL DE EDUCACAO"],
};

const record: SigerContractRecord = { ...payload, tipo: "ATA" };
const options = { today: "2026-10-04", baseUrl: "https://sigerweb.net.br/pm_pauloafonso" };

describe("normalizeSigerContract", () => {
  const result = normalizeSigerContract(record, options);

  test("uses the internal id as external id and builds the official page URL", () => {
    expect(result.contract.externalId).toBe("3753");
    expect(result.contract.sourceUrl).toBe(
      "https://sigerweb.net.br/pm_pauloafonso/index.php?class=CadContratoFormExterno&method=onEdit&key=3753&id=3753",
    );
  });

  test("converts value and dates to database formats", () => {
    expect(result.contract.originalValue).toBe("454404.56");
    expect(result.contract.signedAt).toBe("2026-07-15");
    expect(result.contract.endsAt).toBe("2027-07-15");
    expect(result.contract.fiscalYear).toBe(2026);
  });

  test("classifies a record with an amendment order as an amendment term", () => {
    const amendment = normalizeSigerContract(
      { ...payload, numero: "1 ADT-277/2024/2025", aditivo: "1º", tipo: "" },
      options,
    );

    expect(amendment.contract.kind).toBe("termo_aditivo");
    expect(amendment.transformations).toContainEqual({
      field: "kind",
      from: "1º",
      to: "termo_aditivo",
      rule: "amendment_order_to_kind",
    });
  });

  test("classifies the record kind from the list type column", () => {
    expect(result.contract.kind).toBe("ata_registro_precos");
    expect(normalizeSigerContract({ ...record, tipo: "CONTRATO" }, options).contract.kind).toBe(
      "contrato",
    );
    expect(normalizeSigerContract({ ...record, tipo: "X" }, options).contract.kind).toBe("outro");
  });

  test("keeps the source status and derives the objective status", () => {
    expect(result.contract.sourceStatus).toBe("NORMAL");
    expect(result.contract.status).toBe("vigente");
  });

  test("extracts the supplier with full CNPJ", () => {
    expect(result.supplier?.documentNumber).toBe("10780363000140");
    expect(result.supplier?.legalName).toBe("DISTRILEV COMERCIO E INDUSTRIA LTDA");
  });

  test("passes departments and budget lines through unchanged", () => {
    expect(result.agencyNames).toEqual(payload.secretarias);
    expect(result.budgetLines).toEqual(payload.dotacoes);
  });

  test("records every transformation applied to the original data", () => {
    expect(result.transformations).toContainEqual({
      field: "originalValue",
      from: "454.404,56",
      to: "454404.56",
      rule: "br_money_to_decimal",
    });
    expect(result.transformations.map((t) => t.field)).toEqual(
      expect.arrayContaining(["signedAt", "endsAt", "kind", "status", "supplier"]),
    );
  });

  test("leaves supplier null when the source publishes none", () => {
    const withoutSupplier = normalizeSigerContract({ ...record, fornecedor: null }, options);

    expect(withoutSupplier.supplier).toBeNull();
  });
});
