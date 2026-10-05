const routes = new Set([
  "/",
  "/busca",
  "/obras",
  "/contratos",
  "/licitacoes",
  "/fornecedores",
  "/gastos",
  "/gastos/registros",
  "/fontes",
  "/entenda",
]);
const events = new Set([
  "$pageview",
  "portal_search_submitted",
  "portal_search_results_viewed",
  "portal_filter_applied",
  "portal_record_opened",
  "portal_source_opened",
  "portal_home_section_viewed",
  "portal_legislative_search",
  "portal_legislative_filter",
  "portal_legislative_member_opened",
  "portal_explanation_opened",
  "portal_pagination_used",
]);
const strings = new Set([
  "section",
  "record_type",
  "record_id",
  "source_host",
  "member_id",
  "legislative_scope",
  "explanation",
]);
const numbers = new Set(["search_length", "results_count", "snapshot_year", "target_page"]);
const sdk = new Set([
  "distinct_id",
  "$device_id",
  "$session_id",
  "$window_id",
  "$browser",
  "$browser_version",
  "$os",
  "$os_version",
  "$device_type",
  "$screen_height",
  "$screen_width",
  "$viewport_height",
  "$viewport_width",
  "$lib",
  "$lib_version",
  "$process_person_profile",
  "$geoip_disable",
  "$time",
  "$insert_id",
]);
const filterKeys = new Set([
  "ano",
  "mes",
  "bairro",
  "year",
  "month",
  "neighborhood",
  "status",
  "situacao",
  "categoria",
  "category",
  "tipo",
  "type",
  "scope",
  "escopo",
  "sort",
  "ordem",
  "autoria",
  "author_activity",
  "poder",
  "etapa",
  "origem",
  "modalidade",
  "orgao",
]);

export function publicPath(pathname: string): string | null {
  try {
    const path = new URL(pathname, "https://portal.invalid").pathname;
    if (routes.has(path) || /^\/(obras|contratos|licitacoes|fornecedores)\/:id$/.test(path))
      return path;
    const detail =
      /^\/(obras|contratos|licitacoes|fornecedores)\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.exec(
        path,
      );
    return detail?.[1] ? `/${detail[1].toLowerCase()}/:id` : null;
  } catch {
    return null;
  }
}

export function sanitizeSearchTerm(raw: string): {
  term: string | null;
  redacted: boolean;
  length: number;
} {
  const normalized = raw.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  const redacted =
    /@|https?:\/\/|www\./i.test(normalized) || normalized.replace(/\D/g, "").length >= 7;
  return {
    term: redacted ? null : normalized.slice(0, 100),
    redacted,
    length: Math.min(normalized.length, 100),
  };
}

function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return sanitizeSearchTerm(value).redacted
    ? null
    : value.trim().replace(/\s+/g, " ").slice(0, 100);
}

function safeFilters(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      if (!filterKeys.has(key)) return [];
      const cleaned = safeText(item);
      return cleaned === null ? [] : [[key, cleaned]];
    }),
  );
}

type CaptureEvent = { event: string; properties?: Record<string, unknown> };
export function sanitizeCapture(input: CaptureEvent): CaptureEvent | null {
  if (!events.has(input.event)) return null;
  const properties = input.properties || {};
  for (const key of ["page_path", "$pathname", "$current_url"]) {
    if (key in properties && (typeof properties[key] !== "string" || !publicPath(properties[key])))
      return null;
  }
  const clean = Object.fromEntries(
    Object.entries(properties).flatMap(([key, value]): [string, unknown][] => {
      if (key === "$current_url") {
        const path = publicPath(value as string);
        try {
          const url = new URL(value as string);
          return /^https?:$/.test(url.protocol) ? [[key, `${url.origin}${path}`]] : [];
        } catch {
          return [[key, path]];
        }
      }
      if (["page_path", "$pathname"].includes(key)) return [[key, publicPath(value as string)]];
      if (key === "site" && value === "paulo_afonso_em_dados") return [[key, value]];
      if (
        ["site_domain", "$host"].includes(key) &&
        typeof value === "string" &&
        /^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(value)
      )
        return [[key, value.slice(0, 253)]];
      if (
        key === "member_id" &&
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 1_000_000
      )
        return [[key, value]];
      if (key === "search_term")
        return value === null && properties.search_redacted === true ? [[key, null]] : [];
      if (key === "search_redacted" && typeof value === "boolean") return [[key, value]];
      if (numbers.has(key) && typeof value === "number" && Number.isFinite(value) && value >= 0)
        return [[key, Math.min(Math.floor(value), 1_000_000_000)]];
      if (
        ["record_id", "member_id"].includes(key) &&
        typeof value === "string" &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
      )
        return [[key, value]];
      if (strings.has(key)) {
        const text = safeText(value);
        return text === null ? [] : [[key, text]];
      }
      if (key === "filters") return [[key, safeFilters(value)]];
      if (["filter_names", "result_categories"].includes(key) && Array.isArray(value))
        return [
          [
            key,
            value
              .flatMap((item) => {
                const text = safeText(item);
                return text === null ? [] : [text];
              })
              .slice(0, 30),
          ],
        ];
      if (key === "$referrer" && typeof value === "string") {
        try {
          const url = new URL(value);
          return /^https?:$/.test(url.protocol) && !url.username && !url.password
            ? [[key, url.origin]]
            : [];
        } catch {
          return [];
        }
      }
      if (key === "$referring_domain" && typeof value === "string" && /^[a-z0-9.-]+$/i.test(value))
        return [[key, value.slice(0, 253)]];
      if (
        sdk.has(key) &&
        (typeof value === "string" ||
          typeof value === "boolean" ||
          (typeof value === "number" && Number.isFinite(value)))
      )
        return [[key, typeof value === "string" ? value.slice(0, 200) : value]];
      return [];
    }),
  );
  const search =
    typeof properties.search_term === "string" ? sanitizeSearchTerm(properties.search_term) : null;
  return {
    event: input.event,
    properties: search
      ? {
          ...clean,
          search_term: search.term,
          search_redacted: search.redacted,
          search_length: search.length,
        }
      : clean,
  };
}
