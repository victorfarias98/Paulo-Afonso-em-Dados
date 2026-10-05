import { type SaiClient, type SaiContract, saiContractKey } from "@pad/data-sources";
import { contracts, SAI_CMPA } from "@pad/database";
import {
  deriveContractStatus,
  normalizeName,
  onlyDigits,
  type ParsedSupplier,
  parseBrMoney,
} from "@pad/domain";
import { and, eq, inArray, isNotNull, isNull, notInArray } from "drizzle-orm";

import {
  type ImportOptions,
  type ImportSummary,
  runSourceImport,
  storeAndPersist,
} from "../pipeline/run-import";
import { persistContract } from "../siger/contract-repository";
import type { NormalizedContract } from "../siger/normalize-contract";

export const COUNCIL_NAME = "Câmara Municipal de Paulo Afonso";
/** A API não tem página por contrato; o registro é conferido na listagem pública. */
export const COUNCIL_CONTRACTS_URL =
  "https://transparencia.cmpa.ba.gov.br/ba/camarapauloafonso/contratos";

const ISO_DATE = /^(\d{4})-\d{2}-\d{2}/;
const CNPJ_LENGTH = 14;

/** "2026-08-11T00:00:00" → "2026-08-11". Data vazia da API (ano 0001) vira null. */
function isoDate(value: string | null): string | null {
  const match = value ? ISO_DATE.exec(value) : null;
  return match && match[1] !== "0001" ? match[0] : null;
}

/**
 * A Câmara publica parte dos documentos mascarados. Sem CNPJ completo o
 * fornecedor fica sem documento; o texto mascarado não é guardado como se fosse CNPJ.
 */
function supplierOf(contract: SaiContract): ParsedSupplier | null {
  const legalName = contract.Contratado?.trim() ?? "";
  if (legalName === "") return null;

  const document = contract.CNPJ_CPF ?? "";
  const isMasked = document.includes("*");
  const digits = onlyDigits(document);
  const base = { legalName, nameNormalized: normalizeName(legalName) };

  if (!isMasked && digits.length === CNPJ_LENGTH) {
    return { ...base, documentType: "cnpj", documentNumber: digits, isDocumentMasked: false };
  }
  return { ...base, documentType: "unknown", documentNumber: null, isDocumentMasked: isMasked };
}

/** Converte um contrato da API do portal da Câmara no formato comum de contratos. */
export function normalizeCouncilContract(contract: SaiContract, today: string): NormalizedContract {
  const originalValue = parseBrMoney(contract.Valor);
  const signedAt = isoDate(contract.DataAssinatura);
  const endsAt = isoDate(contract.DataFimVigencia);
  const status = deriveContractStatus({ sourceStatus: null, endsAt, today });

  return {
    contract: {
      externalId: saiContractKey(contract),
      sourceUrl: COUNCIL_CONTRACTS_URL,
      number: contract.NumeroContrato,
      kind: "contrato",
      contractType: contract.TipoContrato?.trim() || null,
      modality: contract.Modalidade?.trim() || null,
      processNumber: contract.NumeroProcessoLicitatorio?.trim() || null,
      bidNumber: null,
      description: contract.Objeto?.trim() || null,
      originalValue,
      signedAt,
      endsAt,
      fiscalYear: signedAt ? Number(signedAt.slice(0, 4)) : null,
      sourceStatus: null,
      status,
    },
    supplier: supplierOf(contract),
    agencyNames: [COUNCIL_NAME],
    budgetLines: [],
    transformations: [
      { field: "originalValue", from: contract.Valor, to: originalValue, rule: "br_money_to_decimal" },
      { field: "signedAt", from: contract.DataAssinatura, to: signedAt, rule: "iso_datetime_to_date" },
      { field: "endsAt", from: contract.DataFimVigencia, to: endsAt, rule: "iso_datetime_to_date" },
      { field: "status", from: { endsAt, today }, to: status, rule: "derive_contract_status" },
    ],
  };
}

export interface ImportCouncilContractsOptions extends ImportOptions {
  client: SaiClient;
}

interface Item {
  id: string;
  contract: SaiContract;
}

/** Coleta os contratos da Câmara. A API devolve todos de uma vez, sem página de detalhe. */
export function importCouncilContracts(
  options: ImportCouncilContractsOptions,
): Promise<ImportSummary> {
  const { db, client, today } = options;
  let all: Item[] | null = null;

  return runSourceImport<Item>({
    ...options,
    sourceSlug: SAI_CMPA,
    entityType: "contract",
    label: "Contrato da Câmara",
    pageSize: Number.MAX_SAFE_INTEGER,

    async listPage(page) {
      all ??= (await client.listContracts()).map((contract) => ({
        id: saiContractKey(contract),
        contract,
      }));
      return { total: all.length, items: page === 1 ? all : [] };
    },

    async lastSeenByExternalId(sourceId) {
      const known = await db
        .select({ externalId: contracts.externalId, lastSeenAt: contracts.lastSeenAt })
        .from(contracts)
        .where(eq(contracts.sourceId, sourceId));
      return new Map(known.map((row) => [row.externalId, row.lastSeenAt.getTime()]));
    },

    importOne({ sourceId, runId }, item) {
      return storeAndPersist(
        db,
        {
          sourceId,
          entityType: "contract",
          externalId: item.id,
          sourceUrl: COUNCIL_CONTRACTS_URL,
          fetchMethod: "json_api",
          payload: item.contract,
          runId,
        },
        async (rawRecordId) => {
          const normalized = normalizeCouncilContract(item.contract, today);
          await persistContract(db, { sourceId, rawRecordId, normalized });
        },
      );
    },

    async markMissing(sourceId, seenIds) {
      if (seenIds.length === 0) return 0;
      const fromSource = eq(contracts.sourceId, sourceId);
      await db
        .update(contracts)
        .set({ sourceMissingSince: null })
        .where(
          and(
            fromSource,
            isNotNull(contracts.sourceMissingSince),
            inArray(contracts.externalId, seenIds),
          ),
        );
      const gone = await db
        .update(contracts)
        .set({ sourceMissingSince: today })
        .where(
          and(
            fromSource,
            isNull(contracts.sourceMissingSince),
            notInArray(contracts.externalId, seenIds),
          ),
        )
        .returning({ id: contracts.id });
      return gone.length;
    },
  });
}
