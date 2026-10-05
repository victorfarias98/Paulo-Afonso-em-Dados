import { type Database, entityLinks, type EntityType, type LinkConfidence, type LinkMethod } from "@pad/database";
import { type SQL, sql } from "drizzle-orm";

import { linkWorksToContracts } from "./work-repository";

interface LinkedRow {
  from_id: string;
  to_id: string;
  evidence: string;
}

interface LinkKind {
  fromType: EntityType;
  toType: EntityType;
  relation: string;
  method: LinkMethod;
  confidence: LinkConfidence;
  /** Campo da fonte que sustenta o vínculo, guardado como evidência. */
  field: string;
}

/** Vínculos gravados por comando; o Postgres aceita no máximo 65.535 parâmetros. */
const LINK_BATCH_SIZE = 1000;

/**
 * Executa o UPDATE que resolve o vínculo e registra cada ligação nova em
 * `entity_links`, na mesma transação: ou as duas coisas acontecem, ou nenhuma.
 */
async function link(db: Database, update: SQL, kind: LinkKind): Promise<number> {
  return db.transaction(async (tx) => {
    const linked = (await tx.execute(update)) as unknown as LinkedRow[];

    for (let start = 0; start < linked.length; start += LINK_BATCH_SIZE) {
      await tx
        .insert(entityLinks)
        .values(
          linked.slice(start, start + LINK_BATCH_SIZE).map((row) => ({
            fromType: kind.fromType,
            fromId: row.from_id,
            toType: kind.toType,
            toId: row.to_id,
            relation: kind.relation,
            method: kind.method,
            confidence: kind.confidence,
            evidence: { campo: kind.field, valor: row.evidence },
          })),
        )
        .onConflictDoNothing();
    }
    return linked.length;
  });
}

/**
 * Contrato → licitação pelo número publicado no contrato. Só liga quando existe
 * exatamente uma licitação com aquele número; número repetido fica sem vínculo.
 */
function linkContractsToBids(db: Database, sourceId: string): Promise<number> {
  return link(
    db,
    sql`
      update contracts c
         set bid_id = b.id, updated_at = now()
        from bids b
       where c.source_id = ${sourceId}
         and b.source_id = c.source_id
         and b.number = c.bid_number
         and c.bid_id is null
         and (select count(*) from bids other
               where other.source_id = b.source_id and other.number = b.number) = 1
      returning c.id as from_id, b.id as to_id, c.bid_number as evidence
    `,
    {
      fromType: "contract",
      toType: "bid",
      relation: "originado_de_licitacao",
      method: "number_match",
      confidence: "media",
      field: "con_licitacao",
    },
  );
}

/** Obra → licitação pelo id interno que a própria fonte publica na obra. */
function linkWorksToBids(db: Database, sourceId: string): Promise<number> {
  return link(
    db,
    sql`
      update public_works pw
         set bid_id = b.id, updated_at = now()
        from bids b
       where pw.source_id = ${sourceId}
         and b.source_id = pw.source_id
         and b.external_id = pw.bid_external_id
         and pw.bid_id is null
      returning pw.id as from_id, b.id as to_id, pw.bid_external_id as evidence
    `,
    {
      fromType: "public_work",
      toType: "bid",
      relation: "originada_de_licitacao",
      method: "source_fk",
      confidence: "alta",
      field: "id_licitacao",
    },
  );
}

const EXPENSE_TABLES: Array<{ table: string; type: EntityType }> = [
  { table: "commitments", type: "commitment" },
  { table: "liquidations", type: "liquidation" },
  { table: "payments", type: "payment" },
];

/**
 * Empenho, liquidação ou pagamento → contrato. A despesa publica a licitação de
 * origem e o credor; liga-se ao contrato quando existe exatamente um contrato
 * daquela licitação com aquele fornecedor. Havendo mais de um, fica sem vínculo.
 */
