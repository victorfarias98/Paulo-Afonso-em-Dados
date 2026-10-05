import type { SigerContractPayload } from "@pad/data-sources";
import type { ContractKind, Transformation } from "@pad/database";
import {
  type ContractStatus,
  deriveContractStatus,
  type ParsedSupplier,
  parseBrDate,
  parseBrMoney,
  parseSupplierLabel,
} from "@pad/domain";

/** Registro bruto guardado em `raw_records`: detalhe do contrato + tipo vindo da listagem. */
export type SigerContractRecord = SigerContractPayload & { tipo: string };

export interface NormalizeOptions {
  /** Data de referência para a situação derivada, em AAAA-MM-DD. */
  today: string;
  baseUrl: string;
}

export interface NormalizedContract {
  contract: {
    externalId: string;
    sourceUrl: string;
    number: string;
    kind: ContractKind;
    contractType: string | null;
    modality: string | null;
    processNumber: string | null;
    bidNumber: string | null;
    description: string | null;
    originalValue: string | null;
    signedAt: string | null;
    endsAt: string | null;
    fiscalYear: number | null;
    sourceStatus: string | null;
    status: ContractStatus;
  };
  supplier: ParsedSupplier | null;
  agencyNames: string[];
  budgetLines: string[];
  transformations: Transformation[];
}

const KIND_BY_LIST_TYPE: Record<string, ContractKind> = {
  CONTRATO: "contrato",
  ATA: "ata_registro_precos",
};

export function contractPageUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/index.php?class=CadContratoFormExterno&method=onEdit&key=${id}&id=${id}`;
}

function parseFiscalYear(value: string | null): number | null {
  return value && /^\d{4}$/.test(value) ? Number(value) : null;
}

/**
 * Converte o registro bruto do SIGER no contrato normalizado. Função pura:
 * toda mudança em relação ao dado original é devolvida em `transformations`.
 */
export function normalizeSigerContract(
  record: SigerContractRecord,
  options: NormalizeOptions,
): NormalizedContract {
  const originalValue = parseBrMoney(record.valor);
  const signedAt = parseBrDate(record.dataAssinatura);
  const endsAt = parseBrDate(record.dataVencimento);
  // O termo aditivo não aparece na listagem (não tem "tipo"); a fonte o marca no campo de ordem.
  const isAmendment = record.aditivo !== null;
  const kind: ContractKind = isAmendment
    ? "termo_aditivo"
    : (KIND_BY_LIST_TYPE[record.tipo.trim().toUpperCase()] ?? "outro");
  const sourceStatus = record.status?.rotulo ?? null;
  const status = deriveContractStatus({ sourceStatus, endsAt, today: options.today });
  const supplier = record.fornecedor ? parseSupplierLabel(record.fornecedor.rotulo) : null;

  const transformations: Transformation[] = [
    { field: "originalValue", from: record.valor, to: originalValue, rule: "br_money_to_decimal" },
    { field: "signedAt", from: record.dataAssinatura, to: signedAt, rule: "br_date_to_iso" },
    { field: "endsAt", from: record.dataVencimento, to: endsAt, rule: "br_date_to_iso" },
    isAmendment
      ? { field: "kind", from: record.aditivo, to: kind, rule: "amendment_order_to_kind" }
      : { field: "kind", from: record.tipo, to: kind, rule: "list_type_to_kind" },
    {
      field: "status",
      from: { sourceStatus, endsAt, today: options.today },
      to: status,
      rule: "derive_contract_status",
    },
    {
      field: "supplier",
      from: record.fornecedor?.rotulo ?? null,
      to: supplier ? { document: supplier.documentNumber, name: supplier.legalName } : null,
      rule: "split_supplier_label",
    },
  ];

  return {
    contract: {
      externalId: record.id,
      sourceUrl: contractPageUrl(options.baseUrl, record.id),
      number: record.numero,
      kind,
      contractType: record.tipoContrato?.rotulo ?? null,
      modality: record.modalidade?.rotulo ?? null,
      processNumber: record.processo,
      bidNumber: record.licitacao,
      description: record.objeto,
      originalValue,
      signedAt,
      endsAt,
      fiscalYear: parseFiscalYear(record.competencia),
      sourceStatus,
      status,
    },
    supplier,
    agencyNames: record.secretarias,
    budgetLines: record.dotacoes,
    transformations,
  };
}
