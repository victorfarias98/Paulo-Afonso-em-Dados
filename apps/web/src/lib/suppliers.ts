import { type SQL, sql } from "drizzle-orm";

import { getDb } from "./db";
import { likePattern, UUID } from "./provenance";
import type { SupplierFilters, SupplierSort } from "./supplier-filters";

export const SUPPLIERS_PAGE_SIZE = 30;
const MIN_DOCUMENT_DIGITS = 4;

export interface SupplierRow {
  id: string;
  legalName: string;
  documentNumber: string | null;
  contractCount: number;
  contractedTotal: string;
  paidTotal: string;
}

export interface SupplierContract {
  id: string;
  number: string;
  description: string | null;
  originalValue: string | null;
  signedAt: string | null;
  status: string;
}

const ORDER_BY: Record<SupplierSort, SQL> = {
  maior_pago: sql`paid_total desc, "legalName"`,
  maior_contratado: sql`contracted_total desc, "legalName"`,
  nome: sql`"legalName"`,
};

async function rowsOf<T>(query: SQL): Promise<T[]> {
  return (await getDb().execute(query)) as unknown as T[];
}

/**
 * Somas por fornecedor. Só empresas (CNPJ) entram: o portal não monta página
 * nem lista de valores recebidos por pessoa física.
 */
function totalsWhere(condition: SQL): SQL {
  return sql`
    select s.id,
           s.legal_name as "legalName",
           s.document_number as "documentNumber",
           (select count(*)::int from contracts c
             where c.supplier_id = s.id and c.source_missing_since is null
               and c.kind <> 'termo_aditivo') as "contractCount",
           (select coalesce(sum(c.original_value), 0) from contracts c
             where c.supplier_id = s.id and c.source_missing_since is null
               and c.kind <> 'termo_aditivo') as contracted_total,
           (select coalesce(sum(p.value - coalesce(p.cancelled_value, 0)), 0) from payments p
             where p.supplier_id = s.id and p.source_missing_since is null) as paid_total
      from suppliers s
     where s.document_type = 'cnpj' and ${condition}
  `;
}

const SELECT_ROW = sql`
  select id, "legalName", "documentNumber", "contractCount",
         contracted_total::text as "contractedTotal", paid_total::text as "paidTotal"
`;

/** Busca por nome ou, havendo dígitos suficientes, pelo início do CNPJ. */
function searchCondition(q: string | undefined): SQL {
  if (!q) return sql`true`;
  const digits = q.replace(/\D/g, "");
  return digits.length >= MIN_DOCUMENT_DIGITS
    ? sql`(s.legal_name ilike ${likePattern(q)} or s.document_number like ${`${digits}%`})`
    : sql`s.legal_name ilike ${likePattern(q)}`;
}

export async function listSuppliers(filters: SupplierFilters) {
  const condition = searchCondition(filters.q);

  const [rows, [totals]] = await Promise.all([
    rowsOf<SupplierRow>(sql`
      ${SELECT_ROW} from (${totalsWhere(condition)}) totals
       order by ${ORDER_BY[filters.sort]}
       limit ${SUPPLIERS_PAGE_SIZE} offset ${(filters.page - 1) * SUPPLIERS_PAGE_SIZE}
    `),
    rowsOf<{ count: number }>(
      sql`select count(*)::int as count from suppliers s where s.document_type = 'cnpj' and ${condition}`,
    ),
  ]);

  return { rows, total: totals?.count ?? 0 };
}

/** Empresa com contratos, pagamentos por ano e órgãos. Null para pessoa física ou id inexistente. */
export async function getSupplier(id: string) {
  if (!UUID.test(id)) return null;

  const [supplier] = await rowsOf<SupplierRow>(
    sql`${SELECT_ROW} from (${totalsWhere(sql`s.id = ${id}`)}) totals`,
  );
  if (!supplier) return null;

  const [contracts, paidByYear, agencies] = await Promise.all([
    rowsOf<SupplierContract>(sql`
      select c.id, c.number, c.description, c.original_value::text as "originalValue",
             to_char(c.signed_at, 'YYYY-MM-DD') as "signedAt", c.status
        from contracts c
       where c.supplier_id = ${id} and c.source_missing_since is null
       order by c.signed_at desc nulls last
    `),
    rowsOf<{ year: number; total: string; count: number }>(sql`
      select p.fiscal_year as year, coalesce(sum(p.value - coalesce(p.cancelled_value, 0)), 0)::text as total, count(*)::int as count
        from payments p
       where p.supplier_id = ${id} and p.source_missing_since is null
       group by p.fiscal_year order by p.fiscal_year desc
    `),
    rowsOf<{ id: string; name: string }>(sql`
      select a.id, a.name
        from agencies a
       where a.id in (select c.agency_id from contracts c where c.supplier_id = ${id})
          or a.id in (select p.agency_id from payments p where p.supplier_id = ${id})
       order by a.name
    `),
  ]);

  return { supplier, contracts, paidByYear, agencies };
}
