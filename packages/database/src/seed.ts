import { createDatabase } from "./client";
import { seedSources, SOURCE_DEFINITIONS } from "./sources-registry";

async function main(): Promise<void> {
  const { db, close } = createDatabase(undefined, 1);
  try {
    await seedSources(db);
    process.stdout.write(`${SOURCE_DEFINITIONS.length} fontes registradas.\n`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Falha ao registrar as fontes: ${String(error)}\n`);
  process.exitCode = 1;
});
