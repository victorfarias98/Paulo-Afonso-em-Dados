"use server";

import type { Database } from "@pad/database/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  type ActionResult,
  createOverride,
  ensureAdminUser,
  linkWorkToContract,
  requestCollection,
  revokeManualLink,
  revokeOverride,
} from "@/lib/admin-actions";
import { authenticatedAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

type Handler = (db: Database, userId: string) => Promise<ActionResult>;

const text = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * Confere de novo quem está pedindo, executa a ação e volta ao painel com o
 * resultado. Uma falha inesperada vira mensagem, sem expor o erro interno.
 */
async function run(handler: Handler): Promise<never> {
  const login = authenticatedAdmin((await headers()).get("authorization"), process.env);
  if (!login) redirect(`/admin?erro=${encodeURIComponent("Sessão não autorizada.")}`);

  let result: ActionResult;
  try {
    const db = getDb();
    result = await handler(db, await ensureAdminUser(db, login));
  } catch (error) {
    process.stderr.write(
      `Ação do admin falhou: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    result = { ok: false, message: "A ação falhou por um erro interno. Veja o log do servidor." };
  }

  revalidatePath("/admin");
  redirect(`/admin?${result.ok ? "ok" : "erro"}=${encodeURIComponent(result.message)}`);
}

export async function linkWorkAction(form: FormData): Promise<void> {
  await run((db, userId) =>
    linkWorkToContract(db, userId, {
      workId: text(form, "workId"),
      contract: text(form, "contract"),
      justification: text(form, "justification"),
    }),
  );
}

export async function revokeLinkAction(form: FormData): Promise<void> {
  await run((db, userId) => revokeManualLink(db, userId, text(form, "linkId")));
}

export async function createOverrideAction(form: FormData): Promise<void> {
  // O campo chega como "tipo:campo", de uma única lista de opções.
  const [entityType = "", field = ""] = text(form, "target").split(":");
  await run((db, userId) =>
    createOverride(db, userId, {
      entityType,
      field,
      entity: text(form, "entity"),
      correctedValue: text(form, "correctedValue"),
      justification: text(form, "justification"),
    }),
  );
}

export async function revokeOverrideAction(form: FormData): Promise<void> {
  await run((db, userId) => revokeOverride(db, userId, text(form, "overrideId")));
}

export async function requestCollectionAction(form: FormData): Promise<void> {
  await run((db, userId) => requestCollection(db, userId, text(form, "job")));
}
