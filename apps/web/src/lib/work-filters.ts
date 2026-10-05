import type { WorkStatus } from "@pad/domain";

import type { RawSearchParams } from "./contract-filters";

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  em_andamento: "Em andamento",
  // O prazo é o original (início + dias); a fonte não informa prorrogações junto da obra.
  prazo_vencido: "Passou do prazo inicial",
  nao_iniciada: "Não iniciada",
  paralisada: "Paralisada",
  em_fiscalizacao: "Em vistoria",
  concluida: "Concluída",
  informacao_insuficiente: "Sem informação",
};

export const WORK_SORT_LABELS = {
  recentes: "Iniciadas mais recentemente",
  maior_valor: "Maior valor",
  prazo: "Prazo inicial mais antigo",
} as const;

export type WorkSort = keyof typeof WORK_SORT_LABELS;

export interface WorkFilters {
  q?: string;
  status?: WorkStatus;
  neighborhood?: string;
  sort: WorkSort;
  page: number;
}

const MAX_TEXT_LENGTH = 100;
const MAX_PAGE = 10_000;
const DEFAULT_SORT: WorkSort = "recentes";

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const text = (value: string | string[] | undefined): string | undefined =>
  first(value)?.trim().slice(0, MAX_TEXT_LENGTH) || undefined;

function oneOf<T extends string>(value: string | undefined, allowed: Record<T, string>): T | undefined {
  return value !== undefined && Object.hasOwn(allowed, value) ? (value as T) : undefined;
}

function page(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= MAX_PAGE ? parsed : 1;
}

/** Lê os filtros de obras da URL; o que não está nas listas permitidas é descartado. */
export function parseWorkFilters(params: RawSearchParams): WorkFilters {
  const q = text(params.q);
  const status = oneOf(first(params.situacao), WORK_STATUS_LABELS);
  const neighborhood = text(params.bairro);

  return {
    ...(q && { q }),
    ...(status && { status }),
    ...(neighborhood && { neighborhood }),
    sort: oneOf(first(params.ordem), WORK_SORT_LABELS) ?? DEFAULT_SORT,
    page: page(first(params.pagina)),
  };
}

export function workFiltersToQuery(filters: WorkFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("situacao", filters.status);
  if (filters.neighborhood) query.set("bairro", filters.neighborhood);
  if (filters.sort !== DEFAULT_SORT) query.set("ordem", filters.sort);
  if (filters.page > 1) query.set("pagina", String(filters.page));

  const result = query.toString();
  return result === "" ? "" : `?${result}`;
}
