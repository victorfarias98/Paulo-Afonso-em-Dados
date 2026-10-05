import { type SQL, sql } from "drizzle-orm";

import { getDb } from "./db";

async function rowsOf<T>(query: SQL): Promise<T[]> {
  return (await getDb().execute(query)) as unknown as T[];
}

export interface AdminRun {
  id: string;
  sourceName: string;
  entityType: string;
  status: string;
  startedAt: string;
  found: number;
  created: number;
  updated: number;
  failed: number;
  missing: number;
  errorSummary: string | null;
}

export interface AdminAlert {
  sourceName: string;
  entityType: string;
  reason: string;
}

export interface FailedRecord {
  sourceName: string;
  entityType: string;
  externalId: string;
  sourceUrl: string;
  error: string | null;
  lastSeenAt: string;
}

export interface UnlinkedWork {
  id: string;
  title: string;
  contractNumber: string | null;
  contractExternalId: string | null;
}

const RUN_LIMIT = 40;
const FAILED_LIMIT = 50;
/** Sem coleta concluída há mais tempo que isso, o conjunto de dados é sinalizado. */
const STALE_AFTER_HOURS = 36;

const atBahia = (column: SQL): SQL =>
  sql`to_char(${column} at time zone 'America/Bahia', 'DD/MM/YYYY HH24:MI')`;

export function listRecentRuns(): Promise<AdminRun[]> {
  return rowsOf<AdminRun>(sql`
    select r.id, s.name as "sourceName", d.entity_type as "entityType", r.status,
           ${atBahia(sql`r.started_at`)} as "startedAt",
           r.records_found as found, r.records_created as created, r.records_updated as updated,
           r.records_failed as failed, r.records_missing as missing, r.error_summary as "errorSummary"
      from ingestion_runs r
      join source_datasets d on d.id = r.source_dataset_id
      join sources s on s.id = d.source_id
     order by r.started_at desc
     limit ${RUN_LIMIT}
  `);
}

/** Conjuntos de dados cuja última coleta não foi bem ou que estão sem coleta concluída recente. */
export function listAlerts(): Promise<AdminAlert[]> {
  return rowsOf<AdminAlert>(sql`
    select s.name as "sourceName", d.entity_type as "entityType",
           case
             when last.status is null then 'nunca coletado'
             when last.status <> 'success' then 'última coleta terminou como ' || last.status
             else 'sem coleta concluída recente'
           end as reason
      from source_datasets d
      join sources s on s.id = d.source_id
      left join lateral (
        select status from ingestion_runs where source_dataset_id = d.id
         order by started_at desc limit 1
      ) last on true
     where d.is_enabled
       and (last.status is null or last.status <> 'success'
            or d.last_success_at is null
            or d.last_success_at < now() - make_interval(hours => ${STALE_AFTER_HOURS}))
     order by s.name, d.entity_type
  `);
}

export function listFailedRecords(): Promise<FailedRecord[]> {
  return rowsOf<FailedRecord>(sql`
    select s.name as "sourceName", r.entity_type as "entityType", r.external_id as "externalId",
           r.source_url as "sourceUrl", r.import_error as error,
           ${atBahia(sql`r.last_seen_at`)} as "lastSeenAt"
      from raw_records r
      join sources s on s.id = r.source_id
     where r.import_status = 'failed'
     order by r.last_seen_at desc
     limit ${FAILED_LIMIT}
  `);
}

/** Obras cuja fonte indica um contrato que ainda não está ligado no portal. */
export function listUnlinkedWorks(): Promise<UnlinkedWork[]> {
  return rowsOf<UnlinkedWork>(sql`
    select id, title, contract_number as "contractNumber", contract_external_id as "contractExternalId"
      from public_works
     where contract_external_id is not null and contract_id is null and source_missing_since is null
     order by title
  `);
}

export interface ManualLink {
  id: string;
  workId: string;
  workTitle: string;
  contractId: string;
  contractNumber: string;
  justification: string | null;
  author: string | null;
  createdAt: string;
}

/** Vínculos obra → contrato feitos à mão e ainda em vigor. */
export function listManualLinks(): Promise<ManualLink[]> {
  return rowsOf<ManualLink>(sql`
    select l.id, w.id as "workId", w.title as "workTitle", c.id as "contractId",
           c.number as "contractNumber", l.evidence ->> 'justificativa' as justification,
           u.login as author, ${atBahia(sql`l.created_at`)} as "createdAt"
      from entity_links l
      join public_works w on w.id = l.from_id
      join contracts c on c.id = l.to_id
      left join admin_users u on u.id = l.created_by
     where l.method = 'manual' and l.revoked_at is null
       and l.from_type = 'public_work' and l.to_type = 'contract'
     order by l.created_at desc
  `);
}

export interface ActiveOverride {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  original: string | null;
  corrected: string | null;
  justification: string;
  author: string;
  createdAt: string;
}

/** Correções manuais em vigor, das mais recentes para as mais antigas. */
export function listActiveOverrides(): Promise<ActiveOverride[]> {
  return rowsOf<ActiveOverride>(sql`
    select o.id, o.entity_type as "entityType", o.entity_id as "entityId", o.field,
           o.original_value #>> '{}' as original, o.corrected_value #>> '{}' as corrected,
           o.justification, u.login as author, ${atBahia(sql`o.created_at`)} as "createdAt"
      from manual_overrides o
      join admin_users u on u.id = o.user_id
     where o.revoked_at is null
     order by o.created_at desc
  `);
}

export interface CollectionRequestRow {
  id: string;
  job: string;
  status: string;
  author: string | null;
  requestedAt: string;
  finishedAt: string | null;
  message: string | null;
}

const REQUEST_LIMIT = 10;

export function listCollectionRequests(): Promise<CollectionRequestRow[]> {
  return rowsOf<CollectionRequestRow>(sql`
    select r.id, r.job, r.status, u.login as author,
           ${atBahia(sql`r.requested_at`)} as "requestedAt",
           ${atBahia(sql`r.finished_at`)} as "finishedAt", r.message
      from collection_requests r
      left join admin_users u on u.id = r.requested_by
     order by r.requested_at desc
     limit ${REQUEST_LIMIT}
  `);
}
