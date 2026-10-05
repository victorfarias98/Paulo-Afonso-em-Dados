import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { id, timestamps } from "./columns";
import type { EntityType } from "./ingestion";

/** Como um vínculo entre entidades foi estabelecido; define a confiança exibida. */
export type LinkMethod = "source_fk" | "official_id" | "number_match" | "heuristic" | "manual";
export type LinkConfidence = "alta" | "media" | "baixa" | "manual";

/**
 * Quem agiu no admin. Hoje o acesso é por usuário e senha do ambiente, então
 * `login` é o ADMIN_USER; e-mail e hash de senha ficam para contas individuais.
 */
export const adminUsers = pgTable("admin_users", {
  id: id(),
  login: text("login").notNull().unique(),
  email: text("email").unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  ...timestamps,
});

export const entityLinks = pgTable(
  "entity_links",
  {
    id: id(),
    fromType: text("from_type").$type<EntityType>().notNull(),
    fromId: uuid("from_id").notNull(),
    toType: text("to_type").$type<EntityType>().notNull(),
    toId: uuid("to_id").notNull(),
    relation: text("relation").notNull(),
    method: text("method").$type<LinkMethod>().notNull(),
    confidence: text("confidence").$type<LinkConfidence>().notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("entity_links_uq").on(t.fromType, t.fromId, t.toType, t.toId, t.relation, t.method),
    index("entity_links_from_idx").on(t.fromType, t.fromId),
    index("entity_links_to_idx").on(t.toType, t.toId),
  ],
);

/**
 * Correção manual de um campo. O dado oficial permanece intacto na entidade e
 * no registro bruto; a correção fica aqui, sempre com justificativa e autor.
 */
export const manualOverrides = pgTable(
  "manual_overrides",
  {
    id: id(),
    entityType: text("entity_type").$type<EntityType>().notNull(),
    entityId: uuid("entity_id").notNull(),
    field: text("field").notNull(),
    originalValue: jsonb("original_value"),
    correctedValue: jsonb("corrected_value"),
    justification: text("justification").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("manual_overrides_entity_idx").on(t.entityType, t.entityId)],
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: id(),
    userId: uuid("user_id").references(() => adminUsers.id),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt)],
);

export const COLLECTION_JOBS = [
  "obras",
  "licitacoes",
  "contratos",
  "camara_contratos",
  "camara_licitacoes",
  "despesas",
  "camara_despesas",
  "tudo",
] as const;
export type CollectionJob = (typeof COLLECTION_JOBS)[number];
export type CollectionRequestStatus = "pending" | "running" | "done" | "failed";

/**
 * Pedido de coleta feito pelo admin. O portal só grava o pedido; quem executa é
 * o worker, que consulta esta fila enquanto espera o horário da coleta diária.
 */
export const collectionRequests = pgTable(
  "collection_requests",
  {
    id: id(),
    job: text("job").$type<CollectionJob>().notNull(),
    status: text("status").$type<CollectionRequestStatus>().notNull().default("pending"),
    requestedBy: uuid("requested_by").references(() => adminUsers.id),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    message: text("message"),
  },
  (t) => [index("collection_requests_status_idx").on(t.status, t.requestedAt)],
);
