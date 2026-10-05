import type { Database } from "@pad/database/client";
import {
  adminAuditLog,
  adminUsers,
  COLLECTION_JOBS,
  type CollectionJob,
  collectionRequests,
  contracts,
  entityLinks,
  manualOverrides,
  publicWorks,
} from "@pad/database/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MIN_JUSTIFICATION = 10;
const WORK_CONTRACT_RELATION = "executada_por_contrato";

const justification = z
  .string()
  .trim()
  .min(MIN_JUSTIFICATION, `Explique o motivo em pelo menos ${MIN_JUSTIFICATION} caracteres.`)
  .max(2000);

const fail = (message: string): ActionResult => ({ ok: false, message });
const done = (message: string): ActionResult => ({ ok: true, message });
const firstIssue = (error: z.ZodError): string => error.issues[0]?.message ?? "Dados inválidos.";

/** Devolve o id do registro do admin, criando-o no primeiro uso. */
export async function ensureAdminUser(db: Database, login: string): Promise<string> {
  const [user] = await db
    .insert(adminUsers)
    .values({ login, name: login })
    .onConflictDoUpdate({ target: adminUsers.login, set: { updatedAt: sql`now()` } })
    .returning({ id: adminUsers.id });
  if (!user) throw new Error("Não foi possível registrar o usuário do admin.");
  return user.id;
}

const audit = (
  db: Pick<Database, "insert">,
  userId: string,
  action: string,
  details: Record<string, unknown>,
) => db.insert(adminAuditLog).values({ userId, action, details });

const linkInput = z.object({
  workId: z.string().regex(UUID_IN_TEXT),
  contract: z.string().trim().min(1, "Informe o número ou o endereço do contrato no portal."),
  justification,
});

/**
 * Liga uma obra a um contrato por decisão humana. O vínculo fica em `entity_links`
 * com método "manual", autor e justificativa; o worker o reaplica a cada coleta.
 */
export async function linkWorkToContract(
  db: Database,
  userId: string,
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = linkInput.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const input = parsed.data;

  const contractId = UUID_IN_TEXT.exec(input.contract)?.[0];
  const matches = await db
    .select({ id: contracts.id, number: contracts.number })
    .from(contracts)
    .where(
      contractId
        ? eq(contracts.id, contractId)
        : sql`upper(${contracts.number}) = upper(${input.contract})`,
    )
    .limit(2);
  const contract = matches[0];
  if (!contract) return fail(`Nenhum contrato encontrado para “${input.contract}”.`);
  if (matches.length > 1) {
    return fail(
      `Há mais de um contrato com o número “${input.contract}”. Cole o endereço da página do contrato no portal.`,
    );
  }

  return db.transaction(async (tx) => {
    const [work] = await tx
      .select({ id: publicWorks.id, contractId: publicWorks.contractId })
      .from(publicWorks)
      .where(eq(publicWorks.id, input.workId));
    if (!work) return fail("Obra não encontrada.");
    if (work.contractId) return fail("Esta obra já está ligada a um contrato.");

    const evidence = { justificativa: input.justification };
    await tx
      .insert(entityLinks)
      .values({
        fromType: "public_work",
        fromId: work.id,
        toType: "contract",
        toId: contract.id,
        relation: WORK_CONTRACT_RELATION,
        method: "manual",
        confidence: "manual",
        evidence,
        createdBy: userId,
      })
      .onConflictDoUpdate({
        target: [
          entityLinks.fromType,
          entityLinks.fromId,
          entityLinks.toType,
          entityLinks.toId,
          entityLinks.relation,
          entityLinks.method,
        ],
        set: { revokedAt: null, createdBy: userId, createdAt: sql`now()`, evidence },
      });
    await tx
      .update(publicWorks)
      .set({ contractId: contract.id, updatedAt: sql`now()` })
      .where(eq(publicWorks.id, work.id));
    await audit(tx, userId, "vinculo_manual_criado", {
      obra: work.id,
      contrato: contract.id,
      justificativa: input.justification,
    });
    return done(`Obra ligada ao contrato ${contract.number}.`);
  });
}

/** Desfaz um vínculo manual. O registro permanece, marcado como revogado. */
export async function revokeManualLink(
  db: Database,
  userId: string,
  linkId: string,
): Promise<ActionResult> {
  if (!UUID_IN_TEXT.test(linkId)) return fail("Vínculo inválido.");

  return db.transaction(async (tx) => {
    const [link] = await tx
      .update(entityLinks)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(entityLinks.id, linkId),
          eq(entityLinks.method, "manual"),
          isNull(entityLinks.revokedAt),
        ),
      )
      .returning({ fromId: entityLinks.fromId, toId: entityLinks.toId });
    if (!link) return fail("Vínculo manual não encontrado ou já revogado.");

    await tx
      .update(publicWorks)
      .set({ contractId: null, updatedAt: sql`now()` })
      .where(and(eq(publicWorks.id, link.fromId), eq(publicWorks.contractId, link.toId)));
    await audit(tx, userId, "vinculo_manual_revogado", { vinculo: linkId, obra: link.fromId });
    return done("Vínculo manual revogado.");
  });
}

interface FieldSpec {
  column: string;
  label: string;
}

interface CorrectableSpec {
  table: string;
  label: string;
  fields: Record<string, FieldSpec>;
}

