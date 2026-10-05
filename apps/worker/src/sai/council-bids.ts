import { type SaiBid, saiBidKey, type SaiBidsClient } from "@pad/data-sources";
import { bids, SAI_CMPA } from "@pad/database";
import { and, eq, inArray, isNotNull, isNull, notInArray } from "drizzle-orm";

import {
  type ImportOptions,
  type ImportSummary,
  runSourceImport,
  storeAndPersist,
} from "../pipeline/run-import";
import { persistBid } from "../siger/import-bids";
import { type NormalizedBid, statusKey } from "../siger/normalize-bid";
import { COUNCIL_NAME } from "./council-contracts";

/** A API não tem endereço por licitação; o registro é conferido na listagem pública. */
export const COUNCIL_BIDS_URL =
  "https://transparencia.cmpa.ba.gov.br/ba/camarapauloafonso/licitacoes";

const ISO_DATE = /^(\d{4})-\d{2}-\d{2}/;

function isoDate(value: string | null | undefined): string | null {
  const match = value ? ISO_DATE.exec(value) : null;
  return match && match[1] !== "0001" ? match[0] : null;
}

/** A API manda 0 quando o valor não foi informado; 0 não é tratado como valor real. */
function moneyOrNull(value: number | null | undefined): string | null {
  return value === null || value === undefined || value === 0 ? null : value.toFixed(2);
}

const text = (value: string | null): string | null => value?.trim() || null;

/** Converte uma licitação da API do portal da Câmara no formato comum de licitações. */
export function normalizeCouncilBid(bid: SaiBid): NormalizedBid {
  const estimatedValue = moneyOrNull(bid.ValorEstimado);
  const homologatedValue = moneyOrNull(bid.ValorHomologado);
  const openingDate = isoDate(bid.DataLicitacao);
  const sourceStatus = text(bid.Status);

  return {
    bid: {
      externalId: saiBidKey(bid),
      sourceUrl: COUNCIL_BIDS_URL,
      number: bid.NumeroLicitacao,
      modality: text(bid.Modalidade),
      processNumber: text(bid.NumeroProcesso),
      description: text(bid.Objeto),
      estimatedValue,
      homologatedValue,
      publishedAt: null,
      openingDate,
      sourceStatus,
      status: statusKey(sourceStatus),
    },
    agencyName: COUNCIL_NAME,
    transformations: [
      {
        field: "estimatedValue",
        from: bid.ValorEstimado ?? null,
        to: estimatedValue,
        rule: "zero_as_not_informed",
      },
      {
        field: "homologatedValue",
        from: bid.ValorHomologado ?? null,
        to: homologatedValue,
        rule: "zero_as_not_informed",
      },
      {
        field: "openingDate",
        from: bid.DataLicitacao ?? null,
        to: openingDate,
        rule: "iso_datetime_to_date",
      },
    ],
  };
}

export interface ImportCouncilBidsOptions extends ImportOptions {
  client: SaiBidsClient;
}

interface Item {
  id: string;
  bid: SaiBid;
}

/**
 * Coleta as licitações da Câmara, um ano por vez, em todos os anos que a fonte
 * oferece. Se a consulta de algum ano falhar, a coleta inteira falha: uma lista
 * incompleta não pode ser usada para marcar registros como ausentes.
 */
export function importCouncilBids(options: ImportCouncilBidsOptions): Promise<ImportSummary> {
  const { db, client, today } = options;
  let all: Item[] | null = null;

  async function loadAll(): Promise<Item[]> {
    const byId = new Map<string, Item>();
    for (const year of await client.listBidYears()) {
      for (const bid of await client.listBids(year)) {
        byId.set(saiBidKey(bid), { id: saiBidKey(bid), bid });
      }
    }
    return [...byId.values()];
  }

  return runSourceImport<Item>({
    ...options,
    sourceSlug: SAI_CMPA,
    entityType: "bid",
    label: "Licitação da Câmara",
    pageSize: Number.MAX_SAFE_INTEGER,

    async listPage(page) {
      all ??= await loadAll();
      return { total: all.length, items: page === 1 ? all : [] };
    },

    async lastSeenByExternalId(sourceId) {
      const known = await db
        .select({ externalId: bids.externalId, lastSeenAt: bids.lastSeenAt })
        .from(bids)
        .where(eq(bids.sourceId, sourceId));
      return new Map(known.map((row) => [row.externalId, row.lastSeenAt.getTime()]));
    },

    importOne({ sourceId, runId }, item) {
      return storeAndPersist(
        db,
        {
          sourceId,
          entityType: "bid",
          externalId: item.id,
          sourceUrl: COUNCIL_BIDS_URL,
          fetchMethod: "json_api",
          payload: item.bid,
          runId,
        },
        (rawRecordId) => persistBid(db, sourceId, rawRecordId, normalizeCouncilBid(item.bid)),
      );
    },

    async markMissing(sourceId, seenIds) {
      if (seenIds.length === 0) return 0;
      const fromSource = eq(bids.sourceId, sourceId);
      await db
        .update(bids)
        .set({ sourceMissingSince: null })
        .where(and(fromSource, isNotNull(bids.sourceMissingSince), inArray(bids.externalId, seenIds)));
      const gone = await db
        .update(bids)
        .set({ sourceMissingSince: today })
        .where(and(fromSource, isNull(bids.sourceMissingSince), notInArray(bids.externalId, seenIds)))
        .returning({ id: bids.id });
      return gone.length;
    },
  });
}
