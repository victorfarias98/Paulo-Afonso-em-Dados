import type { RawSearchParams } from "./contract-filters";
import { UUID } from "./provenance";

export const PHASE_LABELS = {
  empenho: "Dinheiro reservado",
  liquidacao: "Entregas conferidas",
  pagamento: "Pagamentos",
} as const;

export type ExpensePhaseKey = keyof typeof PHASE_LABELS;

/**
 * Prefeitura e Câmara publicam suas despesas na mesma plataforma, em endereços
 * distintos. Cada uma é uma fonte cadastrada; os totais nunca as misturam.
 */
export const BRANCHES = {
  prefeitura: {
    name: "Prefeitura",
    subject: "A Prefeitura",
    of: "da Prefeitura",
    sourceSlug: "municipio-online-pmpa",
    sourceUrl: "https://www.municipioonline.com.br/ba/prefeitura/pauloafonso/cidadao/despesa",
  },
  camara: {
    name: "Câmara",
    subject: "A Câmara",
    of: "da Câmara",
    sourceSlug: "municipio-online-cmpa",
    sourceUrl: "https://www.municipioonline.com.br/ba/camara/pauloafonso/cidadao/despesa",
  },
} as const;

export type ExpenseBranch = keyof typeof BRANCHES;
export const DEFAULT_BRANCH: ExpenseBranch = "prefeitura";

/** Lê o poder pedido na URL; valor ausente ou desconhecido devolve undefined. */
export function parseBranch(value: string | string[] | undefined): ExpenseBranch | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single !== undefined && Object.hasOwn(BRANCHES, single)
    ? (single as ExpenseBranch)
    : undefined;
}

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export interface ExpenseFilters {
  phase: ExpensePhaseKey;
  /** Sem poder definido, a lista traz Prefeitura e Câmara juntas (ex.: tudo de um fornecedor). */
  branch?: ExpenseBranch;
  year?: number;
  month?: number;
  agencyId?: string;
  supplierId?: string;
  q?: string;
  page: number;
}

const MAX_TEXT_LENGTH = 100;
const MAX_PAGE = 100_000;
const DEFAULT_PHASE: ExpensePhaseKey = "pagamento";

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function intBetween(value: string | undefined, min: number, max: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : undefined;
}

const uuid = (value: string | undefined): string | undefined =>
  value && UUID.test(value) ? value : undefined;

/** Lê os filtros da lista de despesas; valores fora do formato esperado são descartados. */
export function parseExpenseFilters(params: RawSearchParams): ExpenseFilters {
  const phase = first(params.fase);
  const year = intBetween(first(params.ano), 2000, 2100);
  const month = intBetween(first(params.mes), 1, 12);
  const agencyId = uuid(first(params.orgao));
  const supplierId = uuid(first(params.fornecedor));
  const q = first(params.q)?.trim().slice(0, MAX_TEXT_LENGTH);
  const branch = parseBranch(params.poder);

  return {
    phase:
      phase !== undefined && Object.hasOwn(PHASE_LABELS, phase)
        ? (phase as ExpensePhaseKey)
        : DEFAULT_PHASE,
    ...(branch && { branch }),
    ...(year !== undefined && { year }),
    ...(month !== undefined && { month }),
    ...(agencyId && { agencyId }),
    ...(supplierId && { supplierId }),
    ...(q && { q }),
    page: intBetween(first(params.pagina), 1, MAX_PAGE) ?? 1,
  };
}

export function expenseFiltersToQuery(filters: ExpenseFilters): string {
  const query = new URLSearchParams({ fase: filters.phase });
  if (filters.branch) query.set("poder", filters.branch);
  if (filters.year !== undefined) query.set("ano", String(filters.year));
  if (filters.month !== undefined) query.set("mes", String(filters.month));
  if (filters.agencyId) query.set("orgao", filters.agencyId);
  if (filters.supplierId) query.set("fornecedor", filters.supplierId);
  if (filters.q) query.set("q", filters.q);
  if (filters.page > 1) query.set("pagina", String(filters.page));
  return `?${query.toString()}`;
}
