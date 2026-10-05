import type { SigerWorkPayload } from "@pad/data-sources";
import { describe, expect, test } from "vitest";

import { normalizeSigerWork } from "./normalize-work";

const payload: SigerWorkPayload = {
  id: "16",
  numero: "383",
  descricao: "manutenção de rede de esgoto",
  objeto: "MANUTENÇÃO CONTÍNUA DO ESGOTO NO MUNICÍPIO DE PAULO AFONSO",
  dataCadastro: "02/03/2026",
  dataInicio: "16/07/2025",
  prazoDias: "360",
  valor: "640.728,23",
  status: { codigo: "1", rotulo: "Em andamento" },
  tipoObra: { codigo: "10", rotulo: "4 - Serviços de manutenção" },
  funcaoObra: { codigo: "35", rotulo: "11.99 - Outras obras ou serviços de esgotos sanitários" },
  contrato: { codigo: "1091", rotulo: "ATA-0015/2025" },
  licitacao: { codigo: "1585", rotulo: "PE90037/2025" },
  enderecos: [{ logradouro: "ZONA URBANA", numero: null, complemento: null, bairro: "DIVERSOS" }],
  documentos: [{ descricao: "PUBLICAÇÃO", arquivo: "obra_doc/29/extrato.pdf" }],
};

const options = { today: "2026-10-04", baseUrl: "https://sigerweb.net.br/pm_pauloafonso" };

describe("normalizeSigerWork", () => {
  const result = normalizeSigerWork(payload, options);

  test("converts value and start date", () => {
    expect(result.work).toMatchObject({
      externalId: "16",
      number: "383",
      title: "manutenção de rede de esgoto",
      description: "MANUTENÇÃO CONTÍNUA DO ESGOTO NO MUNICÍPIO DE PAULO AFONSO",
      initialValue: "640728.23",
      startDate: "2025-07-16",
      deadlineDays: 360,
    });
    expect(result.work.sourceUrl).toBe(
      "https://sigerweb.net.br/pm_pauloafonso/index.php?class=CadObrasFormExterno&method=onEdit&key=16&id=16",
    );
  });

  test("derives the expected end from start date plus deadline and flags it as derived", () => {
    expect(result.work.expectedEndDate).toBe("2026-07-11");
    expect(result.work.isExpectedEndDateDerived).toBe(true);
    expect(result.transformations).toContainEqual({
      field: "expectedEndDate",
      from: { dataInicio: "16/07/2025", prazoDias: "360" },
      to: "2026-07-11",
      rule: "start_date_plus_deadline_days",
    });
  });

  test("keeps the source status and derives the objective one", () => {
    expect(result.work.sourceStatus).toBe("Em andamento");
    expect(result.work.status).toBe("prazo_vencido");
  });

  test("keeps the contract and bid references published by the source", () => {
    expect(result.work).toMatchObject({
      contractExternalId: "1091",
      contractNumber: "ATA-0015/2025",
      bidExternalId: "1585",
      bidNumber: "PE90037/2025",
    });
  });

  test("builds absolute URLs for attached documents", () => {
    expect(result.documents).toEqual([
      {
        title: "PUBLICAÇÃO",
        sourceUrl: "https://sigerweb.net.br/pm_pauloafonso/obra_doc/29/extrato.pdf",
      },
    ]);
  });

  test("leaves the expected end empty when start date or deadline is missing", () => {
    const noDeadline = normalizeSigerWork({ ...payload, prazoDias: null }, options);

    expect(noDeadline.work.expectedEndDate).toBeNull();
    expect(noDeadline.work.isExpectedEndDateDerived).toBe(false);
    expect(noDeadline.work.status).toBe("em_andamento");
  });
});
