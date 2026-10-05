import {
  createMunicipioOnlineClient,
  createPoliteFetcher,
  createSaiBidsClient,
  createSaiClient,
  createSigerClient,
  type ExpensePhase,
} from "@pad/data-sources";
import {
  createDatabase,
  type RunTrigger,
  MUNICIPIO_ONLINE_CMPA,
  MUNICIPIO_ONLINE_PMPA,
  SAI_CMPA,
  SIGER_PMPA,
  SOURCE_DEFINITIONS,
} from "@pad/database";

import {
  importMunicipioOnlineExpenses,
  reprocessExpenses,
} from "./municipio-online/import-expenses";
import { failInterruptedRequests, type JobRunners, processPendingRequests } from "./requests";
import { importCouncilBids } from "./sai/council-bids";
import { importCouncilContracts } from "./sai/council-contracts";
import { expenseMonthsFor, msUntilNextRun } from "./schedule";
import { importSigerBids } from "./siger/import-bids";
import { importSigerContracts } from "./siger/import-contracts";
import { importSigerWorks } from "./siger/import-works";

const DEFAULT_MIN_INTERVAL_MS = 2500;
const TIME_ZONE = "America/Bahia";

/** Origem das coletas em curso; o agendador troca para "schedule" na coleta diária. */
let currentTrigger: RunTrigger = "manual";

const write = (message: string): void => {
  process.stdout.write(`${new Date().toISOString()} ${message}\n`);
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não definida. Veja .env.example.`);
  }
  return value;
}

/** Lê `--nome=10` dos argumentos; ausente devolve undefined, inválido gera erro. */
function numberFlag(args: string[], name: string): number | undefined {
  const raw = args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
  if (raw === undefined) return undefined;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} deve ser um inteiro positivo; recebido "${raw}".`);
  }
  return value;
}

/** Data de hoje em Paulo Afonso, em AAAA-MM-DD. */
function todayInBahia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

type SigerImporter = typeof importSigerContracts;

async function runSiger(importer: SigerImporter, args: string[]): Promise<void> {
  const source = SOURCE_DEFINITIONS.find((definition) => definition.slug === SIGER_PMPA);
  if (!source) throw new Error("Fonte SIGER não definida no cadastro de fontes.");

  const maxPages = numberFlag(args, "max-pages");
  const maxDetails = numberFlag(args, "max-details");
  const fetchText = createPoliteFetcher({
    userAgent: requireEnv("COLLECTOR_USER_AGENT"),
    minIntervalMs: Number(process.env.COLLECTOR_MIN_INTERVAL_MS ?? DEFAULT_MIN_INTERVAL_MS),
  });
  const { db, close } = createDatabase(requireEnv("DATABASE_URL"), 2);

  try {
    const summary = await importer({
      db,
      client: createSigerClient({ baseUrl: source.baseUrl, fetchText }),
      baseUrl: source.baseUrl,
      today: todayInBahia(),
      trigger: currentTrigger,
      log: write,
      maxPages,
      maxDetails,
    });
    write(`Coleta ${summary.status}: ${JSON.stringify(summary)}`);
    if (summary.status === "failed") process.exitCode = 1;
  } finally {
    await close();
  }
}

const PHASES: Record<string, ExpensePhase> = {
  empenhos: "commitment",
  liquidacoes: "liquidation",
  pagamentos: "payment",
};

function textFlag(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
}

/** Lê "--months=1-9" ou "--months=3,4"; sem a opção, todos os meses até o atual. */
function monthsFlag(args: string[], year: number, today: string): number[] {
  const raw = textFlag(args, "months");
  if (!raw) {
    const last = Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) : 12;
    return Array.from({ length: last }, (_, index) => index + 1);
  }
  const range = /^(\d{1,2})-(\d{1,2})$/.exec(raw);
  const months = range
    ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i)
    : raw.split(",").map(Number);
  if (months.length === 0 || months.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) {
    throw new Error(`--months inválido: "${raw}". Use, por exemplo, 1-9 ou 3,4.`);
  }
  return months;
}

/**
 * Coleta despesas no Município Online: uma fase, um ano, meses escolhidos. A
 * Prefeitura e a Câmara usam a mesma plataforma, em endereços e fontes distintos.
 */
