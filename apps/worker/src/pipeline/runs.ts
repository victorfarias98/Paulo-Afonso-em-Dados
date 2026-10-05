import {
  type Database,
  type EntityType,
  ingestionRuns,
  type RunStatus,
  type RunTrigger,
  sourceDatasets,
  sources,
} from "@pad/database";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

export interface DatasetRef {
  sourceId: string;
  datasetId: string;
}

export interface RunCounters {
  found: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  missing: number;
}

export interface RunResult extends RunCounters {
  status: RunStatus;
  isFullScan: boolean;
  errors: string[];
  log: string[];
}

const MAX_ERRORS_IN_SUMMARY = 20;

export async function findDataset(
  db: Database,
  sourceSlug: string,
  entityType: EntityType,
): Promise<DatasetRef> {
  const [row] = await db
    .select({ sourceId: sources.id, datasetId: sourceDatasets.id })
    .from(sourceDatasets)
    .innerJoin(sources, eq(sources.id, sourceDatasets.sourceId))
    .where(and(eq(sources.slug, sourceSlug), eq(sourceDatasets.entityType, entityType)));

  if (!row) {
    throw new Error(`Fonte "${sourceSlug}" (${entityType}) não registrada. Rode "pnpm db:seed".`);
  }
  return row;
}

export async function startRun(
  db: Database,
  datasetId: string,
  trigger: RunTrigger,
): Promise<string> {
  const [run] = await db
    .insert(ingestionRuns)
    .values({ sourceDatasetId: datasetId, trigger })
    .returning({ id: ingestionRuns.id });

  if (!run) {
    throw new Error("Não foi possível registrar o início da coleta.");
  }
  return run.id;
}

/** Quantos registros a última varredura completa e concluída encontrou. */
export async function previousFullScanFound(
  db: Database,
  datasetId: string,
  currentRunId: string,
): Promise<number | null> {
  const [previous] = await db
    .select({ found: ingestionRuns.recordsFound })
    .from(ingestionRuns)
    .where(
      and(
        eq(ingestionRuns.sourceDatasetId, datasetId),
        ne(ingestionRuns.id, currentRunId),
        eq(ingestionRuns.isFullScan, true),
        inArray(ingestionRuns.status, ["success", "partial"]),
      ),
    )
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(1);

  return previous?.found ?? null;
}

export async function finishRun(
  db: Database,
  runId: string,
  datasetId: string,
  result: RunResult,
): Promise<void> {
  await db
    .update(ingestionRuns)
    .set({
      status: result.status,
      isFullScan: result.isFullScan,
      finishedAt: sql`now()`,
      recordsFound: result.found,
      recordsCreated: result.created,
      recordsUpdated: result.updated,
      recordsUnchanged: result.unchanged,
      recordsFailed: result.failed,
      recordsMissing: result.missing,
      errorSummary:
        result.errors.length > 0 ? result.errors.slice(0, MAX_ERRORS_IN_SUMMARY).join("\n") : null,
      log: result.log,
    })
    .where(eq(ingestionRuns.id, runId));

  if (result.status === "success" || result.status === "partial") {
    await db
      .update(sourceDatasets)
      .set({ lastSuccessAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(sourceDatasets.id, datasetId));
  }
}
