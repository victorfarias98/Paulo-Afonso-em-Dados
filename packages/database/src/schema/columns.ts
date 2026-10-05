import { date, numeric, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey().defaultRandom();

export const money = (name: string) => numeric(name, { precision: 16, scale: 2 });

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Colunas comuns a toda entidade normalizada vinda de uma fonte oficial.
 * `sourceMissingSince` marca o registro que sumiu da origem; nunca é apagado.
 */
export const sourceTracking = {
  externalId: text("external_id").notNull(),
  sourceUrl: text("source_url"),
  sourceStatus: text("source_status"),
  sourceMissingSince: date("source_missing_since"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
};
