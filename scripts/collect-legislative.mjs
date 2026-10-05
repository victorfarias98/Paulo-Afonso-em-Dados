import { parseLegislativeSnapshot } from "../apps/web/src/lib/legislative.ts";
import { writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BASE = "https://sapl.pauloafonso.ba.leg.br/api/";
const yearText =
  process.argv[2] ??
  new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "America/Bahia",
  }).format(new Date());
if (!/^20\d{2}$/.test(yearText)) throw new Error("Informe um ano entre 2000 e 2099.");
const year = Number(yearText);
const wait = () => new Promise((resolve) => setTimeout(resolve, 2500));

async function collect(path, extra = {}) {
  let records = [];
  let expected;
  for (let page = 1; page <= 200; page += 1) {
    const url = new URL(path, BASE);
    for (const [key, value] of Object.entries({ ...extra, page_size: 100, page })) {
      url.searchParams.set(key, String(value));
    }
    await wait();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent": "PauloAfonsoEmDados/0.1 (https://baiustecnologia.com.br)",
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`SAPL respondeu ${response.status} em ${path}.`);
    const data = await response.json();
    const pagination = data.pagination;
    if (
      !Array.isArray(data.results) ||
      !Number.isSafeInteger(pagination?.total_entries) ||
      !Number.isSafeInteger(pagination?.total_pages) ||
      pagination.page !== page
    ) {
      throw new Error(`Resposta inesperada em ${path}.`);
    }
    expected ??= pagination.total_entries;
    if (expected !== pagination.total_entries)
      throw new Error("A fonte mudou durante a coleta. Repita a consulta.");
    records = [...records, ...data.results];
    if (page === pagination.total_pages || (page === 1 && expected === 0)) {
      if (
        records.length !== expected ||
        new Set(records.map((record) => record.id)).size !== expected
      ) {
        throw new Error(
          "Coleta incompleta ou com registros duplicados. A versão anterior foi preservada.",
        );
      }
      return { records, expected };
    }
  }
  throw new Error("A fonte excedeu o limite de páginas. A versão anterior foi preservada.");
}

const parliament = await collect("parlamentares/parlamentar/");
const authors = await collect("base/autor/");
const types = await collect("materia/tipomaterialegislativa/");
const matters = await collect("materia/materialegislativa/", { ano: year });
if (matters.records.some((matter) => matter.ano !== year))
  throw new Error("A fonte ignorou o filtro de ano.");
const snapshot = {
  collectedAt: new Date().toISOString(),
  year,
  complete: true,
  expectedMatters: matters.expected,
  parliament: parliament.records.map(({ id, nome_parlamentar, ativo }) => ({
    id,
    nome_parlamentar,
    ativo,
  })),
  authors: authors.records.map(({ id, object_id, content_type }) => ({
    id,
    object_id,
    content_type,
  })),
  types: types.records.map(({ id, sigla, descricao }) => ({ id, sigla, descricao })),
  matters: matters.records.map(({ id, ano, tipo, autores, numero, ementa, data_apresentacao }) => ({
    id,
    ano,
    tipo,
    autores,
    numero,
    ementa,
    data_apresentacao,
  })),
};
parseLegislativeSnapshot(snapshot);
const destination = fileURLToPath(
  new URL("../apps/web/src/data/legislative-snapshot.json", import.meta.url),
);
await writeFile(`${destination}.tmp`, `${JSON.stringify(snapshot)}\n`);
await rename(`${destination}.tmp`, destination);
process.stdout.write(
  `SAPL: ${matters.expected} matérias de ${year}; ${parliament.records.filter((p) => p.ativo).length} parlamentares marcados ativos. Coleta: ${snapshot.collectedAt}.\n`,
);
