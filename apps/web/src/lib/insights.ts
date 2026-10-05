import { type SQL, sql } from "drizzle-orm";

import { getDb } from "./db";

const ONE_DECIMAL = 10;

/** Quanto a parte representa do total, em % com uma casa. Sem total positivo, null. */
export function percentOf(part: string | number, total: string | number): number | null {
  const whole = Number(total);
  if (!(whole > 0)) return null;
  return Math.round((Number(part) / whole) * 100 * ONE_DECIMAL) / ONE_DECIMAL;
}

/** "De cada R$ 100, quantos foram para a parte". Parte existente nunca aparece como zero. */
export function perHundred(part: string | number, total: string | number): number {
  const share = percentOf(part, total);
  if (share === null || Number(part) <= 0) return 0;
  return Math.max(1, Math.round(share));
}

export interface SplitRow {
  key: string;
  label: string;
  total: string;
}

export interface SplitPart {
  key: string;
  label: string;
  /** Participação no total, em %, com uma casa. */
  share: number;
  /** Null no grupo "demais", que não corresponde a um registro só. */
  sourceKey: string | null;
}

/**
 * Divide o total nas maiores partes e junta as restantes em um grupo. As
 * participações sempre somam 100: o grupo final recebe a diferença.
 */
export function splitOfHundred(rows: SplitRow[], keep: number, restLabel: string): SplitPart[] {
  const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
  if (!(total > 0)) return [];

  const sorted = [...rows].sort((a, b) => Number(b.total) - Number(a.total));
  const top = sorted.slice(0, keep).map((row) => ({
    key: row.key,
    label: row.label,
    share: percentOf(row.total, total) ?? 0,
    sourceKey: row.key,
  }));
  if (sorted.length <= keep) return top;

  const used = top.reduce((sum, part) => sum + part.share, 0);
  const rest = Math.round((100 - used) * ONE_DECIMAL) / ONE_DECIMAL;
  return [...top, { key: "demais", label: restLabel, share: rest, sourceKey: null }];
}

export interface HomeFacts {
  payrollPaid: string;
  worksOpen: number;
  worksOpenValue: string;
  worksPastOriginalDeadline: number;
  contractsEndingSoon: number;
  topModality: string | null;
  topModalityCount: number;
  bidsInYear: number;
}

/** Janela usada em "contratos que vencem em breve". */
export const ENDING_SOON_DAYS = 90;

async function rowsOf<T>(query: SQL): Promise<T[]> {
  return (await getDb().execute(query)) as unknown as T[];
}

/**
 * Fatos calculados para a página inicial. Todos são contagens e somas sobre os
 * registros importados; nenhum é estimativa. `today` em AAAA-MM-DD.
 */
export async function getHomeFacts(year: number, today: string): Promise<HomeFacts> {
  const [row] = await rowsOf<HomeFacts>(sql`
    select
      (select coalesce(sum(p.value - coalesce(p.cancelled_value, 0)), 0)::text
         from payments p join suppliers s on s.id = p.supplier_id
        where p.fiscal_year = ${year} and p.source_missing_since is null
          and p.source_id = (select id from sources where slug = 'municipio-online-pmpa')
          and s.legal_name ilike 'FOLHA DE PAGAMENTO%') as "payrollPaid",
      (select count(*)::int from public_works
        where source_missing_since is null
          and status in ('em_andamento', 'prazo_vencido')) as "worksOpen",
      (select coalesce(sum(initial_value), 0)::text from public_works
        where source_missing_since is null
          and status in ('em_andamento', 'prazo_vencido')) as "worksOpenValue",
      (select count(*)::int from public_works
        where source_missing_since is null
          and status = 'prazo_vencido') as "worksPastOriginalDeadline",
      (select count(*)::int from contracts
        where source_missing_since is null and status = 'vigente' and kind <> 'termo_aditivo'
          and ends_at >= ${today}::date
          and ends_at < ${today}::date + ${ENDING_SOON_DAYS}::int) as "contractsEndingSoon",
      (select modality from bids
        where source_missing_since is null and modality is not null
          and extract(year from coalesce(published_at, opening_date)) = ${year}
        group by modality order by count(*) desc, modality limit 1) as "topModality",
      (select count(*)::int from bids
        where source_missing_since is null and modality is not null
          and extract(year from coalesce(published_at, opening_date)) = ${year}
        group by modality order by count(*) desc, modality limit 1) as "topModalityCount",
      (select count(*)::int from bids
        where source_missing_since is null
          and extract(year from coalesce(published_at, opening_date)) = ${year}) as "bidsInYear"
  `);
  if (!row) throw new Error("Não foi possível calcular os fatos da página inicial.");
  return { ...row, topModalityCount: row.topModalityCount ?? 0 };
}