async function runExpenses(args: string[], sourceSlug = MUNICIPIO_ONLINE_PMPA): Promise<void> {
  const source = SOURCE_DEFINITIONS.find((item) => item.slug === sourceSlug);
  if (!source) throw new Error("Fonte Município Online não definida no cadastro de fontes.");

  const phaseName = textFlag(args, "fase") ?? "";
  const phase = PHASES[phaseName];
  if (!phase) {
    throw new Error(`--fase deve ser uma de: ${Object.keys(PHASES).join(", ")}.`);
  }
  const today = todayInBahia();
  const year = numberFlag(args, "ano") ?? Number(today.slice(0, 4));
  const pageUrl = `${source.baseUrl}/cidadao/despesa`;
  const fetchText = createPoliteFetcher({
    userAgent: requireEnv("COLLECTOR_USER_AGENT"),
    minIntervalMs: Number(process.env.COLLECTOR_MIN_INTERVAL_MS ?? DEFAULT_MIN_INTERVAL_MS),
  });
  const { db, close } = createDatabase(requireEnv("DATABASE_URL"), 2);

  try {
    const summary = await importMunicipioOnlineExpenses({
      db,
      client: createMunicipioOnlineClient({ pageUrl, fetchText }),
      pageUrl,
      sourceSlug,
      phase,
      year,
      months: monthsFlag(args, year, today),
      today,
      trigger: currentTrigger,
      log: write,
    });
    write(`Coleta ${summary.status}: ${JSON.stringify(summary)}`);
  } finally {
    await close();
  }
}

/** Refaz a normalização das despesas a partir dos registros brutos, sem consultar a fonte. */
async function runReprocessExpenses(): Promise<void> {
  const { db, close } = createDatabase(requireEnv("DATABASE_URL"), 2);

  try {
    for (const slug of [MUNICIPIO_ONLINE_PMPA, MUNICIPIO_ONLINE_CMPA]) {
      const source = SOURCE_DEFINITIONS.find((item) => item.slug === slug);
      if (!source) throw new Error(`Fonte ${slug} não definida no cadastro de fontes.`);
      for (const phase of Object.values(PHASES)) {
        const result = await reprocessExpenses(db, phase, `${source.baseUrl}/cidadao/despesa`, slug);
        write(`Reprocessado ${slug} ${phase}: ${JSON.stringify(result)}`);
      }
    }
  } finally {
    await close();
  }
}

/** Coleta os contratos da Câmara Municipal na API do seu portal da transparência. */
async function runCouncilContracts(): Promise<void> {
  const source = SOURCE_DEFINITIONS.find((item) => item.slug === SAI_CMPA);
  if (!source) throw new Error("Fonte da Câmara não definida no cadastro de fontes.");
  const fetchText = createPoliteFetcher({
    userAgent: requireEnv("COLLECTOR_USER_AGENT"),
    minIntervalMs: Number(process.env.COLLECTOR_MIN_INTERVAL_MS ?? DEFAULT_MIN_INTERVAL_MS),
  });
  const { db, close } = createDatabase(requireEnv("DATABASE_URL"), 2);

  try {
    const summary = await importCouncilContracts({
      db,
      client: createSaiClient({
        apiUrl: source.baseUrl,
        govPath: "ba/camarapauloafonso",
        orgCode: 2370,
        fetchText,
      }),
      today: todayInBahia(),
      trigger: currentTrigger,
      log: write,
    });
    write(`Coleta ${summary.status}: ${JSON.stringify(summary)}`);
  } finally {
    await close();
  }
}

/** Coleta as licitações da Câmara Municipal na API do seu portal da transparência. */
async function runCouncilBids(): Promise<void> {
  const source = SOURCE_DEFINITIONS.find((item) => item.slug === SAI_CMPA);
  if (!source) throw new Error("Fonte da Câmara não definida no cadastro de fontes.");
  const fetchText = createPoliteFetcher({
    userAgent: requireEnv("COLLECTOR_USER_AGENT"),
    minIntervalMs: Number(process.env.COLLECTOR_MIN_INTERVAL_MS ?? DEFAULT_MIN_INTERVAL_MS),
  });
  const { db, close } = createDatabase(requireEnv("DATABASE_URL"), 2);

  try {
    const summary = await importCouncilBids({
      db,
      client: createSaiBidsClient({
        apiUrl: source.baseUrl,
        govPath: "ba/camarapauloafonso",
        orgCode: 2370,
        fetchText,
      }),
      today: todayInBahia(),
      trigger: currentTrigger,
      log: write,
    });
    write(`Coleta ${summary.status}: ${JSON.stringify(summary)}`);
  } finally {
    await close();
  }
}

const DEFAULT_DAILY_AT = "05:00";
/** Detalhes de contrato buscados por dia: novos primeiro, depois os conferidos há mais tempo. */
const DAILY_CONTRACT_DETAILS = 80;

