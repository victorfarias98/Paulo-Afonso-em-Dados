import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "./columns";

export type SourceType = "api" | "html" | "csv" | "xml";
export type RunStatus = "running" | "success" | "partial" | "failed" | "suspect";
export type RunTrigger = "schedule" | "manual";
export type ImportStatus = "pending" | "imported" | "failed" | "skipped";

/** Entidades normalizadas que podem ser referenciadas de forma polimórfica. */
export type EntityType =
  | "agency"
  | "supplier"
  | "bid"
  | "contract"
  | "contract_amendment"
  | "public_work"
  | "commitment"
  | "liquidation"
  | "payment";

export interface Transformation {
  field: string;
  from: unknown;
  to: unknown;
  rule: string;
}

export const sources = pgTable("sources", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  agencyName: text("agency_name").notNull(),
  sourceType: text("source_type").$type<SourceType>().notNull(),
  baseUrl: text("base_url").notNull(),
  isOfficial: boolean("is_official").notNull().default(true),
  isDocumented: boolean("is_documented").notNull().default(false),
  notes: text("notes"),
  ...timestamps,
});

export const sourceDatasets = pgTable(
  "source_datasets",
  {
    id: id(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    entityType: text("entity_type").$type<EntityType>().notNull(),
    scheduleCron: text("schedule_cron").notNull().default("0 5 * * *"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("source_datasets_source_entity_uq").on(t.sourceId, t.entityType)],
);

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: id(),
    sourceDatasetId: uuid("source_dataset_id")
      .notNull()
      .references(() => sourceDatasets.id),
    trigger: text("trigger").$type<RunTrigger>().notNull(),
    status: text("status").$type<RunStatus>().notNull().default("running"),
    /** Só uma varredura completa e bem-sucedida pode marcar registros como ausentes. */
    isFullScan: boolean("is_full_scan").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    recordsFound: integer("records_found").notNull().default(0),
    recordsCreated: integer("records_created").notNull().default(0),
    recordsUpdated: integer("records_updated").notNull().default(0),
    recordsUnchanged: integer("records_unchanged").notNull().default(0),
    recordsFailed: integer("records_failed").notNull().default(0),
    recordsMissing: integer("records_missing").notNull().default(0),
    errorSummary: text("error_summary"),
    log: jsonb("log").$type<string[]>().notNull().default([]),
  },
  (t) => [index("ingestion_runs_dataset_started_idx").on(t.sourceDatasetId, t.startedAt)],
);

/**
 * Registro bruto, versionado e somente-inserção: cada mudança de conteúdo na
 * fonte gera uma nova linha. O payload original nunca é alterado nem removido.
 */
export const rawRecords = pgTable(
  "raw_records",
  {
    id: id(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    entityType: text("entity_type").$type<EntityType>().notNull(),
    externalId: text("external_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    fetchMethod: text("fetch_method").notNull(),
    payload: jsonb("payload").notNull(),
    payloadHash: text("payload_hash").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    firstRunId: uuid("first_run_id").references(() => ingestionRuns.id),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    importStatus: text("import_status").$type<ImportStatus>().notNull().default("pending"),
    importError: text("import_error"),
  },
  (t) => [
    uniqueIndex("raw_records_version_uq").on(
      t.sourceId,
      t.entityType,
      t.externalId,
      t.payloadHash,
    ),
    index("raw_records_lookup_idx").on(t.sourceId, t.entityType, t.externalId, t.lastSeenAt),
    index("raw_records_status_idx").on(t.importStatus),
  ],
);

/** Liga cada entidade normalizada aos registros brutos que a originaram. */
export const recordProvenance = pgTable(
  "record_provenance",
  {
    id: id(),
    entityType: text("entity_type").$type<EntityType>().notNull(),
    entityId: uuid("entity_id").notNull(),
    rawRecordId: uuid("raw_record_id")
      .notNull()
      .references(() => rawRecords.id),
    isPrimary: boolean("is_primary").notNull().default(true),
    transformations: jsonb("transformations").$type<Transformation[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("record_provenance_uq").on(t.entityType, t.entityId, t.rawRecordId),
    index("record_provenance_entity_idx").on(t.entityType, t.entityId),
  ],
);