/**
 * Moradores de Paulo Afonso no Censo 2022 do IBGE (tabela 4709, município
 * 2924009), consultado na API do IBGE em 2026-10-05.
 */
export const POPULATION = 112_870;
export const POPULATION_SOURCE = "IBGE, Censo 2022";

/** Quanto o valor representa para cada morador, em reais inteiros. */
export function perResident(total: string | number): number {
  return Math.round(Number(total) / POPULATION);
}

export interface FeaturedWork {
  id: string;
  title: string;
  neighborhood: string | null;
  supplierName: string | null;
  initialValue: string;
  startDate: string | null;
  expectedEndDate: string | null;
}

/** A obra em andamento de maior valor informado, para ser contada na página inicial. */
export async function getFeaturedWork(): Promise<FeaturedWork | null> {
  const rows = await rowsOf<FeaturedWork>(sql`
    select w.id, w.title, w.initial_value::text as "initialValue",
           to_char(w.start_date, 'YYYY-MM-DD') as "startDate",
           to_char(w.expected_end_date, 'YYYY-MM-DD') as "expectedEndDate",
           s.legal_name as "supplierName",
           (select a.neighborhood from public_work_addresses a
             where a.public_work_id = w.id order by a.position limit 1) as neighborhood
      from public_works w
      left join contracts c on c.id = w.contract_id
      left join suppliers s on s.id = c.supplier_id
     where w.source_missing_since is null and w.status = 'em_andamento'
       and w.initial_value is not null
     order by w.initial_value desc, w.id
     limit 1
  `);
  return rows[0] ?? null;
}

export interface RecentPayment {
  id: string;
  date: string;
  value: string;
  recipient: string | null;
  agencyName: string | null;
  description: string | null;
}

const RECENT_PAYMENTS = 4;
/** Salários entram como um único recebedor por secretaria e esconderiam os demais pagamentos. */
const PAYROLL_PREFIX = "FOLHA DE PAGAMENTO%";

/** Os pagamentos mais recentes da Prefeitura a empresas, do maior para o menor no último dia. */
export async function listRecentPayments(): Promise<RecentPayment[]> {
  return rowsOf<RecentPayment>(sql`
    select p.id, to_char(p.payment_date, 'YYYY-MM-DD') as date,
           (p.value - coalesce(p.cancelled_value, 0))::text as value,
           s.legal_name as recipient, a.name as "agencyName", p.description
      from payments p
      join suppliers s on s.id = p.supplier_id
      left join agencies a on a.id = p.agency_id
     where p.source_missing_since is null and p.payment_date is not null
       and p.source_id = (select id from sources where slug = 'municipio-online-pmpa')
       and s.document_type = 'cnpj' and s.legal_name not ilike ${PAYROLL_PREFIX}
     order by p.payment_date desc, p.value desc nulls last, p.id
     limit ${RECENT_PAYMENTS}
  `);
}

/** Quanto do prazo já passou, de 0 a 100. Null sem as duas datas ou com datas invertidas. */
export function elapsedShare(start: string | null, end: string | null, today: string): number | null {
  if (!start || !end) return null;
  const total = Date.parse(end) - Date.parse(start);
  if (!(total > 0)) return null;
  const share = ((Date.parse(today) - Date.parse(start)) / total) * 100;
  return Math.round(Math.min(Math.max(share, 0), 100));
}
