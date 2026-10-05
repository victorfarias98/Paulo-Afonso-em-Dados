import { type CollectionJob, type Database } from "@pad/database";
import { sql } from "drizzle-orm";

export type JobRunners = Record<CollectionJob, () => Promise<void>>;

interface ClaimedRequest {
  id: string;
  job: CollectionJob;
}

const MAX_MESSAGE_LENGTH = 500;

/** Pega o pedido pendente mais antigo e o marca como em execução, de forma atômica. */
export async function claimNextRequest(db: Database): Promise<ClaimedRequest | null> {
  const rows = (await db.execute(sql`
    update collection_requests
       set status = 'running', started_at = now()
     where id = (
       select id from collection_requests
        where status = 'pending'
        order by requested_at
        limit 1
        for update skip locked
     )
    returning id, job
  `)) as unknown as ClaimedRequest[];
  return rows[0] ?? null;
}

async function finishRequest(
  db: Database,
  id: string,
  status: "done" | "failed",
  message: string,
): Promise<void> {
  await db.execute(sql`
    update collection_requests
       set status = ${status}, finished_at = now(), message = ${message.slice(0, MAX_MESSAGE_LENGTH)}
     where id = ${id}
  `);
}

/**
 * Pedidos que ficaram "em execução" quando o worker foi reiniciado nunca
 * terminariam; são encerrados como falha para liberar um novo pedido igual.
 */
export async function failInterruptedRequests(db: Database): Promise<number> {
  const rows = (await db.execute(sql`
    update collection_requests
       set status = 'failed', finished_at = now(),
           message = 'Interrompido: o worker foi reiniciado durante a execução.'
     where status = 'running'
    returning id
  `)) as unknown as Array<{ id: string }>;
  return rows.length;
}

/** Executa, um por vez, todos os pedidos de coleta pendentes. Devolve quantos executou. */
export async function processPendingRequests(
  db: Database,
  runners: JobRunners,
  log: (message: string) => void,
): Promise<number> {
  let processed = 0;
  for (;;) {
    const request = await claimNextRequest(db);
    if (!request) return processed;
    processed += 1;

    const runner = runners[request.job] as (() => Promise<void>) | undefined;
    if (!runner) {
      await finishRequest(db, request.id, "failed", `Coleta desconhecida: ${request.job}.`);
      continue;
    }
    try {
      log(`Pedido do admin: coleta de ${request.job}`);
      await runner();
      await finishRequest(db, request.id, "done", "Executado. Veja o resultado em Últimas coletas.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Pedido do admin falhou (${request.job}): ${message}`);
      await finishRequest(db, request.id, "failed", message);
    }
  }
}
