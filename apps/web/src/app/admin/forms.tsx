import type { ReactNode } from "react";

import { CORRECTABLE } from "@/lib/admin-actions";

import {
  createOverrideAction,
  linkWorkAction,
  requestCollectionAction,
  revokeLinkAction,
  revokeOverrideAction,
} from "./actions";

export const JOB_LABELS: Record<string, string> = {
  obras: "Obras",
  licitacoes: "Licitações",
  contratos: "Contratos da Prefeitura (lote diário)",
  camara_contratos: "Contratos da Câmara",
  camara_licitacoes: "Licitações da Câmara",
  despesas: "Despesas da Prefeitura (mês atual e anterior)",
  camara_despesas: "Despesas da Câmara (mês atual e anterior)",
  tudo: "Tudo, na ordem da coleta diária",
};

const SUBMIT = "rounded-full bg-azul px-4 py-2 font-semibold text-fundo hover:bg-azul-forte";
const QUIET = "link cursor-pointer text-sm";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Justification() {
  return (
    <Field label="Motivo (fica registrado e é exibido ao público)">
      <textarea
        name="justification"
        required
        minLength={10}
        maxLength={2000}
        rows={2}
        className="campo"
      />
    </Field>
  );
}

export function CollectionForm() {
  return (
    <form action={requestCollectionAction} className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <Field label="O que coletar">
          <select name="job" className="campo" defaultValue="obras">
            {Object.entries(JOB_LABELS).map(([job, label]) => (
              <option key={job} value={job}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button type="submit" className={SUBMIT}>
        Pedir coleta
      </button>
    </form>
  );
}

export function LinkWorkForm({ workId }: { workId: string }) {
  return (
    <details className="mt-2">
      <summary className={QUIET}>Ligar a um contrato</summary>
      <form action={linkWorkAction} className="mt-3 grid max-w-xl gap-3">
        <input type="hidden" name="workId" value={workId} />
        <Field label="Número do contrato ou endereço da página dele no portal">
          <input name="contract" required maxLength={300} className="campo" />
        </Field>
        <Justification />
        <div>
          <button type="submit" className={SUBMIT}>
            Ligar obra ao contrato
          </button>
        </div>
      </form>
    </details>
  );
}

export function RevokeLinkForm({ linkId }: { linkId: string }) {
  return (
    <form action={revokeLinkAction}>
      <input type="hidden" name="linkId" value={linkId} />
      <button type="submit" className={QUIET}>
        Revogar vínculo
      </button>
    </form>
  );
}

export function OverrideForm() {
  return (
    <form action={createOverrideAction} className="mt-4 grid max-w-xl gap-3">
      <Field label="Endereço da página do registro no portal (contrato, obra ou licitação)">
        <input name="entity" required maxLength={300} className="campo" />
      </Field>
      <Field label="Campo a corrigir">
        <select name="target" required className="campo" defaultValue="">
          <option value="" disabled>
            Escolha
          </option>
          {Object.entries(CORRECTABLE).map(([type, spec]) => (
            <optgroup key={type} label={spec.label}>
              {Object.entries(spec.fields).map(([field, { label }]) => (
                <option key={field} value={`${type}:${field}`}>
                  {label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Valor correto">
        <input name="correctedValue" required maxLength={4000} className="campo" />
      </Field>
      <Justification />
      <div>
        <button type="submit" className={SUBMIT}>
          Registrar correção
        </button>
      </div>
    </form>
  );
}

export function RevokeOverrideForm({ overrideId }: { overrideId: string }) {
  return (
    <form action={revokeOverrideAction}>
      <input type="hidden" name="overrideId" value={overrideId} />
      <button type="submit" className={QUIET}>
        Revogar correção
      </button>
    </form>
  );
}