type NamedJob = [string, () => Promise<void>];

const runDailyContracts = (): Promise<void> =>
  runSiger(importSigerContracts, [`--max-details=${DAILY_CONTRACT_DETAILS}`]);

/** Empenhos, liquidações e pagamentos do mês atual e do anterior, de uma das fontes. */
function expenseJobs(sourceSlug = MUNICIPIO_ONLINE_PMPA): NamedJob[] {
  const owner = sourceSlug === MUNICIPIO_ONLINE_CMPA ? " da Câmara" : "";
  const jobs: NamedJob[] = [];
  for (const { year, months } of expenseMonthsFor(todayInBahia())) {
    for (const phase of Object.keys(PHASES)) {
      jobs.push([
        `${phase}${owner} ${year}`,
        () =>
          runExpenses(
            [`--fase=${phase}`, `--ano=${year}`, `--months=${months.join(",")}`],
            sourceSlug,
          ),
      ]);
    }
  }
  return jobs;
}

/** Executa as coletas, uma por vez. A falha de uma não impede as seguintes. */
async function runJobs(jobs: NamedJob[]): Promise<void> {
  for (const [name, job] of jobs) {
    try {
      write(`Iniciando coleta: ${name}`);
      await job();
    } catch (error) {
      write(`Coleta de ${name} falhou: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function runAllCollections(): Promise<void> {
  return runJobs([
    ["obras", () => runSiger(importSigerWorks, [])],
    ["licitações", () => runSiger(importSigerBids, [])],
    ["contratos", runDailyContracts],
    ["contratos da Câmara", () => runCouncilContracts()],
    ["licitações da Câmara", () => runCouncilBids()],
    ...expenseJobs(),
    ...expenseJobs(MUNICIPIO_ONLINE_CMPA),
  ]);
}

/** O que cada pedido de coleta feito no admin executa. */
const REQUEST_RUNNERS: JobRunners = {
  obras: () => runSiger(importSigerWorks, []),
  licitacoes: () => runSiger(importSigerBids, []),
  contratos: runDailyContracts,
  camara_contratos: () => runCouncilContracts(),
  camara_licitacoes: () => runCouncilBids(),
  despesas: () => runJobs(expenseJobs()),
  camara_despesas: () => runJobs(expenseJobs(MUNICIPIO_ONLINE_CMPA)),
  tudo: runAllCollections,
};

const REQUEST_POLL_MS = 60_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Fica em execução: coleta tudo uma vez por dia, no horário de WORKER_DAILY_AT
 * (hora de Paulo Afonso), e nos intervalos atende os pedidos feitos no admin.
 */
async function runScheduler(): Promise<void> {
  const dailyAt = process.env.WORKER_DAILY_AT ?? DEFAULT_DAILY_AT;
  const { db } = createDatabase(requireEnv("DATABASE_URL"), 1);
  const interrupted = await failInterruptedRequests(db);
  if (interrupted > 0) write(`${interrupted} pedido(s) do admin interrompido(s) por reinício.`);

  for (;;) {
    const nextDaily = Date.now() + msUntilNextRun(new Date(), dailyAt);
    write(`Próxima coleta às ${dailyAt}, em ${Math.round((nextDaily - Date.now()) / 60_000)} minutos.`);

    while (Date.now() < nextDaily) {
      await sleep(Math.min(REQUEST_POLL_MS, nextDaily - Date.now()));
      try {
        currentTrigger = "manual";
        await processPendingRequests(db, REQUEST_RUNNERS, write);
      } catch (error) {
        write(`Fila de pedidos indisponível: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    currentTrigger = "schedule";
    await runAllCollections();
    currentTrigger = "manual";
  }
}

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  agendar: runScheduler,
  "coletar:tudo": runAllCollections,
  "camara:contratos": runCouncilContracts,
  "camara:licitacoes": runCouncilBids,
  "camara:despesas": (args) => runExpenses(args, MUNICIPIO_ONLINE_CMPA),
  despesas: (args) => runExpenses(args),
  "despesas:reprocessar": runReprocessExpenses,
  "siger:contracts": (args) => runSiger(importSigerContracts, args),
  "siger:works": (args) => runSiger(importSigerWorks, args),
  "siger:bids": (args) => runSiger(importSigerBids, args),
};

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const handler = command ? COMMANDS[command] : undefined;

  if (!handler) {
    throw new Error(`Comando desconhecido. Disponíveis: ${Object.keys(COMMANDS).join(", ")}`);
  }
  await handler(args);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
