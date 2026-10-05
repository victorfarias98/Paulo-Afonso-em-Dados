import type { EntityType } from "@pad/database/schema";
import { sql } from "drizzle-orm";

import { getDb } from "./db";

export interface Correction {
  id: string;
  field: string;
  original: string | null;
  corrected: string | null;
  justification: string;
  createdAt: string;
}

/**
 * Correções manuais em vigor para um registro. Os valores são lidos como texto
 * para manter a forma em que foram gravados (por exemplo "1500.00").
 */
export async function listCorrections(
  entityType: EntityType,
  entityId: string,
): Promise<Correction[]> {
  return (await getDb().execute(sql`
    select id, field, original_value #>> '{}' as original, corrected_value #>> '{}' as corrected,
           justification,
           to_char(created_at at time zone 'America/Bahia', 'DD/MM/YYYY') as "createdAt"
      from manual_overrides
     where entity_type = ${entityType} and entity_id = ${entityId} and revoked_at is null
     order by created_at
  `)) as unknown as Correction[];
}

export interface ManualLinkNote {
  justification: string | null;
  createdAt: string;
}

/** Vínculo manual em vigor entre a obra e o contrato ao qual ela está ligada, se houver. */
export async function getManualWorkLink(
  workId: string,
  contractId: string,
): Promise<ManualLinkNote | null> {
  const rows = (await getDb().execute(sql`
    select evidence ->> 'justificativa' as justification,
           to_char(created_at at time zone 'America/Bahia', 'DD/MM/YYYY') as "createdAt"
      from entity_links
     where from_type = 'public_work' and from_id = ${workId}
       and to_type = 'contract' and to_id = ${contractId}
       and method = 'manual' and revoked_at is null
     limit 1
  `)) as unknown as ManualLinkNote[];
  return rows[0] ?? null;
}