/** Campos que aceitam correção manual, com a coluna correspondente no banco. */
export const CORRECTABLE = {
  contract: {
    table: "contracts",
    label: "Contrato",
    fields: {
      description: { column: "description", label: "Objeto" },
      original_value: { column: "original_value", label: "Valor original" },
      current_value: { column: "current_value", label: "Valor atual" },
      signed_at: { column: "signed_at", label: "Data de assinatura" },
      starts_at: { column: "starts_at", label: "Início da vigência" },
      ends_at: { column: "ends_at", label: "Fim da vigência" },
    },
  },
  public_work: {
    table: "public_works",
    label: "Obra",
    fields: {
      title: { column: "title", label: "Título" },
      description: { column: "description", label: "Descrição" },
      initial_value: { column: "initial_value", label: "Valor informado" },
      start_date: { column: "start_date", label: "Início" },
      expected_end_date: { column: "expected_end_date", label: "Prazo original" },
      actual_end_date: { column: "actual_end_date", label: "Conclusão" },
    },
  },
  bid: {
    table: "bids",
    label: "Licitação",
    fields: {
      description: { column: "description", label: "Objeto" },
      estimated_value: { column: "estimated_value", label: "Valor estimado" },
      opening_date: { column: "opening_date", label: "Data de abertura" },
    },
  },
} satisfies Record<string, CorrectableSpec>;

export type CorrectableType = keyof typeof CORRECTABLE;

const specOf = (type: CorrectableType): CorrectableSpec => CORRECTABLE[type];

/** Nome legível de um campo corrigido; devolve a própria chave se não for conhecido. */
export function correctedFieldLabel(type: string, field: string): string {
  if (!(type in CORRECTABLE)) return field;
  return specOf(type as CorrectableType).fields[field]?.label ?? field;
}

/**
 * Grava o texto como string JSON. Sem isso, um valor como "1500.00" seria lido
 * pelo banco como número e perderia a forma em que a fonte o publicou.
 */
const asJsonText = (text: string) => sql<string>`to_jsonb(${text}::text)`;

const overrideInput = z.object({
  entityType: z.enum(["contract", "public_work", "bid"]),
  entity: z.string().regex(UUID_IN_TEXT, "Cole o endereço da página do registro no portal."),
  field: z.string().min(1),
  correctedValue: z.string().trim().min(1, "Informe o valor corrigido.").max(4000),
  justification,
});

/**
 * Registra uma correção manual. O dado oficial não é alterado: a correção guarda
 * o valor original lido no momento, o valor corrigido, a justificativa e o autor,
 * e é exibida ao lado do dado oficial na página pública.
 */
export async function createOverride(
  db: Database,
  userId: string,
  raw: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = overrideInput.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const input = parsed.data;

  const spec = specOf(input.entityType);
  const field = spec.fields[input.field];
  if (!field) return fail("Este campo não aceita correção manual.");
  const entityId = UUID_IN_TEXT.exec(input.entity)?.[0] ?? "";

  const rows = (await db.execute(sql`
    select ${sql.identifier(field.column)} as value
      from ${sql.identifier(spec.table)}
     where id = ${entityId}
  `)) as unknown as Array<{ value: unknown }>;
  const current = rows[0];
  if (!current) return fail(`${spec.label} não encontrado(a) no portal.`);

  const original = current.value === null || current.value === undefined ? null : String(current.value);

  return db.transaction(async (tx) => {
    await tx.insert(manualOverrides).values({
      entityType: input.entityType,
      entityId,
      field: input.field,
      originalValue: original === null ? null : asJsonText(original),
      correctedValue: asJsonText(input.correctedValue),
      justification: input.justification,
      userId,
    });
    await audit(tx, userId, "correcao_manual_criada", {
      tipo: input.entityType,
      registro: entityId,
      campo: input.field,
      original,
      corrigido: input.correctedValue,
      justificativa: input.justification,
    });
    return done(`Correção registrada no campo “${field.label}”. O dado oficial foi mantido.`);
  });
}

export async function revokeOverride(
  db: Database,
  userId: string,
  overrideId: string,
): Promise<ActionResult> {
  if (!UUID_IN_TEXT.test(overrideId)) return fail("Correção inválida.");

  return db.transaction(async (tx) => {
    const [revoked] = await tx
      .update(manualOverrides)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(manualOverrides.id, overrideId), isNull(manualOverrides.revokedAt)))
      .returning({ id: manualOverrides.id });
    if (!revoked) return fail("Correção não encontrada ou já revogada.");

    await audit(tx, userId, "correcao_manual_revogada", { correcao: overrideId });
    return done("Correção revogada.");
  });
}

/** Coloca um pedido de coleta na fila do worker. Não repete pedido igual ainda em aberto. */
export async function requestCollection(
  db: Database,
  userId: string,
  job: string,
): Promise<ActionResult> {
  if (!(COLLECTION_JOBS as readonly string[]).includes(job)) return fail("Coleta desconhecida.");
  const collectionJob = job as CollectionJob;

  const [open] = await db
    .select({ id: collectionRequests.id })
    .from(collectionRequests)
    .where(
      and(
        eq(collectionRequests.job, collectionJob),
        inArray(collectionRequests.status, ["pending", "running"]),
      ),
    )
    .limit(1);
  if (open) return fail("Já existe um pedido igual aguardando ou em execução.");

  await db.insert(collectionRequests).values({ job: collectionJob, requestedBy: userId });
  await audit(db, userId, "coleta_solicitada", { coleta: collectionJob });
  return done("Pedido de coleta registrado. O worker o executa em até um minuto.");
}
