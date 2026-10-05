import { type SQL, sql } from "drizzle-orm";

import { getDb } from "./db";
import { likePattern } from "./provenance";

async function rowsOf<T>(query: SQL): Promise<T[]> {
  return (await getDb().execute(query)) as unknown as T[];
}

export interface HomeNumbers {
  activeContracts: number;
  importedContracts: number;
  contractedTotal: string;
  works: number;
  worksInProgress: number;
  worksPastOriginalDeadline: number;
  bids: number;
  latestExpenseYear: number | null;
}

/** Números da página inicial. Cada um corresponde a uma lista filtrada do portal. */
export async function getHomeNumbers(): Promise<HomeNumbers> {
  const [row] = await rowsOf<HomeNumbers>(sql`
    select
      (select count(*)::int from contracts
        where status = 'vigente' and source_missing_since is null
          and kind <> 'termo_aditivo') as "activeContracts",
      (select count(*)::int from contracts
        where source_missing_since is null and kind <> 'termo_aditivo') as "importedContracts",
      -- Termos aditivos ficam fora: somá-los ao contrato original contaria o valor duas vezes.
      (select coalesce(sum(original_value), 0)::text from contracts
        where status = 'vigente' and source_missing_since is null
          and kind <> 'termo_aditivo') as "contractedTotal",
      (select count(*)::int from public_works where source_missing_since is null) as works,
      (select count(*)::int from public_works
        where status = 'em_andamento' and source_missing_since is null) as "worksInProgress",
      (select count(*)::int from public_works
        where status = 'prazo_vencido' and source_missing_since is null) as "worksPastOriginalDeadline",
      (select count(*)::int from bids where source_missing_since is null) as bids,
      (select max(fiscal_year) from payments) as "latestExpenseYear"
  `);
  if (!row) throw new Error("Não foi possível calcular os números da página inicial.");
  return row;
}

export interface DatasetStatus {
  sourceName: string;
  agencyName: string;
  baseUrl: string;
  isDocumented: boolean;
  notes: string | null;
  entityType: string | null;
  lastSuccessAt: Date | null;
  lastStatus: string | null;
  lastStartedAt: Date | null;
  records: number;
  failedRecords: number;
}

type RawDatasetStatus = Omit<DatasetStatus, "lastSuccessAt" | "lastStartedAt"> & {
  lastSuccessAt: string | Date | null;
  lastStartedAt: string | Date | null;
};

/** Consultas em SQL puro devolvem datas como texto; aqui viram `Date`. */
const toDate = (value: string | Date | null): Date | null =>
  value === null ? null : new Date(value);

/** Situação de cada fonte e conjunto de dados, para a página /fontes. */
export async function listSourceStatus(): Promise<DatasetStatus[]> {
  const rows = await rowsOf<RawDatasetStatus>(sql`
    select s.name as "sourceName", s.agency_name as "agencyName", s.base_url as "baseUrl",
           s.is_documented as "isDocumented", s.notes,
           d.entity_type as "entityType", d.last_success_at as "lastSuccessAt",
           r.status as "lastStatus", r.started_at as "lastStartedAt",
           coalesce(c.records, 0)::int as records, coalesce(c.failed, 0)::int as "failedRecords"
      from sources s
      left join source_datasets d on d.source_id = s.id
      left join lateral (
        select status, started_at
          from ingestion_runs where source_dataset_id = d.id
         order by started_at desc limit 1
      ) r on true
      left join lateral (
        select count(distinct external_id) as records,
               count(distinct external_id) filter (where import_status = 'failed') as failed
          from raw_records where source_id = s.id and entity_type = d.entity_type
      ) c on true
     order by s.name, d.entity_type
  `);
  return rows.map((row) => ({
    ...row,
    lastSuccessAt: toDate(row.lastSuccessAt),
    lastStartedAt: toDate(row.lastStartedAt),
  }));
}

export interface SearchHit {
  id: string;
  title: string;
  detail: string | null;
}

export interface SearchResults {
  suppliers: SearchHit[];
  works: SearchHit[];
  contracts: SearchHit[];
  bids: SearchHit[];
}

const SEARCH_LIMIT = 8;

/** Busca global por nome de empresa, obra, contrato ou licitação. */
export async function searchEverything(query: string): Promise<SearchResults> {
  const pattern = likePattern(query);
  const [suppliers, works, contracts, bids] = await Promise.all([
    rowsOf<SearchHit>(sql`
      select id, legal_name as title, null as detail from suppliers
       where document_type = 'cnpj' and legal_name ilike ${pattern}
       order by legal_name limit ${SEARCH_LIMIT}
    `),
    rowsOf<SearchHit>(sql`
      select id, title, description as detail from public_works
       where title ilike ${pattern} or description ilike ${pattern}
       order by start_date desc nulls last limit ${SEARCH_LIMIT}
    `),
    rowsOf<SearchHit>(sql`
      select c.id, c.number as title, c.description as detail
        from contracts c left join suppliers s on s.id = c.supplier_id
       where c.number ilike ${pattern} or c.description ilike ${pattern} or s.legal_name ilike ${pattern}
       order by c.signed_at desc nulls last limit ${SEARCH_LIMIT}
    `),
    rowsOf<SearchHit>(sql`
      select id, number as title, description as detail from bids
       where number ilike ${pattern} or description ilike ${pattern}
       order by published_at desc nulls last limit ${SEARCH_LIMIT}
    `),
  ]);
  return { suppliers, works, contracts, bids };
}
