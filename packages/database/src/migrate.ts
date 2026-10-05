import { createDatabase } from "./client";
import { runMigrations } from "./migrations";

async function main(): Promise<void> {
  const { db, close } = createDatabase(undefined, 1);
  try {
    await runMigrations(db);
    process.stdout.write("Migrations aplicadas.\n");
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha ao aplicar migrations: ${String(error)}\n`);
  process.exitCode = 1;
});
