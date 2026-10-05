import type { FetchText } from "../http";
import {
  parseBidDetail,
  parseBidList,
  type SigerBidListPage,
  type SigerBidPayload,
} from "./bid";
import { parseContractDetail, type SigerContractPayload } from "./contract-detail";
import { parseContractList, type SigerContractListPage } from "./contract-list";
import {
  parseWorkDetail,
  parseWorkList,
  type SigerWorkListPage,
  type SigerWorkPayload,
} from "./work";

/** Tamanho de página da listagem; a fonte ignora valores diferentes (verificado em 2026-10-04). */
export const SIGER_PAGE_SIZE = 20;

export interface SigerClientOptions {
  /** Ex.: https://sigerweb.net.br/pm_pauloafonso */
  baseUrl: string;
  fetchText: FetchText;
}

export interface SigerClient {
  /** Página da listagem de contratos, do id interno mais recente para o mais antigo. */
  listContractsPage(page: number): Promise<SigerContractListPage>;
  getContract(id: string): Promise<SigerContractPayload>;
  /** Página da listagem de obras, do id interno mais recente para o mais antigo. */
  listWorksPage(page: number): Promise<SigerWorkListPage>;
  getWork(id: string): Promise<SigerWorkPayload>;
  /** Página da listagem de licitações, do id interno mais recente para o mais antigo. */
  listBidsPage(page: number): Promise<SigerBidListPage>;
  getBid(id: string): Promise<SigerBidPayload>;
}

function assertPage(page: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`Página inválida: ${String(page)}`);
  }
}

function assertId(id: string, entity: string): void {
  if (!/^\d+$/.test(id)) {
    throw new Error(`Identificador inválido de ${entity}: "${id}"`);
  }
}

export function createSigerClient({ baseUrl, fetchText }: SigerClientOptions): SigerClient {
  const engine = `${baseUrl}/engine.php`;
  const listUrl = (className: string, page: number): string =>
    `${engine}?class=${className}&method=onReload&offset=${(page - 1) * SIGER_PAGE_SIZE}` +
    `&limit=${SIGER_PAGE_SIZE}&direction=desc&page=${page}&first_page=1&order=id`;

  return {
    async listContractsPage(page) {
      assertPage(page);
      return parseContractList(await fetchText(listUrl("CadContratoListExterno", page)));
    },

    async listBidsPage(page) {
      assertPage(page);
      return parseBidList(await fetchText(listUrl("LicLicitacaoListExterno", page)));
    },

    async getBid(id) {
      assertId(id, "licitação");
      const bid = parseBidDetail(
        await fetchText(
          `${engine}?class=LicLicitacaoFormExternoView&method=onEdit&key=${id}&id=${id}`,
        ),
      );
      if (bid.id !== id) {
        throw new Error(`Licitação pedida ${id}, mas a fonte devolveu ${bid.id}.`);
      }
      return bid;
    },

    async listWorksPage(page) {
      assertPage(page);
      return parseWorkList(await fetchText(listUrl("CadObrasListExterno", page)));
    },

    async getWork(id) {
      assertId(id, "obra");
      const work = parseWorkDetail(
        await fetchText(`${engine}?class=CadObrasFormExterno&method=onEdit&key=${id}&id=${id}`),
      );
      if (work.id !== id) {
        throw new Error(`Obra pedida ${id}, mas a fonte devolveu ${work.id}.`);
      }
      return work;
    },

    async getContract(id) {
      assertId(id, "contrato");
      const html = await fetchText(
        `${engine}?class=CadContratoFormExterno&method=onEdit&key=${id}&id=${id}`,
      );
      const contract = parseContractDetail(html);
      if (contract.id !== id) {
        throw new Error(`Contrato pedido ${id}, mas a fonte devolveu ${contract.id}.`);
      }
      return contract;
    },
  };
}
