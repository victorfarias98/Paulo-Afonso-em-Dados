import type { RawSearchParams } from "./contract-filters";

export const BID_SORT_LABELS = {
  recentes: "Mais recentes",
  maior_valor: "Maior valor estimado",
} as const;

export type BidSort = keyof typeof BID_SORT_LABELS;

/** De quem é a licitação; corresponde ao poder do órgão no banco. */
export const BID_OWNER_LABELS = {
  prefeitura: "Prefeitura",
  camara: "Câmara",
} as const;

export type BidOwner = keyof typeof BID_OWNER_LABELS;

export interface BidFilters {
  q?: string;
  /** Chave da situação como guardada no banco (ex.: "homologado_e_adjudicado"). */
  status?: string;
  modality?: string;
  year?: number;
  owner?: BidOwner;
  sort: BidSort;
  page: number;
}

const MAX_TEXT_LENGTH = 100;
const MAX_PAGE = 10_000;
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;
const DEFAULT_SORT: BidSort = "recentes";
const STATUS_KEY = /^[a-z0-9_]{1,60}$/;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const text = (value: string | string[] | undefined): string | undefined =>
  first(value)?.trim().slice(0, MAX_TEXT_LENGTH) || undefined;

function intBetween(value: string | undefined, min: number, max: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : undefined;
}

/**
 * Lê os filtros de licitações da URL. Situação e modalidade vêm da fonte e não
 * têm lista fixa: são validadas pelo formato e usadas só como parâmetro de consulta.
 */
export function parseBidFilters(params: RawSearchParams): BidFilters {
  const q = text(params.q);
  const status = first(params.situacao);
  const modality = text(params.modalidade);
  const year = intBetween(first(params.ano), MIN_YEAR, MAX_YEAR);
  const sort = first(params.ordem);
  const owner = first(params.poder);

  return {
    ...(q && { q }),
    ...(status && STATUS_KEY.test(status) && { status }),
    ...(modality && { modality }),
    ...(year !== undefined && { year }),
    ...(owner !== undefined && Object.hasOwn(BID_OWNER_LABELS, owner) && { owner: owner as BidOwner }),
    sort: sort !== undefined && Object.hasOwn(BID_SORT_LABELS, sort) ? (sort as BidSort) : DEFAULT_SORT,
    page: intBetween(first(params.pagina), 1, MAX_PAGE) ?? 1,
  };
}

export function bidFiltersToQuery(filters: BidFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("situacao", filters.status);
  if (filters.modality) query.set("modalidade", filters.modality);
  if (filters.year !== undefined) query.set("ano", String(filters.year));
  if (filters.owner) query.set("poder", filters.owner);
  if (filters.sort !== DEFAULT_SORT) query.set("ordem", filters.sort);
  if (filters.page > 1) query.set("pagina", String(filters.page));

  const result = query.toString();
  return result === "" ? "" : `?${result}`;
}
