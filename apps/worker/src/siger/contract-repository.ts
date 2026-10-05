import {
  agencies,
  agencyAliases,
  contractAgencies,
  contractBudgetLines,
  contracts,
  type Database,
  suppliers,
} from "@pad/database";
import { normalizeName, type ParsedSupplier } from "@pad/domain";
import { and, eq, sql } from "drizzle-orm";

import { linkProvenance, type Tx } from "../pipeline/provenance";
import type { NormalizedContract } from "./normalize-contract";

export interface PersistContractInput {
  sourceId: string;
  rawRecordId: string;
  normalized: NormalizedContract;
}

/**
 * Fornecedor é identificado pelo CNPJ. Sem CNPJ (documento ausente ou CPF
 * mascarado) só é reaproveitado quando documento e nome coincidem; nunca
 * há fusão automática apenas por nome parecido.
 */
export async function upsertSupplier(tx: Tx, supplier: ParsedSupplier): Promise<string> {
  const sameDocument = supplier.documentNumber
    ? eq(suppliers.documentNumber, supplier.documentNumber)
    : sql`${suppliers.documentNumber} is null`;
  const sameName =
    supplier.documentType === "cnpj"
      ? undefined
      : eq(suppliers.nameNormalized, supplier.nameNormalized);

  const [existing] = await tx
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.documentType, supplier.documentType), sameDocument, sameName))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await tx.insert(suppliers).values(supplier).returning({ id: suppliers.id });
  if (!created) throw new Error(`Não foi possível gravar o fornecedor ${supplier.legalName}.`);
  return created.id;
}

/**
 * Resolve o órgão pelo texto usado nesta fonte (`alias`). Se a fonte ainda não
 * o usou, reaproveita um órgão já cadastrado cujo nome seja idêntico depois de
 * retirar acentos e caixa (`displayName`); só então cria um novo. Nomes apenas
 * parecidos nunca são fundidos.
 */
export async function resolveAgency(
  tx: Tx,
  sourceId: string,
  alias: string,
  displayName: string = alias,
): Promise<string> {
  const [known] = await tx
    .select({ agencyId: agencyAliases.agencyId })
    .from(agencyAliases)
    .where(and(eq(agencyAliases.sourceId, sourceId), eq(agencyAliases.name, alias)))
    .limit(1);
  if (known) return known.agencyId;

  const target = normalizeName(displayName);
  const existing = await tx.select({ id: agencies.id, name: agencies.name }).from(agencies);
  let agencyId = existing.find((agency) => normalizeName(agency.name) === target)?.id;

  if (!agencyId) {
    const [created] = await tx
      .insert(agencies)
      .values({ name: displayName, branch: /^c[âa]mara/i.test(displayName) ? "legislativo" : "executivo" })
      .returning({ id: agencies.id });
    if (!created) throw new Error(`Não foi possível gravar o órgão ${displayName}.`);
    agencyId = created.id;
  }

  await tx.insert(agencyAliases).values({ agencyId, sourceId, name: alias });
  return agencyId;
}

async function upsertContract(
  tx: Tx,
  sourceId: string,
  fields: NormalizedContract["contract"],
  supplierId: string | null,
  agencyId: string | null,
): Promise<string> {
  const values = { ...fields, supplierId, agencyId };
  const [contract] = await tx
    .insert(contracts)
    .values({ ...values, sourceId })
    .onConflictDoUpdate({
      target: [contracts.sourceId, contracts.externalId],
      set: { ...values, sourceMissingSince: null, lastSeenAt: sql`now()`, updatedAt: sql`now()` },
    })
    .returning({ id: contracts.id });

  if (!contract) throw new Error(`Não foi possível gravar o contrato ${fields.externalId}.`);
  return contract.id;
}

/** Secretarias e dotações são derivadas do registro bruto e refeitas a cada importação. */
async function replaceChildren(
  tx: Tx,
  contractId: string,
  agencyIds: string[],
  budgetLines: string[],
): Promise<void> {
  await tx.delete(contractAgencies).where(eq(contractAgencies.contractId, contractId));
  await tx.delete(contractBudgetLines).where(eq(contractBudgetLines.contractId, contractId));

  if (agencyIds.length > 0) {
    await tx.insert(contractAgencies).values(agencyIds.map((agencyId) => ({ contractId, agencyId })));
  }
  if (budgetLines.length > 0) {
    await tx
      .insert(contractBudgetLines)
      .values(budgetLines.map((description, position) => ({ contractId, position, description })));
  }
}

/** Grava o contrato normalizado e tudo que depende dele em uma única transação. */
export async function persistContract(db: Database, input: PersistContractInput): Promise<string> {
  const { sourceId, rawRecordId, normalized } = input;

  return db.transaction(async (tx) => {
    const supplierId = normalized.supplier ? await upsertSupplier(tx, normalized.supplier) : null;

    const agencyIds: string[] = [];
    for (const name of new Set(normalized.agencyNames)) {
      agencyIds.push(await resolveAgency(tx, sourceId, name));
    }
    const uniqueAgencyIds = [...new Set(agencyIds)];

    const contractId = await upsertContract(
      tx,
      sourceId,
      normalized.contract,
      supplierId,
      uniqueAgencyIds[0] ?? null,
    );
    await replaceChildren(tx, contractId, uniqueAgencyIds, normalized.budgetLines);
    await linkProvenance(tx, "contract", contractId, rawRecordId, normalized.transformations);

    return contractId;
  });
}
