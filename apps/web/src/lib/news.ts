import { type SQL, sql } from "drizzle-orm";

import { getDb } from "./db";
import {
  buildLegislativeSummary,
  type LegislativeMemberSummary,
  type LegislativeSnapshot,
} from "./legislative";

async function rowsOf<T>(query: SQL): Promise<T[]> {
  return (await getDb().execute(query)) as unknown as T[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  sourceName: string;
  href: string;
  kind: "coleta" | "legislativo";
  created: number;
  updated: number;
}

export interface OrganizationStory {
  id: string;
  name: string;
  acronym: string | null;
  branch: string;
  contracts: number;
  works: number;
  bids: number;
  href: string;
}

export interface PoliticalStory extends LegislativeMemberSummary {
  href: string;
}

export interface NewsFilters {
  days?: number;
  limit?: number;
  source?: string;
}

const clamp = (value: number | undefined, fallback: number, max: number): number =>
  Math.max(1, Math.min(max, Math.trunc(value ?? fallback)));

/**
 * Coletas não geram uma notícia vazia: só entram no feed quando trouxeram
 * registros novos ou alterados. Assim o feed pode ser atualizado diariamente
 * pelo worker sem criar uma tabela duplicada ou exigir publicação manual.
 */
export async function listNews(filters: NewsFilters = {}): Promise<NewsItem[]> {
  const days = clamp(filters.days, 14, 90);
  const limit = clamp(filters.limit, 30, 100);
  const source = filters.source?.trim() || null;
  const rows = await rowsOf<NewsItem>(sql`
    select
      r.id,
      case
        when r.records_created > 0 and r.records_updated > 0 then 'Novos dados e atualizações em ' || s.name
        when r.records_created > 0 then 'Novos dados em ' || s.name
        else 'Dados atualizados em ' || s.name
      end as title,
      d.entity_type || ' atualizado pela fonte oficial.' as summary,
      to_char(r.finished_at at time zone 'America/Bahia', 'YYYY-MM-DD') as date,
      s.name as "sourceName",
      '/fontes' as href,
      'coleta' as kind,
      r.records_created as created,
      r.records_updated as updated
    from ingestion_runs r
    join source_datasets d on d.id = r.source_dataset_id
    join sources s on s.id = d.source_id
    where r.status in ('success', 'partial')
      and r.finished_at >= now() - make_interval(days => ${days})
      and (r.records_created > 0 or r.records_updated > 0)
      and (${source}::text is null or s.slug = ${source})
    order by r.finished_at desc
    limit ${limit}
  `);
  return rows;
}

export function listPoliticalStories(snapshot: LegislativeSnapshot): PoliticalStory[] {
  return buildLegislativeSummary(snapshot).members.map((member) => ({
    ...member,
    href: `/novidades/politico/${member.id}`,
  }));
}

/** Resumo por órgão usando somente registros normalizados e visíveis no portal. */
export function listOrganizationStories(): Promise<OrganizationStory[]> {
  return rowsOf<OrganizationStory>(sql`
    select a.id, a.name, a.acronym, a.branch,
      (select count(*)::int from contracts c where c.agency_id = a.id and c.source_missing_since is null) as contracts,
      (select count(*)::int from public_works w where w.agency_id = a.id and w.source_missing_since is null) as works,
      (select count(*)::int from bids b where b.agency_id = a.id and b.source_missing_since is null) as bids,
      '/novidades/orgao/' || a.id as href
    from agencies a
    where exists (select 1 from contracts c where c.agency_id = a.id and c.source_missing_since is null)
       or exists (select 1 from public_works w where w.agency_id = a.id and w.source_missing_since is null)
       or exists (select 1 from bids b where b.agency_id = a.id and b.source_missing_since is null)
    order by a.name
  `);
}

export function findPoliticalStory(
  snapshot: LegislativeSnapshot,
  id: number,
): PoliticalStory | null {
  return listPoliticalStories(snapshot).find((member) => member.id === id) ?? null;
}

export interface OrganizationStoryDetail extends OrganizationStory {
  recentNews: NewsItem[];
}

export async function findOrganizationStory(id: string): Promise<OrganizationStoryDetail | null> {
  const rows = await rowsOf<OrganizationStory>(sql`
    select a.id, a.name, a.acronym, a.branch,
      (select count(*)::int from contracts c where c.agency_id = a.id and c.source_missing_since is null) as contracts,
      (select count(*)::int from public_works w where w.agency_id = a.id and w.source_missing_since is null) as works,
      (select count(*)::int from bids b where b.agency_id = a.id and b.source_missing_since is null) as bids,
      '/novidades/orgao/' || a.id as href
    from agencies a where a.id = ${id}
  `);
  const organization = rows[0];
  if (!organization) return null;
  const recentNews = await listNews({ limit: 12 });
  return { ...organization, recentNews };
}
