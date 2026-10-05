import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock("posthog-js/no-external", () => ({ default: sdk }));

describe("portal analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("window", {
      location: {
        pathname: "/busca",
        origin: "https://portal.example",
        hostname: "portal.example",
      },
    });
    vi.stubGlobal("navigator", { doNotTrack: "0" });
    sdk.init.mockImplementation((_key, config) => {
      config.loaded(sdk);
      return sdk;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  test("missing configuration does not initialize or capture", async () => {
    const analytics = await import("./analytics-client");
    await analytics.initializeAnalytics(null);
    analytics.capturePortalEvent("$pageview", { page_path: "/" });
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  test("a public route can initialize after starting on an excluded route", async () => {
    const analytics = await import("./analytics-client");
    const config = { key: "phc_public_example_token12345", host: "https://us.i.posthog.com" };
    window.location.pathname = "/admin";
    await analytics.initializeAnalytics(config);
    expect(sdk.init).not.toHaveBeenCalled();
    window.location.pathname = "/busca";
    await analytics.initializeAnalytics(config);
    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  test("runtime init disables recording and autocapture, and honors DNT", async () => {
    const analytics = await import("./analytics-client");
    await analytics.initializeAnalytics({
      key: "phc_public_example_token12345",
      host: "https://us.i.posthog.com",
    });
    expect(sdk.init).toHaveBeenCalledWith(
      "phc_public_example_token12345",
      expect.objectContaining({
        autocapture: false,
        disable_session_recording: true,
        capture_pageview: false,
        person_profiles: "never",
        persistence: "sessionStorage",
        respect_dnt: true,
      }),
    );
    vi.stubGlobal("navigator", { doNotTrack: "1" });
    analytics.capturePortalEvent("portal_search_submitted", { page_path: "/busca" });
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  test("before_send removes unsafe fields without removing the ingestion token", async () => {
    const analytics = await import("./analytics-client");
    await analytics.initializeAnalytics({
      key: "phc_public_example_token12345",
      host: "https://us.i.posthog.com",
    });
    const config = sdk.init.mock.calls[0]![1];
    const event = config.before_send({
      event: "$pageview",
      properties: {
        token: "phc_public_example_token12345",
        distinct_id: "random-visitor",
        $current_url: "https://portal.example/busca?q=12345678900",
        $pathname: "/busca",
        $set: { email: "private@example.com" },
        unsafe: "secret",
      },
    });
    expect(event.properties.token).toBe("phc_public_example_token12345");
    expect(event.properties.$current_url).toBe("https://portal.example/busca");
    expect(event.properties.site).toBe("paulo_afonso_em_dados");
    expect(JSON.stringify(event)).not.toMatch(/12345678900|private@example|secret/);
  });

  test("admin pages cannot send events and GET actions use immediate beacon delivery", async () => {
    const analytics = await import("./analytics-client");
    await analytics.initializeAnalytics({
      key: "phc_public_example_token12345",
      host: "https://us.i.posthog.com",
    });
    analytics.capturePortalEvent("portal_search_submitted", {
      page_path: "/busca",
      search_term: "escola centro",
    });
    expect(sdk.capture).toHaveBeenCalledWith(
      "portal_search_submitted",
      expect.objectContaining({ search_term: "escola centro", site: "paulo_afonso_em_dados" }),
      expect.objectContaining({ send_instantly: true, transport: "sendBeacon" }),
    );
    sdk.capture.mockClear();
    window.location.pathname = "/admin";
    analytics.capturePortalEvent("portal_search_submitted", { page_path: "/busca" });
    expect(sdk.capture).not.toHaveBeenCalled();
  });
});
