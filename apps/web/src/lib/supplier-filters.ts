import type { RawSearchParams } from "./contract-filters";

export const SUPPLIER_SORT_LABELS = {
  maior_pago: "Maior valor recebido",
  maior_contratado: "Maior valor contratado",
  nome: "Nome",
} as const;

export type SupplierSort = keyof typeof SUPPLIER_SORT_LABELS;

export interface SupplierFilters {
  q?: string;
  sort: SupplierSort;
  page: number;
}

const MAX_TEXT_LENGTH = 100;
const MAX_PAGE = 10_000;
const DEFAULT_SORT: SupplierSort = "maior_pago";

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export function parseSupplierFilters(params: RawSearchParams): SupplierFilters {
  const q = first(params.q)?.trim().slice(0, MAX_TEXT_LENGTH);
  const sort = first(params.ordem);
  const page = first(params.pagina);
  const pageNumber = page && /^\d+$/.test(page) ? Number(page) : 1;

  return {
    ...(q && { q }),
    sort:
      sort !== undefined && Object.hasOwn(SUPPLIER_SORT_LABELS, sort)
        ? (sort as SupplierSort)
        : DEFAULT_SORT,
    page: pageNumber >= 1 && pageNumber <= MAX_PAGE ? pageNumber : 1,
  };
}

export function supplierFiltersToQuery(filters: SupplierFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.sort !== DEFAULT_SORT) query.set("ordem", filters.sort);
  if (filters.page > 1) query.set("pagina", String(filters.page));

  const result = query.toString();
  return result === "" ? "" : `?${result}`;
}
