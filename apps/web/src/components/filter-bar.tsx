import { FunnelSimpleIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { FilterEnhancer } from "./filter-enhancer";

export interface FilterOption {
  value: string;
  label: string;
}

export type FilterField =
  | { kind: "search"; name: string; label: string; value?: string | undefined }
  | {
      kind: "select";
      name: string;
      label: string;
      value?: string | undefined;
      options: FilterOption[];
      /** Texto da opção "sem filtro". Sem ele, o campo sempre tem um valor (ex.: ordenação). */
      allLabel?: string;
      /** Valor que não conta como filtro ativo (ex.: a ordenação padrão). */
      defaultValue?: string;
      /** Sempre levado nos endereços, mesmo sem ser filtro (ex.: a etapa da despesa). */
      keep?: boolean;
    }
  | {
      /** Contexto vindo de outra página (ex.: um órgão), mostrado como filtro removível. */
      kind: "context";
      name: string;
      label: string;
      value?: string | undefined;
      /** Nome legível do valor, ex.: o nome do órgão. */
      display?: string | null;
      /** Mantido ao limpar os filtros (ex.: a etapa da despesa). */
      keep?: boolean;
    };

/** Converte um mapa valor → rótulo nas opções de um campo. */
export const optionsFrom = (labels: Record<string, string>): FilterOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export const yearOptions = (years: number[]): FilterOption[] =>
  years.map((year) => ({ value: String(year), label: String(year) }));

interface Props {
  action: string;
  fields: FilterField[];
}

interface Chip {
  name: string;
  text: string;
}

const isKept = (field: FilterField): boolean => "keep" in field && field.keep === true;

const isActive = (field: FilterField): boolean => {
  if (!field.value) return false;
  if (field.kind === "select") return field.value !== field.defaultValue;
  return true;
};

function chipOf(field: FilterField): Chip | null {
  if (!isActive(field) || isKept(field)) return null;
  if (field.kind === "context") {
    return { name: field.name, text: `${field.label}: ${field.display ?? field.value}` };
  }
  if (field.kind === "search") return { name: field.name, text: `“${field.value}”` };
  // Ordenação não é filtro: não vira etiqueta.
  if (field.allLabel === undefined) return null;
  const option = field.options.find((item) => item.value === field.value);
  return { name: field.name, text: `${field.label}: ${option?.label ?? field.value}` };
}

/** Endereço da lista com os filtros ativos, menos os campos indicados. Volta sempre à página 1. */
export function hrefWithout(
  action: string,
  fields: FilterField[],
  omit: (field: FilterField) => boolean,
): string {
  const query = new URLSearchParams();
  for (const field of fields) {
    const carried = isKept(field) || (isActive(field) && !omit(field));
    if (field.value && carried) query.set(field.name, field.value);
  }
  const text = query.toString();
  return text ? `${action}?${text}` : action;
}

/**
 * Filtros de uma lista. A busca fica sempre visível; os demais filtros ficam
 * num painel recolhido no celular e aberto em telas largas. Cada filtro ativo
 * vira uma etiqueta que pode ser removida com um toque.
 */
export function FilterBar({ action, fields }: Props) {
  const search = fields.find((field) => field.kind === "search");
  const selects = fields.filter((field) => field.kind === "select");
  const contexts = fields.filter((field) => field.kind === "context");
  const chips = fields.flatMap((field) => chipOf(field) ?? []);
  const activeInPanel = selects.filter(
    (field) => field.allLabel !== undefined && isActive(field),
  ).length;

  return (
    <div className="mt-6">
      <form method="get" action={action} role="search">
        <FilterEnhancer />
        {contexts.map(
          (field) =>
            field.value && (
              <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ),
        )}

        {search && (
          <div className="flex items-end gap-2">
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-sm font-medium">{search.label}</span>
              <span className="relative block">
                <MagnifyingGlassIcon
                  size={20}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-suave"
                />
                <input
                  type="search"
                  name={search.name}
                  defaultValue={search.value}
                  maxLength={100}
                  placeholder={search.label}
                  enterKeyHint="search"
                  className="campo pl-11 placeholder:text-suave"
                />
              </span>
            </label>
            <button type="submit" className="botao px-5">
              Buscar
            </button>
          </div>
        )}

        {selects.length > 0 && (
          <details className="filtros mt-3">
            <summary className="pilula cursor-pointer list-none lg:hidden [&::-webkit-details-marker]:hidden">
              <FunnelSimpleIcon size={20} aria-hidden="true" />
              Filtrar e ordenar
              {activeInPanel > 0 && (
                <span className="grid size-6 place-items-center rounded-full bg-azul text-sm text-fundo">
                  {activeInPanel}
                </span>
              )}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:mt-0 lg:grid-cols-4">
              {selects.map((field) => (
                <label key={field.name} className="block">
                  <span className="mb-1 block text-sm font-medium">{field.label}</span>
                  <select
                    name={field.name}
                    defaultValue={field.value ?? field.defaultValue ?? ""}
                    className="campo"
                  >
                    {field.allLabel !== undefined && <option value="">{field.allLabel}</option>}
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <noscript>
                <button type="submit" className="botao self-end">
                  Aplicar filtros
                </button>
              </noscript>
            </div>
          </details>
        )}
      </form>

      {chips.length > 0 && (
        <ul aria-label="Filtros ativos" className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <li key={chip.name}>
              <Link
                href={hrefWithout(action, fields, (field) => field.name === chip.name)}
                data-analytics-filter
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-superficie py-1 pr-3 pl-4 text-sm font-medium hover:bg-linha"
              >
                <span className="max-w-[60vw] truncate sm:max-w-xs">{chip.text}</span>
                <XIcon size={16} weight="bold" aria-hidden="true" />
                <span className="sr-only">Remover filtro</span>
              </Link>
            </li>
          ))}
          {chips.length > 1 && (
            <li>
              <Link
                href={hrefWithout(action, fields, (field) => !isKept(field))}
                data-analytics-filter
                className="link inline-flex min-h-11 items-center px-2 text-sm"
              >
                Limpar tudo
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export interface QuickFilter {
  label: string;
  href: string;
  count?: number;
  isCurrent: boolean;
}

/** Atalhos de um toque para os recortes mais procurados de uma lista, com a contagem de cada um. */
export function QuickFilters({ label, items }: { label: string; items: QuickFilter[] }) {
  return (
    <nav aria-label={label} className="-mx-5 mt-6 sm:mx-0">
      <ul className="faixa px-5 sm:flex-wrap sm:px-0">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              data-analytics-filter
              aria-current={item.isCurrent ? "true" : undefined}
              className="pilula"
            >
              {item.label}
              {item.count !== undefined && (
                <span className="tabular-nums opacity-70">
                  {item.count.toLocaleString("pt-BR")}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
