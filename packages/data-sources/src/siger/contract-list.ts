import { load } from "cheerio";

export interface SigerContractListItem {
  /** Identificador interno do SIGER; é a chave do registro, pois o número se repete. */
  id: string;
  numero: string;
  /** Coluna "Tipo" da listagem: "CONTRATO" ou "ATA". Não aparece no detalhe. */
  tipo: string;
}

export interface SigerContractListPage {
  /** Total de registros anunciado pela fonte no rodapé da listagem. */
  total: number;
  items: SigerContractListItem[];
}

const GRID = "#CadContratoListExterno_datagrid";
const TOTAL = /de\s+([\d.]+)\s+registros/i;
const ROW_ID = /^row_(\d+)$/;

/** Interpreta uma página da listagem pública de contratos do SIGER. */
export function parseContractList(html: string): SigerContractListPage {
  const $ = load(html);
  const grid = $(GRID);
  const totalMatch = TOTAL.exec($(".tpagenavigation_resume").text());

  if (grid.length === 0 || !totalMatch?.[1]) {
    throw new Error("Página não reconhecida como listagem de contratos do SIGER.");
  }

  const items = grid
    .find("tbody tr")
    .toArray()
    .map((row): SigerContractListItem => {
      const id = ROW_ID.exec($(row).attr("id") ?? "")?.[1];
      if (!id) {
        throw new Error("Linha da listagem de contratos sem identificador interno.");
      }
      const cells = $(row).find("td");
      return { id, numero: cells.eq(1).text().trim(), tipo: cells.eq(2).text().trim() };
    });

  return { total: Number(totalMatch[1].replaceAll(".", "")), items };
}
