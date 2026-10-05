import { describe, expect, it } from "vitest";
import { readAnalyticsConfig } from "./analytics-config";
describe("analytics configuration", () => {
  it("requires a public token and defaults to US ingestion", () => {
    expect(readAnalyticsConfig({})).toBeNull();
    expect(readAnalyticsConfig({ POSTHOG_PROJECT_TOKEN: "phc_1234567890123456" })).toEqual({
      key: "phc_1234567890123456",
      host: "https://us.i.posthog.com",
    });
  });
  it("rejects personal credentials and unsafe hosts", () => {
    expect(readAnalyticsConfig({ POSTHOG_PROJECT_TOKEN: "phx_1234567890123456" })).toBeNull();
    for (const host of [
      "http://example.com",
      "https://user:pass@example.com",
      "https://example.com/path",
      "https://example.com?key=secret",
      "https://example.com#secret",
    ]) {
      expect(
        readAnalyticsConfig({ POSTHOG_PROJECT_TOKEN: "phc_1234567890123456", POSTHOG_HOST: host }),
      ).toBeNull();
    }
  });
  it("accepts an HTTPS self hosted origin", () => {
    expect(
      readAnalyticsConfig({
        POSTHOG_PROJECT_TOKEN: "phc_1234567890123456",
        POSTHOG_HOST: "https://analytics.example.com:8443/",
      })?.host,
    ).toBe("https://analytics.example.com:8443");
  });
});

describe("analytics environment opt in", () => {
  const token = { POSTHOG_PROJECT_TOKEN: "phc_1234567890123456" };
  it("disables all environments explicitly", () => {
    expect(
      readAnalyticsConfig({ ...token, NODE_ENV: "production", POSTHOG_ENABLED: "false" }),
    ).toBeNull();
  });
  it("requires opt in in development and tests", () => {
    for (const NODE_ENV of ["development", "test"]) {
      expect(readAnalyticsConfig({ ...token, NODE_ENV })).toBeNull();
      expect(readAnalyticsConfig({ ...token, NODE_ENV, POSTHOG_ENABLED: "true" })).not.toBeNull();
    }
  });
  it("enables production by default when configured", () => {
    expect(readAnalyticsConfig({ ...token, NODE_ENV: "production" })).not.toBeNull();
  });
});
