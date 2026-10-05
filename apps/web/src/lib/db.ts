import { createDatabase, type Database } from "@pad/database/client";

const globalForDb = globalThis as typeof globalThis & { padDatabase?: Database };

/** Conexão única por processo; em desenvolvimento sobrevive ao recarregamento de módulos. */
export function getDb(): Database {
  globalForDb.padDatabase ??= createDatabase().db;
  return globalForDb.padDatabase;
}
