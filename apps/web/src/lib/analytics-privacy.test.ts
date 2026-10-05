import { describe, expect, it } from "vitest";
import { publicPath, sanitizeCapture, sanitizeSearchTerm } from "./analytics-privacy";

it("redacted searches preserve a null term across repeated sanitization", () => {
  const capture = sanitizeCapture({
    event: "portal_search_submitted",
    properties: {
      page_path: "/busca",
      search_term: null,
      search_redacted: true,
      search_length: 18,
    },
  });
  expect(capture?.properties?.search_term).toBeNull();
  expect(sanitizeCapture(capture!)?.properties?.search_term).toBeNull();
});
describe("analytics privacy", () => {
  it("normalizes public details and rejects restricted paths", () => {
    expect(publicPath("/contratos/123e4567-e89b-12d3-a456-426614174000?cpf=secret")).toBe(
      "/contratos/:id",
    );
    expect(publicPath("/busca?q=email")).toBe("/busca");
    for (const path of ["/admin", "/api/health", "/unknown", "/contratos/secret"])
      expect(publicPath(path)).toBeNull();
  });
  it("normalizes ordinary searches and removes sensitive searches entirely", () => {
    expect(sanitizeSearchTerm("  ESCOLA   Centro ")).toEqual({
      term: "escola centro",
      redacted: false,
      length: 13,
    });
    for (const term of [
      "user@example.com",
      "https://example.com",
      "@usuario",
      "123.456.789-00",
      "(75) 99999-1234",
      "1234567",
    ])
      expect(sanitizeSearchTerm(term).term).toBeNull();
  });
  it("removes sensitive SDK properties, URL queries and filter identifiers", () => {
    const event = {
      event: "$pageview",
      properties: {
        $current_url: "https://portal.example/busca?q=12345678900",
        $referrer: "https://example.com/page?email=secret",
        $initial_current_url: "secret",
        email: "secret",
        distinct_id: "random",
        filters: { ano: "2026", cpf: "12345678900", bairro: "Centro" },
      },
    };
    expect(sanitizeCapture(event)).toEqual({
      event: "$pageview",
      properties: {
        $current_url: "https://portal.example/busca",
        $referrer: "https://example.com",
        distinct_id: "random",
        filters: { ano: "2026", bairro: "Centro" },
      },
    });
    expect(event.properties.$current_url).toContain("?");
  });
  it("blocks restricted paths and unregistered events", () => {
    expect(sanitizeCapture({ event: "$pageview", properties: { $pathname: "/admin" } })).toBeNull();
    expect(sanitizeCapture({ event: "unregistered" })).toBeNull();
  });
  it("sanitizes search fields even when provided directly", () => {
    const result = sanitizeCapture({
      event: "portal_search_submitted",
      properties: {
        search_term: "123.456.789-00",
        results_count: 12,
        result_categories: ["obras"],
        password: "secret",
      },
    });
    expect(result?.properties).toEqual({
      search_term: null,
      search_redacted: true,
      search_length: 14,
      results_count: 12,
      result_categories: ["obras"],
    });
  });
});

describe("analytics SDK normalization", () => {
  it("preserves normalized public routes across two sanitization passes", () => {
    const input = {
      event: "$pageview",
      properties: {
        page_path: "/obras/:id",
        $current_url:
          "https://user:pass@portal.example/obras/123e4567-e89b-12d3-a456-426614174000?secret=value#hash",
        site: "paulo_afonso_em_dados",
        site_domain: "localhost:3000",
        $host: "localhost:3000",
        $set: { email: "secret" },
        $initial_utm_source: "secret",
      },
    };
    const first = sanitizeCapture(input);
    expect(first?.properties).toEqual({
      page_path: "/obras/:id",
      $current_url: "https://portal.example/obras/:id",
      site: "paulo_afonso_em_dados",
      site_domain: "localhost:3000",
      $host: "localhost:3000",
    });
    expect(sanitizeCapture(first!)).toEqual(first);
  });
  it("retains ordinary normalized searches and numeric public member IDs", () => {
    expect(
      sanitizeCapture({
        event: "portal_legislative_member_opened",
        properties: {
          member_id: 42,
          search_term: " Escola Centro ",
          filters: { poder: "legislativo", etapa: "aprovado", email: "secret" },
        },
      })?.properties,
    ).toEqual({
      member_id: 42,
      search_term: "escola centro",
      search_length: 13,
      search_redacted: false,
      filters: { poder: "legislativo", etapa: "aprovado" },
    });
    expect(
      sanitizeCapture({
        event: "$pageview",
        properties: { $host: "example.com?secret=value", site: "another-site" },
      })?.properties,
    ).toEqual({});
  });
});
