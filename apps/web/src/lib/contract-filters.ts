import type { ContractKind } from "@pad/database/schema";
import type { ContractStatus } from "@pad/domain";

export const STATUS_LABELS: Record<ContractStatus, string> = {
  vigente: "Em vigor",
  vigencia_encerrada: "Encerrado",
  cancelado: "Cancelado",
  informacao_insuficiente: "Sem informação",
};

export const KIND_LABELS: Record<ContractKind, string> = {
  contrato: "Contrato",
  ata_registro_precos: "Lista de preços (ata)",
  termo_aditivo: "Alteração de contrato",
  outro: "Outro instrumento",
};

export const SORT_LABELS = {
  recentes: "Assinados mais recentemente",
  maior_valor: "Maior valor",
  menor_valor: "Menor valor",
  vencimento: "Terminam primeiro",
} as const;

export type ContractSort = keyof typeof SORT_LABELS;

export interface ContractFilters {
  q?: string;
  status?: ContractStatus;
  kind?: ContractKind;
  year?: number;
  sort: ContractSort;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 10_000;
const DEFAULT_SORT: ContractSort = "recentes";

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function oneOf<T extends string>(value: string | undefined, allowed: Record<T, string>): T | undefined {
  return value !== undefined && Object.hasOwn(allowed, value) ? (value as T) : undefined;
}

function positiveInt(value: string | undefined, max: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= max ? parsed : undefined;
}

/**
 * Lê os filtros da URL. Tudo que não está nas listas permitidas é descartado,
 * de modo que nenhum texto vindo do visitante chega à consulta sem validação.
 */
export function parseContractFilters(params: RawSearchParams): ContractFilters {
  const q = first(params.q)?.trim().slice(0, MAX_QUERY_LENGTH);
  const status = oneOf(first(params.situacao), STATUS_LABELS);
  const kind = oneOf(first(params.tipo), KIND_LABELS);
  const year = positiveInt(first(params.ano), 2100);

  return {
    ...(q && { q }),
    ...(status && { status }),
    ...(kind && { kind }),
    ...(year !== undefined && year >= 1990 && { year }),
    sort: oneOf(first(params.ordem), SORT_LABELS) ?? DEFAULT_SORT,
    page: positiveInt(first(params.pagina), MAX_PAGE) ?? 1,
  };
}

/** Monta a query string de volta, omitindo os valores padrão. */
export function filtersToQuery(filters: ContractFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("situacao", filters.status);
  if (filters.kind) query.set("tipo", filters.kind);
  if (filters.year !== undefined) query.set("ano", String(filters.year));
  if (filters.sort !== DEFAULT_SORT) query.set("ordem", filters.sort);
  if (filters.page > 1) query.set("pagina", String(filters.page));

  const text = query.toString();
  return text === "" ? "" : `?${text}`;
}
