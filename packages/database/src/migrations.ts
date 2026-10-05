import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import type { Database } from "./client";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

/** Aplica as migrations versionadas ainda não executadas. */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder });
}
