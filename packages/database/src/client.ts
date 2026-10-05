import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>["db"];

export function requireDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não está definida. Copie .env.example para .env.");
  }
  return url;
}

export function createDatabase(url: string = requireDatabaseUrl(), maxConnections = 10) {
  const client = postgres(url, { max: maxConnections });
  const db = drizzle(client, { schema });
  return { db, close: () => client.end() };
}
