import { QuestionIcon } from "@phosphor-icons/react/dist/ssr";

import { GLOSSARY, type Term, type TermKey } from "@/lib/glossary";

/**
 * "O que é isso?" ao lado de uma palavra difícil. Abre a explicação no lugar,
 * com um toque, sem JavaScript e sem tirar a pessoa da página.
 */
export function Explica({ termo, rotulo }: { termo: TermKey; rotulo?: string }) {
  const term: Term = GLOSSARY[termo];

  return (
    <details data-analytics-explanation={termo} className="group mt-2 max-w-prose">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-azul-forte [&::-webkit-details-marker]:hidden">
        <QuestionIcon size={18} weight="bold" aria-hidden="true" />
        <span className="underline decoration-dotted underline-offset-4">
          {rotulo ?? `O que é “${term.plain.toLocaleLowerCase("pt-BR")}”?`}
        </span>
      </summary>
      <div className="rounded-xl bg-superficie px-4 py-3">
        <p>{term.explanation}</p>
        {term.example && <p className="mt-2 text-suave">{term.example}</p>}
        {term.official !== term.plain && (
          <p className="mt-2 text-sm text-suave">
            Nos documentos oficiais aparece como “{term.official}”.
          </p>
        )}
      </div>
    </details>
  );
}
