import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { id, money, sourceTracking, timestamps } from "./columns";
import { type EntityType, sources } from "./ingestion";

export type Branch = "executivo" | "legislativo";
export type DocumentType = "cnpj" | "cpf" | "unknown";
export type ContractKind = "contrato" | "ata_registro_precos" | "termo_aditivo" | "outro";

const sourceId = () =>
  uuid("source_id")
    .notNull()
    .references(() => sources.id);

export const agencies = pgTable("agencies", {
  id: id(),
  name: text("name").notNull(),
  acronym: text("acronym"),
  branch: text("branch").$type<Branch>().notNull(),
  kind: text("kind"),
  parentId: uuid("parent_id").references((): AnyPgColumn => agencies.id),
  ...timestamps,
});

/** Nome/código do órgão em cada fonte; os nomes divergem entre SIGER, PNCP e despesas. */
export const agencyAliases = pgTable(
  "agency_aliases",
  {
    id: id(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    sourceId: sourceId(),
    externalId: text("external_id"),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("agency_aliases_source_name_uq").on(t.sourceId, t.name)],
);

/**
 * `documentNumber` guarda o CNPJ completo (só dígitos). Para pessoa física guarda
 * apenas a forma mascarada: o CPF completo nunca é armazenado.
 */
export const suppliers = pgTable(
  "suppliers",
  {
    id: id(),
    documentType: text("document_type").$type<DocumentType>().notNull(),
    documentNumber: text("document_number"),
    isDocumentMasked: boolean("is_document_masked").notNull().default(false),
    legalName: text("legal_name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    tradeName: text("trade_name"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("suppliers_cnpj_uq")
      .on(t.documentNumber)
      .where(sql`${t.documentType} = 'cnpj' and ${t.isDocumentMasked} = false`),
    index("suppliers_name_idx").on(t.nameNormalized),
  ],
);

export const bids = pgTable(
  "bids",
  {
    id: id(),
    sourceId: sourceId(),
    ...sourceTracking,
    number: text("number").notNull(),
    modality: text("modality"),
    processNumber: text("process_number"),
    description: text("description"),
    estimatedValue: money("estimated_value"),
    homologatedValue: money("homologated_value"),
    publishedAt: date("published_at"),
    openingDate: date("opening_date"),
    status: text("status").notNull().default("informacao_insuficiente"),
    agencyId: uuid("agency_id").references(() => agencies.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bids_source_external_uq").on(t.sourceId, t.externalId),
    index("bids_number_idx").on(t.number),
  ],
);

export const contracts = pgTable(
  "contracts",
  {
    id: id(),
    sourceId: sourceId(),
    ...sourceTracking,
    number: text("number").notNull(),
    kind: text("kind").$type<ContractKind>().notNull().default("contrato"),
    contractType: text("contract_type"),
    modality: text("modality"),
    processNumber: text("process_number"),
    /** Número da licitação como publicado; o vínculo resolvido fica em `bidId`. */
    bidNumber: text("bid_number"),
    description: text("description"),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    agencyId: uuid("agency_id").references(() => agencies.id),
    bidId: uuid("bid_id").references(() => bids.id),
    originalValue: money("original_value"),
    currentValue: money("current_value"),
    signedAt: date("signed_at"),
    startsAt: date("starts_at"),
    endsAt: date("ends_at"),
    fiscalYear: integer("fiscal_year"),
    status: text("status").notNull().default("informacao_insuficiente"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("contracts_source_external_uq").on(t.sourceId, t.externalId),
    index("contracts_supplier_idx").on(t.supplierId),
    index("contracts_agency_idx").on(t.agencyId),
    index("contracts_signed_idx").on(t.signedAt),
    index("contracts_number_idx").on(t.number),
  ],
);

export const contractAmendments = pgTable(
  "contract_amendments",
  {
    id: id(),
    sourceId: sourceId(),
    ...sourceTracking,
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id),
    amendmentNumber: text("amendment_number"),
    amendmentType: text("amendment_type"),
    description: text("description"),
    valueChange: money("value_change"),
    newEndsAt: date("new_ends_at"),
    signedAt: date("signed_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("contract_amendments_source_external_uq").on(t.sourceId, t.externalId),
    index("contract_amendments_contract_idx").on(t.contractId),
  ],
);

/** Um contrato pode atender a várias secretarias. */
export const contractAgencies = pgTable(
  "contract_agencies",
  {
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
  },
  (t) => [uniqueIndex("contract_agencies_uq").on(t.contractId, t.agencyId)],
);

/** Dotação orçamentária do contrato, mantida como texto publicado pela fonte. */
export const contractBudgetLines = pgTable(
  "contract_budget_lines",
  {
    id: id(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id),
    position: integer("position").notNull(),
    description: text("description").notNull(),
  },
  (t) => [uniqueIndex("contract_budget_lines_uq").on(t.contractId, t.position)],
);

export const publicWorks = pgTable(
  "public_works",
  {
    id: id(),
    sourceId: sourceId(),
    ...sourceTracking,
    number: text("number"),
    title: text("title").notNull(),
    description: text("description"),
    workType: text("work_type"),
    workFunction: text("work_function"),
    /** Referências como publicadas pela fonte; o vínculo resolvido fica em `contractId`/`bidId`. */
    contractExternalId: text("contract_external_id"),
    contractNumber: text("contract_number"),
    bidExternalId: text("bid_external_id"),
    bidNumber: text("bid_number"),
    contractId: uuid("contract_id").references(() => contracts.id),
    bidId: uuid("bid_id").references(() => bids.id),
    agencyId: uuid("agency_id").references(() => agencies.id),
    initialValue: money("initial_value"),
    currentValue: money("current_value"),
    startDate: date("start_date"),
    deadlineDays: integer("deadline_days"),
    expectedEndDate: date("expected_end_date"),
    /** Verdadeiro quando o prazo final foi calculado (início + dias), não publicado. */
    isExpectedEndDateDerived: boolean("is_expected_end_date_derived").notNull().default(false),
    actualEndDate: date("actual_end_date"),
    /** Só é preenchido quando a fonte oficial publica o percentual. */
    progressPercentage: doublePrecision("progress_percentage"),
    status: text("status").notNull().default("informacao_insuficiente"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("public_works_source_external_uq").on(t.sourceId, t.externalId),
    index("public_works_contract_idx").on(t.contractId),
    index("public_works_status_idx").on(t.status),
  ],
);

export const publicWorkAddresses = pgTable(
  "public_work_addresses",
  {
    id: id(),
    publicWorkId: uuid("public_work_id")
      .notNull()
      .references(() => publicWorks.id),
    position: integer("position").notNull(),
    addressType: text("address_type"),
    street: text("street"),
    number: text("number"),
    complement: text("complement"),
    neighborhood: text("neighborhood"),
    city: text("city"),
  },
  (t) => [
    uniqueIndex("public_work_addresses_uq").on(t.publicWorkId, t.position),
    index("public_work_addresses_neighborhood_idx").on(t.neighborhood),
  ],
);

/** Coordenadas não vêm da fonte oficial: são derivadas e sempre marcadas com a origem. */
export const geocodings = pgTable("geocodings", {
  id: id(),
  publicWorkAddressId: uuid("public_work_address_id")
    .notNull()
    .references(() => publicWorkAddresses.id),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  precision: text("precision").notNull(),
  provider: text("provider").notNull(),
  query: text("query").notNull(),
  ...timestamps,
});

export const commitments = pgTable(
  "commitments",
  {
    id: id(),
    sourceId: sourceId(),
    ...sourceTracking,
    fiscalYear: integer("fiscal_year").notNull(),
    number: text("number").notNull(),
    commitmentDate: date("commitment_date"),
    agencyId: uuid("agency_id").references(() => agencies.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    contractId: uuid("contract_id").references(() => contracts.id),
    budgetFunction: text("budget_function"),
    expenseElement: text("expense_element"),
    description: text("description"),
    committedValue: money("committed_value"),
    cancelledValue: money("cancelled_value"),
    reinforcedValue: money("reinforced_value"),
    budgetUnit: text("budget_unit"),
    legalBasis: text("legal_basis"),
    /** Licitação/dispensa como publicada no empenho; base do vínculo com o contrato. */
    bidReference: text("bid_reference"),
    /** Descrição do empenho (DsEmpenho); a liquidação e o pagamento a repetem. */
    commitmentDescription: text("commitment_description"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("commitments_source_external_uq").on(t.sourceId, t.externalId),
    index("commitments_year_agency_idx").on(t.fiscalYear, t.agencyId),
    index("commitments_supplier_idx").on(t.supplierId),
  ],
);

export const liquidations = pgTable(
  "liquidations",
  {
    id: id(),
    sourceId: sourceId(),
    ...sourceTracking,
    commitmentId: uuid("commitment_id").references(() => commitments.id),
    fiscalYear: integer("fiscal_year").notNull(),
    number: text("number"),
    liquidationDate: date("liquidation_date"),
    value: money("value"),
    retainedValue: money("retained_value"),
    cancelledValue: money("cancelled_value"),
    agencyId: uuid("agency_id").references(() => agencies.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    contractId: uuid("contract_id").references(() => contracts.id),
    budgetUnit: text("budget_unit"),
    expenseElement: text("expense_element"),
    description: text("description"),
    legalBasis: text("legal_basis"),
    bidReference: text("bid_reference"),
    /** Número e descrição do empenho como publicados neste registro; base do vínculo. */
    commitmentNumber: text("commitment_number"),
    commitmentDescription: text("commitment_description"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("liquidations_source_external_uq").on(t.sourceId, t.externalId),
    index("liquidations_commitment_idx").on(t.commitmentId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    sourceId: sourceId(),
    ...sourceTracking,
    commitmentId: uuid("commitment_id").references(() => commitments.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    contractId: uuid("contract_id").references(() => contracts.id),
    agencyId: uuid("agency_id").references(() => agencies.id),
    fiscalYear: integer("fiscal_year").notNull(),
    number: text("number"),
    paymentDate: date("payment_date"),
    value: money("value"),
    retainedValue: money("retained_value"),
    cancelledValue: money("cancelled_value"),
    budgetUnit: text("budget_unit"),
    expenseElement: text("expense_element"),
    description: text("description"),
    legalBasis: text("legal_basis"),
    bidReference: text("bid_reference"),
    /** Número e descrição do empenho como publicados neste registro; base do vínculo. */
    commitmentNumber: text("commitment_number"),
    commitmentDescription: text("commitment_description"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("payments_source_external_uq").on(t.sourceId, t.externalId),
    index("payments_date_idx").on(t.paymentDate),
    index("payments_supplier_idx").on(t.supplierId),
    index("payments_contract_idx").on(t.contractId),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    sourceId: sourceId(),
    entityType: text("entity_type").$type<EntityType>().notNull(),
    entityId: uuid("entity_id").notNull(),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("documents_uq").on(t.entityType, t.entityId, t.sourceUrl),
    index("documents_entity_idx").on(t.entityType, t.entityId),
  ],
);
