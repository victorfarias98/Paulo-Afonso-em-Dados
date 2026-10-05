import type { SigerWorkPayload } from "@pad/data-sources";
import type { Transformation } from "@pad/database";
import { addDays, deriveWorkStatus, parseBrDate, parseBrMoney, type WorkStatus } from "@pad/domain";

export interface NormalizeWorkOptions {
  /** Data de referência para a situação derivada, em AAAA-MM-DD. */
  today: string;
  baseUrl: string;
}

export interface NormalizedWork {
  work: {
    externalId: string;
    sourceUrl: string;
    number: string;
    title: string;
    description: string | null;
    workType: string | null;
    workFunction: string | null;
    initialValue: string | null;
    startDate: string | null;
    deadlineDays: number | null;
    expectedEndDate: string | null;
    isExpectedEndDateDerived: boolean;
    sourceStatus: string | null;
    status: WorkStatus;
    contractExternalId: string | null;
    contractNumber: string | null;
    bidExternalId: string | null;
    bidNumber: string | null;
  };
  addresses: Array<{
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
  }>;
  documents: Array<{ title: string; sourceUrl: string }>;
  transformations: Transformation[];
}

export function workPageUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/index.php?class=CadObrasFormExterno&method=onEdit&key=${id}&id=${id}`;
}

function parseDeadlineDays(value: string | null): number | null {
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

/**
 * Converte o registro bruto de obra do SIGER. A fonte não publica a data de
 * término: ela é calculada (início + prazo em dias) e marcada como derivada.
 * Esse cálculo não considera aditivos de prazo.
 */
export function normalizeSigerWork(
  payload: SigerWorkPayload,
  options: NormalizeWorkOptions,
): NormalizedWork {
  const initialValue = parseBrMoney(payload.valor);
  const startDate = parseBrDate(payload.dataInicio);
  const deadlineDays = parseDeadlineDays(payload.prazoDias);
  const expectedEndDate =
    startDate !== null && deadlineDays !== null ? addDays(startDate, deadlineDays) : null;
  const sourceStatus = payload.status?.rotulo ?? null;
  const status = deriveWorkStatus({ sourceStatus, expectedEndDate, today: options.today });

  const transformations: Transformation[] = [
    { field: "initialValue", from: payload.valor, to: initialValue, rule: "br_money_to_decimal" },
    { field: "startDate", from: payload.dataInicio, to: startDate, rule: "br_date_to_iso" },
    {
      field: "expectedEndDate",
      from: { dataInicio: payload.dataInicio, prazoDias: payload.prazoDias },
      to: expectedEndDate,
      rule: "start_date_plus_deadline_days",
    },
    {
      field: "status",
      from: { sourceStatus, expectedEndDate, today: options.today },
      to: status,
      rule: "derive_work_status",
    },
  ];

  return {
    work: {
      externalId: payload.id,
      sourceUrl: workPageUrl(options.baseUrl, payload.id),
      number: payload.numero,
      title: payload.descricao ?? payload.objeto ?? `Obra ${payload.numero}`,
      description: payload.objeto,
      workType: payload.tipoObra?.rotulo ?? null,
      workFunction: payload.funcaoObra?.rotulo ?? null,
      initialValue,
      startDate,
      deadlineDays,
      expectedEndDate,
      isExpectedEndDateDerived: expectedEndDate !== null,
      sourceStatus,
      status,
      contractExternalId: payload.contrato?.codigo ?? null,
      contractNumber: payload.contrato?.rotulo ?? null,
      bidExternalId: payload.licitacao?.codigo ?? null,
      bidNumber: payload.licitacao?.rotulo ?? null,
    },
    addresses: payload.enderecos.map((address) => ({
      street: address.logradouro,
      number: address.numero,
      complement: address.complemento,
      neighborhood: address.bairro,
    })),
    documents: payload.documentos.map((document) => ({
      title: document.descricao ?? "Documento",
      sourceUrl: `${options.baseUrl}/${document.arquivo}`,
    })),
    transformations,
  };
}
