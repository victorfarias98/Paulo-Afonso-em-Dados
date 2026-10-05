import type { ExpensePhase, ExpenseRow, MunicipioOnlineClient } from "@pad/data-sources";
import {
  commitments,
  type Database,
  liquidations,
  MUNICIPIO_ONLINE_PMPA,
  payments,
  type RunStatus,
  type RunTrigger,
} from "@pad/database";
import { addDays } from "@pad/domain";
import { sql } from "drizzle-orm";

import { linkProvenance, type Tx } from "../pipeline/provenance";
import { errorMessage, type ImportSummary, storeAndPersist } from "../pipeline/run-import";
import { finishRun, findDataset, type RunCounters, startRun } from "../pipeline/runs";
import { resolveAgency, upsertSupplier } from "../siger/contract-repository";
import { linkExpensesToCommitments, linkExpensesToContracts } from "../siger/links";
import { expenseKey, type NormalizedExpense, normalizeExpense } from "./normalize-expense";

export interface ImportExpensesOptions {
  db: Database;
  client: MunicipioOnlineClient;
  pageUrl: string;
  /** Fonte cadastrada a que a página pertence; por padrão, a da Prefeitura. */
  sourceSlug?: string | undefined;
  phase: ExpensePhase;
  year: number;
  /** Meses a coletar, de 1 a 12. */
  months: number[];
  /** Data de referência, em AAAA-MM-DD. */
  today: string;
  trigger: RunTrigger;
  log?: ((message: string) => void) | undefined;
}

const LABELS: Record<ExpensePhase, string> = {
  commitment: "Empenho",
  liquidation: "Liquidação",
  payment: "Pagamento",
};

/** Tabela e coluna de data de cada fase, para as consultas por mês. */
const TARGETS: Record<ExpensePhase, { table: string; date: string }> = {
  commitment: { table: "commitments", date: "commitment_date" },
  liquidation: { table: "liquidations", date: "liquidation_date" },
  payment: { table: "payments", date: "payment_date" },
};

async function upsertExpense(
  tx: Tx,
  phase: ExpensePhase,
  sourceId: string,
  normalized: NormalizedExpense,
  agencyId: string | null,
  supplierId: string | null,
): Promise<string> {
  const { date, value, reinforcedValue, retainedValue, ...common } = normalized.record;
  const shared = { ...common, agencyId, supplierId };
  const tracking = { sourceMissingSince: null, lastSeenAt: sql`now()`, updatedAt: sql`now()` };

  if (phase === "commitment") {
    // O empenho não cita outro empenho; a coluna só existe em liquidações e pagamentos.
    const { commitmentNumber: _none, ...ownFields } = shared;
    const values = {
      ...ownFields,
      number: common.number ?? "",
      commitmentDate: date,
      committedValue: value,
      reinforcedValue,
    };
    const [row] = await tx
      .insert(commitments)
      .values({ ...values, sourceId })
      .onConflictDoUpdate({
        target: [commitments.sourceId, commitments.externalId],
        set: { ...values, ...tracking },
      })
      .returning({ id: commitments.id });
    if (row) return row.id;
  } else if (phase === "liquidation") {
    const values = { ...shared, liquidationDate: date, value, retainedValue };
    const [row] = await tx
      .insert(liquidations)
      .values({ ...values, sourceId })
      .onConflictDoUpdate({
        target: [liquidations.sourceId, liquidations.externalId],
        set: { ...values, ...tracking },
      })
      .returning({ id: liquidations.id });
    if (row) return row.id;
  } else {
    const values = { ...shared, paymentDate: date, value, retainedValue };
    const [row] = await tx
      .insert(payments)
      .values({ ...values, sourceId })
      .onConflictDoUpdate({
        target: [payments.sourceId, payments.externalId],
        set: { ...values, ...tracking },
      })
      .returning({ id: payments.id });
    if (row) return row.id;
  }
  throw new Error(`Não foi possível gravar ${LABELS[phase].toLowerCase()} ${common.externalId}.`);
}

async function persistExpense(
  db: Database,
  phase: ExpensePhase,
  sourceId: string,
  rawRecordId: string,
  normalized: NormalizedExpense,
): Promise<void> {
  await db.transaction(async (tx) => {
    const supplierId = normalized.supplier ? await upsertSupplier(tx, normalized.supplier) : null;
    const agencyId = normalized.agency
      ? await resolveAgency(tx, sourceId, normalized.agency.alias, normalized.agency.name)
      : null;
    const id = await upsertExpense(tx, phase, sourceId, normalized, agencyId, supplierId);
    await linkProvenance(tx, phase, id, rawRecordId, normalized.transformations);
  });
}

/** Condição SQL "registro desta fonte dentro do mês". */
function inMonth(phase: ExpensePhase, sourceId: string, year: number, month: number) {
  const { date } = TARGETS[phase];
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const until = `${addDays(from, 32).slice(0, 8)}01`;
  const column = sql.identifier(date);
  return sql`source_id = ${sourceId} and ${column} >= ${from} and ${column} < ${until}`;
}

