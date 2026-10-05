import { sql } from "drizzle-orm";

import type { Database } from "./client";
import { type EntityType, sourceDatasets, sources, type SourceType } from "./schema";

interface SourceDefinition {
  slug: string;
  name: string;
  agencyName: string;
  sourceType: SourceType;
  baseUrl: string;
  isDocumented: boolean;
  notes: string;
  datasets: EntityType[];
}

export const SIGER_PMPA = "siger-pmpa";
export const PNCP = "pncp";
export const MUNICIPIO_ONLINE_PMPA = "municipio-online-pmpa";
export const MUNICIPIO_ONLINE_CMPA = "municipio-online-cmpa";
export const SAI_CMPA = "sai-cmpa";

/**
 * Fontes oficiais verificadas em docs/data-sources.md. São metadados das
 * fontes, não dados coletados: nenhum contrato, obra ou valor é semeado.
 */
export const SOURCE_DEFINITIONS: readonly SourceDefinition[] = [
  {
    slug: SIGER_PMPA,
    name: "SIGER Web — Prefeitura de Paulo Afonso",
    agencyName: "Prefeitura Municipal de Paulo Afonso",
    sourceType: "html",
    baseUrl: "https://sigerweb.net.br/pm_pauloafonso",
    isDocumented: false,
    notes: "Licitações, contratos e obras. Páginas públicas sem API documentada.",
    datasets: ["contract", "public_work", "bid"],
  },
  {
    slug: PNCP,
    name: "PNCP — Portal Nacional de Contratações Públicas",
    agencyName: "Ministério da Gestão e da Inovação em Serviços Públicos",
    sourceType: "api",
    baseUrl: "https://pncp.gov.br/api/consulta",
    isDocumented: true,
    notes: "Contratações sob a Lei 14.133/2021 publicadas pelo Município.",
    datasets: [],
  },
  {
    slug: MUNICIPIO_ONLINE_PMPA,
    name: "Município Online — Prefeitura de Paulo Afonso",
    agencyName: "Prefeitura Municipal de Paulo Afonso",
    sourceType: "html",
    baseUrl: "https://www.municipioonline.com.br/ba/prefeitura/pauloafonso",
    isDocumented: false,
    notes: "Despesa orçamentária, empenhos, liquidações e pagamentos.",
    datasets: ["commitment", "liquidation", "payment"],
  },
  {
    slug: MUNICIPIO_ONLINE_CMPA,
    name: "Município Online — Câmara de Paulo Afonso",
    agencyName: "Câmara Municipal de Paulo Afonso",
    sourceType: "html",
    baseUrl: "https://www.municipioonline.com.br/ba/camara/pauloafonso",
    isDocumented: false,
    notes: "Empenhos, liquidações e pagamentos da Câmara Municipal.",
    datasets: ["commitment", "liquidation", "payment"],
  },
  {
    slug: SAI_CMPA,
    name: "Portal da Transparência da Câmara (SAI/IMAP)",
    agencyName: "Câmara Municipal de Paulo Afonso",
    sourceType: "api",
    baseUrl: "https://sai2.io.org.br/v3",
    isDocumented: false,
    notes: "API interna do portal da Câmara. Parte dos documentos de contratados vem mascarada.",
    datasets: ["contract", "bid"],
  },
];

/** Cria ou atualiza o cadastro das fontes e seus conjuntos de dados. Idempotente. */
export async function seedSources(db: Database): Promise<void> {
  for (const { datasets, ...definition } of SOURCE_DEFINITIONS) {
    const [source] = await db
      .insert(sources)
      .values({ ...definition, isOfficial: true })
      .onConflictDoUpdate({
        target: sources.slug,
        set: { ...definition, updatedAt: sql`now()` },
      })
      .returning({ id: sources.id });

    if (!source) {
      throw new Error(`Não foi possível registrar a fonte ${definition.slug}.`);
    }
    for (const entityType of datasets) {
      await db
        .insert(sourceDatasets)
        .values({ sourceId: source.id, entityType })
        .onConflictDoNothing();
    }
  }
}
