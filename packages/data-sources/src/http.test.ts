import { describe, expect, test, vi } from "vitest";

import { createPoliteFetcher } from "./http";

const USER_AGENT = "PauloAfonsoEmDados/0.1 (+contato@baiustecnologia.com.br)";

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}

function setup(responses: Response[], clock: number[] = []) {
  const fetchImpl = vi.fn<typeof fetch>(async () => responses.shift() ?? htmlResponse("fim"));
  const sleep = vi.fn(async (_ms: number) => undefined);
  const now = vi.fn(() => clock.shift() ?? 0);
  const fetchText = createPoliteFetcher({
    userAgent: USER_AGENT,
    minIntervalMs: 2500,
    fetchImpl,
    sleep,
    now,
  });
  return { fetchText, fetchImpl, sleep };
}

function sentHeaders(fetchImpl: ReturnType<typeof setup>["fetchImpl"], call: number): Headers {
  return new Headers(fetchImpl.mock.calls[call]?.[1]?.headers);
}

describe("createPoliteFetcher", () => {
  test("identifies the collector on every request", async () => {
    const { fetchText, fetchImpl } = setup([htmlResponse("ok")]);

    await expect(fetchText("https://fonte.example/a")).resolves.toBe("ok");

    expect(sentHeaders(fetchImpl, 0).get("user-agent")).toBe(USER_AGENT);
  });

  test("waits the remaining interval before the next request", async () => {
    // 1ª requisição começa em t=1000; a 2ª é pedida em t=1400 → faltam 2100 ms.
    const { fetchText, sleep } = setup([htmlResponse("a"), htmlResponse("b")], [1000, 1400, 3500]);

    await fetchText("https://fonte.example/a");
    await fetchText("https://fonte.example/b");

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2100);
  });

  test("does not wait when the interval has already passed", async () => {
    const { fetchText, sleep } = setup([htmlResponse("a"), htmlResponse("b")], [1000, 9000]);

    await fetchText("https://fonte.example/a");
    await fetchText("https://fonte.example/b");

    expect(sleep).not.toHaveBeenCalled();
  });

  test("sends back the session cookie set by the source", async () => {
    const first = htmlResponse("a", { headers: { "set-cookie": "PHPSESSID_x=abc123; path=/" } });
    const { fetchText, fetchImpl } = setup([first, htmlResponse("b")], [0, 5000]);

    await fetchText("https://fonte.example/a");
    await fetchText("https://fonte.example/b");

    expect(sentHeaders(fetchImpl, 0).get("cookie")).toBeNull();
    expect(sentHeaders(fetchImpl, 1).get("cookie")).toBe("PHPSESSID_x=abc123");
  });

  test("posts a form when a body is given", async () => {
    const { fetchText, fetchImpl } = setup([htmlResponse("ok")]);

    await fetchText("https://fonte.example/form", { body: "a=1&b=2" });

    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe("a=1&b=2");
    expect(sentHeaders(fetchImpl, 0).get("content-type")).toBe("application/x-www-form-urlencoded");
  });

  test("throws with status and URL when the source answers with an error", async () => {
    const { fetchText } = setup([htmlResponse("erro", { status: 503 })]);

    await expect(fetchText("https://fonte.example/a")).rejects.toThrow(
      /503.*https:\/\/fonte\.example\/a/,
    );
  });
});
