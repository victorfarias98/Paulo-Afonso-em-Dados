// Run against an isolated production container with analytics enabled.
// Start an isolated Chrome with remote debugging; all PostHog requests are intercepted.
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";

const origin = process.env.ANALYTICS_SMOKE_ORIGIN ?? "http://127.0.0.1:33105";
const debugging = process.env.ANALYTICS_CHROME_URL ?? "http://127.0.0.1:9237";
for (const target of [origin, debugging]) {
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(target).hostname),
    "smoke targets must be local and isolated",
  );
}
const [page] = await (await fetch(`${debugging}/json`)).json();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
let id = 0;
const pending = new Map();
const events = [];
const errors = [];
const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
ws.addEventListener("message", async ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(message.error);
    else task.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") {
    errors.push(message.params.exceptionDetails.text);
  } else if (message.method === "Log.entryAdded") {
    if (message.params.entry.level === "error")
      errors.push(message.params.entry.text.replace(/phc_[A-Za-z0-9]+/g, "[public-token]"));
  } else if (message.method === "Runtime.bindingCalled") {
    const body = JSON.parse(message.params.payload);
    let bytes = Buffer.from(body.data, "base64");
    if (bytes[0] === 31 && bytes[1] === 139) bytes = gunzipSync(bytes);
    let raw = bytes.toString();
    if (raw.startsWith("data="))
      raw = Buffer.from(new URLSearchParams(raw).get("data"), "base64").toString();
    const payload = JSON.parse(raw);
    events.push(...(Array.isArray(payload) ? payload : (payload.batch ?? [payload])));
  } else if (message.method === "Fetch.requestPaused") {
    const posted = message.params.request.postData;
    if (posted) {
      try {
        const parsed = JSON.parse(posted);
        events.push(...(Array.isArray(parsed) ? parsed : (parsed.batch ?? [parsed])));
      } catch {
        errors.push("Unexpected analytics request encoding");
      }
    }
    // No test traffic reaches the production analytics project.
    await call("Fetch.fulfillRequest", {
      requestId: message.params.requestId,
      responseCode: 200,
      body: Buffer.from('{"status":1}').toString("base64"),
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    });
  }
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  assert.equal(result.exceptionDetails, undefined, "browser expression succeeds");
  return result.result.value;
};
const navigate = async (path) => {
  await call("Page.navigate", { url: `${origin}${path}` });
  await wait(2200);
};
const count = (event) => events.filter((item) => item.event === event).length;
const check = (condition, label) => {
  assert.ok(condition, label);
  process.stdout.write(`PASS ${label}\n`);
};
try {
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Log.enable");
  await call("Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });
  await call("Runtime.addBinding", { name: "portalSmokeCapture" });
  await call("Fetch.enable", { patterns: [{ urlPattern: "*posthog.com/*" }] });
  await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `
    window.addEventListener('portal:analytics-unavailable',()=>window.analyticsUnavailable=true);
    navigator.sendBeacon = (url, body) => {
      if (!String(url).includes('posthog.com')) return false;
      new Blob([body]).arrayBuffer().then(buffer => {
        let binary = ''; for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
        window.portalSmokeCapture(JSON.stringify({data:btoa(binary)}));
      });
      return true;
    };
  `,
  });
  await navigate("/");
  check(count("$pageview") === 1, "home records one pageview");
  await evaluate(
    `(() => { const select = document.querySelector('#autores').closest('section').querySelector('select'); select.value='no-projects'; select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await wait(300);
  check(count("portal_legislative_filter") === 1, "author filter is captured");
  await evaluate("document.querySelector('.legislative-member summary').click()");
  await wait(200);
  check(count("portal_legislative_member_opened") === 1, "author context is captured");
  await evaluate(
    "(() => { const link=document.querySelector('a[data-analytics-source]'); link.addEventListener('click', e=>e.preventDefault()); link.click(); })()",
  );
  await wait(200);
  check(count("portal_source_opened") === 1, "official source clicks are captured");
  await navigate("/busca?q=escola");
  check(
    events.some(
      (item) =>
        item.event === "portal_search_results_viewed" &&
        item.properties.search_term === "escola" &&
        item.properties.results_count === 0,
    ),
    "search reports zero results",
  );
  await evaluate(
    `(() => { const form=document.querySelector('form'); form.addEventListener('submit', e=>e.preventDefault()); form.querySelector('[name=q]').value='pessoa@example.com'; form.requestSubmit(); })()`,
  );
  await wait(300);
  check(
    events.some(
      (item) =>
        item.event === "portal_search_submitted" &&
        item.properties.search_redacted &&
        item.properties.search_term === null,
    ),
    "sensitive search is redacted",
  );
  await navigate("/obras?ano=2026");
  const filterCount = count("portal_filter_applied");
  await evaluate(
    `(() => { const link=document.createElement('a'); link.href='/obras?ano=2026&pagina=2'; document.body.append(link); link.addEventListener('click', e=>e.preventDefault()); link.click(); })()`,
  );
  await wait(300);
  check(
    count("portal_pagination_used") === 1 && count("portal_filter_applied") === filterCount,
    "pagination does not count as a new filter",
  );
  await navigate("/gastos");
  await evaluate("document.querySelector('details[data-analytics-explanation] summary').click()");
  await wait(300);
  check(count("portal_explanation_opened") === 1, "explanations are captured");
  check(
    events.every(
      (item) =>
        item.properties.site === "paulo_afonso_em_dados" &&
        item.properties.token &&
        !item.properties.$current_url?.includes("?"),
    ),
    "SDK preserves ingestion token and isolates the site without URL queries",
  );
  check(
    !JSON.stringify(events).includes("pessoa@example.com"),
    "search email never enters analytics payloads",
  );
  const beforeDnt = events.length;
  await call("Page.addScriptToEvaluateOnNewDocument", {
    source: "Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});",
  });
  await navigate("/busca?q=posto");
  check(events.length === beforeDnt, "Do Not Track prevents capture");
  check(errors.length === 0, "no browser runtime errors");
} finally {
  ws.close();
}
