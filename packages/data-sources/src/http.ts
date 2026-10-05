export interface FetchTextInit {
  /** Corpo de formulário (application/x-www-form-urlencoded); quando presente, a requisição é POST. */
  body?: string;
  /** Tipo do corpo; o padrão é formulário. */
  contentType?: string;
  /** Cabeçalhos adicionais exigidos pela fonte. */
  headers?: Record<string, string>;
}

export type FetchText = (url: string, init?: FetchTextInit) => Promise<string>;

export interface PoliteFetcherOptions {
  /** Identifica o projeto e um contato perante a fonte oficial. */
  userAgent: string;
  /** Intervalo mínimo entre o início de duas requisições, em milissegundos. */
  minIntervalMs: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Cria um coletor que faz uma requisição por vez, respeita um intervalo mínimo
 * entre elas, se identifica pelo User-Agent e mantém o cookie de sessão da fonte.
 * Use uma instância por host.
 */
export function createPoliteFetcher(options: PoliteFetcherOptions): FetchText {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const cookies = new Map<string, string>();
  let lastStartedAt: number | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  async function waitForTurn(): Promise<void> {
    const current = now();
    if (lastStartedAt === null) {
      lastStartedAt = current;
      return;
    }
    const remaining = options.minIntervalMs - (current - lastStartedAt);
    if (remaining <= 0) {
      lastStartedAt = current;
      return;
    }
    await sleep(remaining);
    lastStartedAt = now();
  }

  function rememberCookies(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";")[0] ?? "";
      const separator = pair.indexOf("=");
      if (separator > 0) {
        cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
      }
    }
  }

  async function request(url: string, init?: FetchTextInit): Promise<string> {
    await waitForTurn();

    const headers: Record<string, string> = {
      ...init?.headers,
      "User-Agent": options.userAgent,
      "X-Requested-With": "XMLHttpRequest",
    };
    if (cookies.size > 0) {
      headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    }

    const signal = AbortSignal.timeout(timeoutMs);
    if (init?.body !== undefined) {
      headers["Content-Type"] = init.contentType ?? "application/x-www-form-urlencoded";
    }
    const response = await fetchImpl(
      url,
      init?.body !== undefined
        ? { method: "POST", body: init.body, headers, signal }
        : { headers, signal },
    );
    rememberCookies(response);

    if (!response.ok) {
      throw new Error(`A fonte respondeu ${response.status} para ${url}`);
    }
    return response.text();
  }

  return (url, init) => {
    const result = queue.then(() => request(url, init));
    queue = result.catch(() => undefined);
    return result;
  };
}