export async function linkExpensesToContracts(db: Database): Promise<number> {
  let linked = 0;
  for (const { table, type } of EXPENSE_TABLES) {
    linked += await link(
      db,
      sql`
        update ${sql.identifier(table)} e
           set contract_id = c.id, updated_at = now()
          from contracts c
         where e.contract_id is null
           and e.bid_reference is not null
           and e.supplier_id is not null
           and c.bid_number = e.bid_reference
           and c.supplier_id = e.supplier_id
           and (select count(*) from contracts other
                 where other.bid_number = c.bid_number
                   and other.supplier_id = c.supplier_id) = 1
        returning e.id as from_id, c.id as to_id, e.bid_reference as evidence
      `,
      {
        fromType: type,
        toType: "contract",
        relation: "referente_a_contrato",
        method: "number_match",
        confidence: "media",
        field: "licitação de origem + credor",
      },
    );
  }
  return linked;
}

const EXPENSE_FOLLOWUPS: Array<{ table: string; type: EntityType }> = [
  { table: "liquidations", type: "liquidation" },
  { table: "payments", type: "payment" },
];

/**
 * Liquidação ou pagamento → empenho. O registro cita o número do empenho (a
 * coluna "Empenho", não o sequencial "SqEmpenho"), que é único dentro da
 * unidade gestora e do ano. Verificado em 2026-10-05: por esse número, todos os
 * 13.338 pagamentos coletados batem com um único empenho, com descrição,
 * elemento, unidade e credor iguais. A descrição e o credor continuam sendo
 * exigidos, para não ligar a um empenho de outro exercício com o mesmo número.
 */
export async function linkExpensesToCommitments(db: Database): Promise<number> {
  let linked = 0;
  for (const { table, type } of EXPENSE_FOLLOWUPS) {
    linked += await link(
      db,
      sql`
        update ${sql.identifier(table)} e
           set commitment_id = c.id, updated_at = now()
          from commitments c
         where e.commitment_id is null
           and e.commitment_number is not null
           and c.source_id = e.source_id
           and c.fiscal_year = e.fiscal_year
           and split_part(c.external_id, ':', 1) = split_part(e.external_id, ':', 1)
           and c.number = e.commitment_number
           and (select count(*) from commitments other
                 where other.source_id = c.source_id and other.fiscal_year = c.fiscal_year
                   and other.number = c.number
                   and split_part(other.external_id, ':', 1) = split_part(c.external_id, ':', 1)) = 1
           and c.commitment_description is not distinct from e.commitment_description
           and c.supplier_id is not distinct from e.supplier_id
           and e.commitment_description is not null
        returning e.id as from_id, c.id as to_id, e.commitment_number as evidence
      `,
      {
        fromType: type,
        toType: "commitment",
        relation: "referente_a_empenho",
        method: "number_match",
        confidence: "media",
        field: "número do empenho + descrição do empenho + credor",
      },
    );
  }
  return linked;
}

/**
 * Reaplica os vínculos obra → contrato feitos à mão no admin. A coleta de obras
 * zera `contract_id` a cada execução; o vínculo manual em vigor é restaurado aqui,
 * sem passar por cima de um vínculo que a própria fonte informe.
 */
export async function applyManualWorkLinks(db: Database): Promise<number> {
  const applied = (await db.execute(sql`
    update public_works pw
       set contract_id = l.to_id, updated_at = now()
      from entity_links l
     where l.from_type = 'public_work' and l.from_id = pw.id
       and l.to_type = 'contract' and l.method = 'manual' and l.revoked_at is null
       and pw.contract_id is null
    returning pw.id
  `)) as unknown as Array<{ id: string }>;
  return applied.length;
}

/**
 * Resolve os vínculos entre obras, contratos, licitações e despesas. Roda ao fim
 * de cada coleta, porque qualquer uma delas pode chegar antes das outras.
 */
export async function linkSigerEntities(db: Database, sourceId: string): Promise<void> {
  await linkWorksToContracts(db, sourceId);
  await applyManualWorkLinks(db);
  await linkContractsToBids(db, sourceId);
  await linkWorksToBids(db, sourceId);
  await linkExpensesToContracts(db);
}
