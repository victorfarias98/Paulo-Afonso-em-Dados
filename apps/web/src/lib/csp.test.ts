import { describe, expect, test } from "vitest";

import { buildCsp } from "./csp";

describe("buildCsp", () => {
  test("allows scripts only with the request nonce in production", () => {
    const csp = buildCsp("abc123", false);

    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic';");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  test("blocks framing, plugins and forms posting to other sites", () => {
    const csp = buildCsp("abc123", false);

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  test("relaxes only what the development server needs", () => {
    const csp = buildCsp("abc123", true);

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("analytics connection policy", () => {
  test("permits only the configured analytics origin for connections", () => {
    const csp = buildCsp("abc123", false, "https://us.i.posthog.com");
    expect(csp).toContain("connect-src 'self' https://us.i.posthog.com;");
    expect(csp).toContain("img-src 'self' data:;");
    expect(csp).not.toContain("https://*.posthog.com");
  });
  test.each([
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com?x=1",
    "https://example.com#x",
    "https://example.com; script-src *",
    "bad host",
    " https://example.com",
  ])("rejects unsafe analytics host %s", (host) => {
    expect(buildCsp("abc123", false, host)).toBe(buildCsp("abc123", false));
  });
  test("keeps the policy unchanged when analytics is disabled", () => {
    expect(buildCsp("abc123", false, null)).toBe(buildCsp("abc123", false));
  });
});
