import Link from "next/link";

import { formatMoney } from "@/lib/format";
import type { SplitPart } from "@/lib/insights";

/** Tons do azul da marca, do mais forte ao mais claro; o grupo "demais" usa a cor de linha. */
const TONES = [
  "var(--color-azul)",
  "color-mix(in srgb, var(--color-azul) 68%, var(--color-fundo))",
  "color-mix(in srgb, var(--color-azul) 44%, var(--color-fundo))",
  "color-mix(in srgb, var(--color-azul) 26%, var(--color-fundo))",
];
const REST_TONE = "var(--color-linha)";

const toneOf = (part: SplitPart, index: number): string =>
  part.sourceKey === null ? REST_TONE : (TONES[index] ?? REST_TONE);

const reais = (share: number): string =>
  `R$ ${share.toLocaleString("pt-BR", { maximumFractionDigits: share < 10 ? 1 : 0 })}`;

/**
 * "De cada R$ 100": uma barra única dividida pela participação de cada parte,
 * com a legenda logo abaixo. Cada linha leva aos registros que a compõem.
 */
export function HundredBar({
  parts,
  hrefFor,
}: {
  parts: SplitPart[];
  hrefFor: (part: SplitPart) => string | null;
}) {
  return (
    <div data-grow-group>
      <div className="flex h-14 overflow-hidden rounded-xl sm:h-16" aria-hidden="true">
        {parts.map((part, index) => (
          <div
            key={part.key}
            data-grow="x"
            style={{ width: `${part.share}%`, background: toneOf(part, index) }}
          />
        ))}
      </div>
      <ol className="mt-5 grid gap-x-10 sm:grid-cols-2">
        {parts.map((part, index) => {
          const href = hrefFor(part);
          return (
            <li key={part.key} className="flex items-center gap-3 border-b border-linha py-3">
              <span
                className="size-4 flex-none rounded-sm"
                style={{ background: toneOf(part, index) }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 leading-snug">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {part.label}
                  </Link>
                ) : (
                  part.label
                )}
              </span>
              <span className="valor text-xl">{reais(part.share)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export interface FlowStep {
  label: string;
  explanation: string;
  total: string;
  href: string;
}

/** Empenhado, liquidado e pago: cada barra é proporcional ao valor empenhado. */
export function MoneyFlow({ steps }: { steps: FlowStep[] }) {
  const max = Math.max(...steps.map((step) => Number(step.total)), 1);

  return (
    <ol data-grow-group className="grid gap-6">
      {steps.map((step) => (
        <li key={step.label}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6">
            <h3 className="text-lg font-semibold">
              <Link href={step.href} className="hover:underline">
                {step.label}
              </Link>
            </h3>
            <p className="valor text-xl sm:text-2xl">{formatMoney(step.total)}</p>
          </div>
          <div
            data-grow="x"
            className="mt-2 h-3 rounded-full bg-azul"
            style={{ width: `${Math.max((Number(step.total) / max) * 100, 1)}%` }}
            aria-hidden="true"
          />
          <p className="mt-2 max-w-prose text-suave">{step.explanation}</p>
        </li>
      ))}
    </ol>
  );
}

export interface MonthColumn {
  month: number;
  label: string;
  total: string;
  href: string;
}

/** Pagamentos mês a mês. O mês de maior valor fica em azul cheio; os demais, mais claros. */
export function MonthColumns({ columns }: { columns: MonthColumn[] }) {
  const max = Math.max(...columns.map((column) => Number(column.total)), 1);

  return (
    <ol data-grow-group className="flex h-44 items-end gap-1.5 sm:h-56 sm:gap-3">
      {columns.map((column) => {
        const isPeak = Number(column.total) === max;
        return (
          <li key={column.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <Link
              href={column.href}
              aria-label={`${column.label}: ${formatMoney(column.total)}`}
              className="flex h-full flex-col justify-end"
            >
              <span
                data-grow="y"
                className="block rounded-t-md"
                style={{
                  height: `${Math.max((Number(column.total) / max) * 100, 2)}%`,
                  background: isPeak ? TONES[0] : TONES[2],
                }}
              />
              <span className="mt-2 block text-center text-sm text-suave" aria-hidden="true">
                {column.label.slice(0, 3)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