async function countInMonth(
  db: Database,
  phase: ExpensePhase,
  sourceId: string,
  year: number,
  month: number,
): Promise<number> {
  const table = sql.identifier(TARGETS[phase].table);
  const rows = (await db.execute(
    sql`select count(*)::int as total from ${table} where ${inMonth(phase, sourceId, year, month)}`,
  )) as unknown as Array<{ total: number }>;
  return rows[0]?.total ?? 0;
}

/** Marca como ausentes os registros do mês que não vieram nesta coleta; nunca apaga. */
async function markMissingInMonth(
  db: Database,
  phase: ExpensePhase,
  sourceId: string,
  year: number,
  month: number,
  seenIds: string[],
  today: string,
): Promise<number> {
  const table = sql.identifier(TARGETS[phase].table);
  const month_ = inMonth(phase, sourceId, year, month);

  await db.execute(
    sql`update ${table} set source_missing_since = null
         where ${month_} and source_missing_since is not null and external_id in ${seenIds}`,
  );
  const gone = (await db.execute(
    sql`update ${table} set source_missing_since = ${today}
         where ${month_} and source_missing_since is null and external_id not in ${seenIds}
        returning id`,
  )) as unknown as unknown[];
  return gone.length;
}

/**
 * Refaz a normalização de uma fase a partir da versão mais recente de cada
 * registro bruto já guardado, sem consultar a fonte. Usado quando uma regra de
 * normalização muda. Devolve quantos registros foram regravados e quantos falharam.
 */
export async function reprocessExpenses(
  db: Database,
  phase: ExpensePhase,
  pageUrl: string,
  sourceSlug: string = MUNICIPIO_ONLINE_PMPA,
): Promise<{ reprocessed: number; failed: number }> {
  const { sourceId } = await findDataset(db, sourceSlug, phase);
  const latest = (await db.execute(sql`
    select distinct on (external_id) id, payload
      from raw_records
     where source_id = ${sourceId} and entity_type = ${phase}
     order by external_id, last_seen_at desc
  `)) as unknown as Array<{ id: string; payload: ExpenseRow }>;

  let failed = 0;
  for (const raw of latest) {
    try {
      await persistExpense(db, phase, sourceId, raw.id, normalizeExpense(phase, raw.payload, pageUrl));
    } catch {
      failed += 1;
    }
  }
  await linkExpensesToContracts(db);
  await linkExpensesToCommitments(db);
  return { reprocessed: latest.length - failed, failed };
}

/** Coleta uma fase da despesa do Município Online, mês a mês. */
export async function importMunicipioOnlineExpenses(
  options: ImportExpensesOptions,
): Promise<ImportSummary> {
  const { db, client, phase, year, pageUrl, today } = options;
  const log: string[] = [];
  const say = (message: string): void => {
    log.push(message);
    options.log?.(message);
  };

  const { sourceId, datasetId } = await findDataset(
    db,
    options.sourceSlug ?? MUNICIPIO_ONLINE_PMPA,
    phase,
  );
  const runId = await startRun(db, datasetId, options.trigger);
  const counters: RunCounters = { found: 0, created: 0, updated: 0, unchanged: 0, failed: 0, missing: 0 };
  const errors: string[] = [];
  let isSuspect = false;

  const importRow = (row: ExpenseRow, externalId: string) =>
    storeAndPersist(
      db,
      {
        sourceId,
        entityType: phase,
        externalId,
        sourceUrl: pageUrl,
        fetchMethod: "html_form_post",
        payload: row,
        runId,
      },
      (rawRecordId) =>
        persistExpense(db, phase, sourceId, rawRecordId, normalizeExpense(phase, row, pageUrl)),
    );

  try {
    for (const month of options.months) {
      const rows = await client.fetchMonth(phase, year, month);
      counters.found += rows.length;
      say(`${LABELS[phase]} ${String(month).padStart(2, "0")}/${year}: ${rows.length} registros.`);

      // Mês que já tinha registros e voltou vazio indica falha na fonte, não remoção em massa.
      if (rows.length === 0) {
        if ((await countInMonth(db, phase, sourceId, year, month)) > 0) {
          isSuspect = true;
          say(`Mês ${month}/${year} voltou vazio, mas já tinha registros: nada foi marcado como ausente.`);
        }
        continue;
      }

      const seen = new Set<string>();
      for (const row of rows) {
        try {
          const externalId = expenseKey(row);
          // Dois registros com o mesmo identificador se sobrescreveriam: vira erro visível.
          if (seen.has(externalId)) {
            throw new Error(`identificador ${externalId} repetido na mesma coleta`);
          }
          seen.add(externalId);
          counters[await importRow(row, externalId)] += 1;
        } catch (error) {
          counters.failed += 1;
          errors.push(`${LABELS[phase]} ${row.Chave ?? "?"}: ${errorMessage(error)}`);
        }
      }
      if (seen.size > 0) {
        counters.missing += await markMissingInMonth(db, phase, sourceId, year, month, [...seen], today);
      }
    }
    await linkExpensesToContracts(db);
    await linkExpensesToCommitments(db);

    const status: RunStatus = isSuspect ? "suspect" : counters.failed > 0 ? "partial" : "success";
    await finishRun(db, runId, datasetId, { ...counters, status, isFullScan: true, errors, log });
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
