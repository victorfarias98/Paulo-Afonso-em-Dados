import { createHash } from "node:crypto";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, inner]) => [key, sortKeys(inner)]),
    );
  }
  return value;
}

/** JSON com chaves ordenadas em todos os níveis: o mesmo conteúdo gera sempre o mesmo texto. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/** SHA-256 do JSON canônico. É o que detecta alteração de um registro na fonte. */
export function hashPayload(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
