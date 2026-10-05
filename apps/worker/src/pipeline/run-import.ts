import type { Database, EntityType, RunStatus, RunTrigger } from "@pad/database";

import { markRawFailed, type RawChange, type SaveRawInput, saveRawRecord } from "./raw-store";
import {
  finishRun,
  findDataset,
  previousFullScanFound,
  type RunCounters,
  startRun,
} from "./runs";

export interface ListPage<Item> {
  /** Total de registros anunciado pela fonte. */
  total: number;
  items: Item[];
}

export interface ImportOptions {
  db: Database;
  /** Data de referência, em AAAA-MM-DD. */
  today: string;
  trigger: RunTrigger;
  /** Limita as páginas da listagem; quando definido, a varredura pode não ser completa. */
  maxPages?: number | undefined;
  /** Limita quantos detalhes são buscados nesta execução. */
  maxDetails?: number | undefined;
  log?: ((message: string) => void) | undefined;
}

export interface ImportContext {
  sourceId: string;
  runId: string;
}

/** O que cada importador precisa informar; o restante do fluxo é comum. */
export interface SourceImport<Item extends { id: string }> extends ImportOptions {
  sourceSlug: string;
  entityType: EntityType;
  /** Nome do registro em mensagens de log e erro, ex.: "Contrato". */
  label: string;
  pageSize: number;
  listPage(page: number): Promise<ListPage<Item>>;
  /** Momento em que cada registro já importado foi visto pela última vez. */
  lastSeenByExternalId(sourceId: string): Promise<Map<string, number>>;
  /** Registros que outras entidades já importadas referenciam e que devem vir primeiro. */
  priorityExternalIds?(sourceId: string): Promise<Set<string>>;
  /**
   * Registros que não aparecem na listagem mas que a fonte publica por id (ex.:
   * termos aditivos citados por obras). São sempre buscados e nunca marcados como
   * ausentes por faltarem na listagem.
   */
  extraItems?(sourceId: string, listedIds: Set<string>): Promise<Item[]>;
  importOne(context: ImportContext, item: Item): Promise<RawChange>;
  /** Marca como ausentes os registros que não estão em `seenIds`; devolve quantos. */
  markMissing(sourceId: string, seenIds: string[]): Promise<number>;
  afterImport?(sourceId: string): Promise<void>;
}

export interface ImportSummary extends RunCounters {
  runId: string;
  status: RunStatus;
}

/** Abaixo desta fração do total anterior, a varredura é tratada como suspeita. */
const SUSPECT_RATIO = 0.5;

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Percorre a listagem até cobrir o total anunciado pela fonte. */
async function scanList<Item extends { id: string }>(
  plan: SourceImport<Item>,
): Promise<{ items: Item[]; isFullScan: boolean }> {
  const byId = new Map<string, Item>();
  let total = 0;

  for (let page = 1; plan.maxPages === undefined || page <= plan.maxPages; page += 1) {
    const result = await plan.listPage(page);
    total = result.total;
    for (const item of result.items) byId.set(item.id, item);

    const lastPage = Math.ceil(total / plan.pageSize);
    if (result.items.length === 0 || byId.size >= total || page >= lastPage) break;
  }
  return { items: [...byId.values()], isFullScan: total > 0 && byId.size >= total };
}

/** Com limite de detalhes, prioriza registros nunca importados e depois os vistos há mais tempo. */
async function pickTargets<Item extends { id: string }>(
  plan: SourceImport<Item>,
  sourceId: string,
  items: Item[],
): Promise<Item[]> {
  if (plan.maxDetails === undefined || items.length <= plan.maxDetails) return items;

  const lastSeen = await plan.lastSeenByExternalId(sourceId);
  const priority = (await plan.priorityExternalIds?.(sourceId)) ?? new Set<string>();
  // Ordem: referenciados e nunca importados; nunca importados; vistos há mais tempo.
  const rank = (item: Item): number => {
    const seenAt = lastSeen.get(item.id);
    if (seenAt !== undefined) return seenAt;
    return priority.has(item.id) ? -2 : -1;
  };

  return [...items].sort((a, b) => rank(a) - rank(b)).slice(0, plan.maxDetails);
}

/**
 * Guarda o registro bruto e chama `persist` para normalizar e gravar. Se a
 * normalização falhar, o bruto fica marcado como falho, com a mensagem do erro.
 */
export async function storeAndPersist(
  db: Database,
  raw: SaveRawInput,
  persist: (rawRecordId: string) => Promise<void>,
): Promise<RawChange> {
  const saved = await saveRawRecord(db, raw);
  try {
    await persist(saved.id);
  } catch (error) {
    await markRawFailed(db, saved.id, errorMessage(error));
    throw error;
  }
  return saved.change;
}

/** Fluxo comum de coleta: listagem → registro bruto → normalização → banco → ausentes. */
export async function runSourceImport<Item extends { id: string }>(
  plan: SourceImport<Item>,
): Promise<ImportSummary> {
  const { db } = plan;
  const log: string[] = [];
  const say = (message: string): void => {
    log.push(message);
    plan.log?.(message);
  };

  const { sourceId, datasetId } = await findDataset(db, plan.sourceSlug, plan.entityType);
  const runId = await startRun(db, datasetId, plan.trigger);
  const counters: RunCounters = { found: 0, created: 0, updated: 0, unchanged: 0, failed: 0, missing: 0 };
  const errors: string[] = [];

  try {
    const scan = await scanList(plan);
    counters.found = scan.items.length;
    say(`Listagem: ${scan.items.length} registros (varredura completa: ${scan.isFullScan}).`);

    const extras =
      (await plan.extraItems?.(sourceId, new Set(scan.items.map((item) => item.id)))) ?? [];
    if (extras.length > 0) say(`Fora da listagem, citados por outros registros: ${extras.length}.`);

    for (const item of [...extras, ...(await pickTargets(plan, sourceId, scan.items))]) {
      try {
        counters[await plan.importOne({ sourceId, runId }, item)] += 1;
      } catch (error) {
        counters.failed += 1;
        errors.push(`${plan.label} ${item.id}: ${errorMessage(error)}`);
        say(`Falha em ${plan.label.toLowerCase()} ${item.id}: ${errorMessage(error)}`);
      }
    }

    const previous = await previousFullScanFound(db, datasetId, runId);
    const isSuspect =
      scan.isFullScan && previous !== null && scan.items.length < previous * SUSPECT_RATIO;
    if (isSuspect) {
      say(`Varredura suspeita: ${scan.items.length} registros contra ${previous} na anterior.`);
    } else if (scan.isFullScan) {
      counters.missing = await plan.markMissing(
        sourceId,
        [...scan.items, ...extras].map((item) => item.id),
      );
    }
    await plan.afterImport?.(sourceId);

    const status: RunStatus = isSuspect ? "suspect" : counters.failed > 0 ? "partial" : "success";
    await finishRun(db, runId, datasetId, {
      ...counters,
      status,
      isFullScan: scan.isFullScan,
      errors,
      log,
    });
    return { runId, status, ...counters };
  } catch (error) {
    errors.push(errorMessage(error));
    await finishRun(db, runId, datasetId, {
      ...counters,
      status: "failed",
      isFullScan: false,
      errors,
      log,
    });
    throw error;
  }
}
