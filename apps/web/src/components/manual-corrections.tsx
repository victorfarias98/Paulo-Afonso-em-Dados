import type { EntityType } from "@pad/database/schema";

import { correctedFieldLabel } from "@/lib/admin-actions";
import { listCorrections } from "@/lib/corrections";

interface ManualCorrectionsProps {
  entityType: EntityType;
  entityId: string;
}

/**
 * Correções feitas pela equipe do portal. O dado oficial continua exibido como a
 * fonte o publica; a correção aparece aqui, com o motivo e a data.
 */
export async function ManualCorrections({ entityType, entityId }: ManualCorrectionsProps) {
  const corrections = await listCorrections(entityType, entityId);
  if (corrections.length === 0) return null;

  return (
    <section
      aria-labelledby="correcoes"
      className="mt-10 max-w-4xl border-l-4 border-azul bg-superficie px-5 py-4"
    >
      <h2 id="correcoes" className="font-display text-xl font-semibold">
        Correções feitas pelo portal
      </h2>
      <p className="mt-1 max-w-prose text-sm text-suave">
        O valor publicado pela fonte oficial foi mantido acima. Abaixo está o que a equipe do
        portal considera correto, e por quê.
      </p>
      <ul className="mt-4 space-y-4">
        {corrections.map((correction) => (
          <li key={correction.id}>
            <p className="font-medium">{correctedFieldLabel(entityType, correction.field)}</p>
            <p>
              Na fonte: <span className="line-through">{correction.original ?? "sem valor"}</span>
            </p>
            <p>
              Correto, segundo o portal: <strong>{correction.corrected}</strong>
            </p>
            <p className="mt-1 text-sm text-suave">
              Motivo: {correction.justification} Registrada em {correction.createdAt}.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
