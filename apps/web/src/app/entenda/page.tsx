import type { Metadata } from "next";
import Link from "next/link";

import { GLOSSARY, type Term } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "Entenda as palavras",
  description:
    "Empenho, licitação, pregão, aditivo: as palavras do dinheiro público de Paulo Afonso explicadas em linguagem simples.",
};

const STEPS = [
  {
    title: "A Prefeitura decide comprar",
    text: "Pode ser merenda, asfalto, remédio ou o conserto de uma escola. Em geral ela abre uma licitação: uma disputa para escolher de quem comprar.",
    href: "/licitacoes",
    link: "Ver as licitações",
  },
  {
    title: "Assina um contrato",
    text: "Com a empresa escolhida, combina o que será entregue, por quanto e até quando.",
    href: "/contratos",
    link: "Ver os contratos",
  },
  {
    title: "Reserva o dinheiro",
    text: "Antes de gastar, separa o valor para aquela despesa. É o que os documentos chamam de empenho.",
    href: "/gastos",
    link: "Ver os gastos",
  },
  {
    title: "Confere a entrega",
    text: "Alguém da Prefeitura verifica se o serviço foi feito ou o produto chegou. É a liquidação.",
    href: "/gastos",
    link: "Ver os gastos",
  },
  {
    title: "Paga",
    text: "Só então o dinheiro sai da conta pública e vai para quem tinha a receber.",
    href: "/gastos/registros?fase=pagamento",
    link: "Ver os pagamentos",
  },
] as const;

export default function UnderstandPage() {
  const terms = Object.entries(GLOSSARY) as Array<[string, Term]>;

  return (
    <>
      <h1 className="max-w-3xl text-[2.5rem] leading-[1.05] font-medium sm:text-6xl">
        O caminho do dinheiro público, sem palavra difícil.
      </h1>
      <p className="mt-5 max-w-prose text-suave sm:text-lg">
        Todo gasto da Prefeitura e da Câmara passa pelas mesmas etapas. Entendendo essas cinco,
        você entende o resto do portal.
      </p>

      <ol className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4 border-t border-linha pt-5">
            <span className="valor grid size-11 flex-none place-items-center rounded-full bg-tinta text-lg text-fundo">
              {index + 1}
            </span>
            <div>
              <h2 className="text-xl font-medium">{step.title}</h2>
              <p className="mt-1 text-suave">{step.text}</p>
              <Link href={step.href} className="link mt-1 inline-flex min-h-11 items-center">
                {step.link}
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="palavras" className="mt-16 sm:mt-24">
        <h2 id="palavras" className="text-2xl font-medium sm:text-4xl">
          As palavras, uma por uma
        </h2>
        <dl className="mt-6 grid gap-x-10 md:grid-cols-2">
          {terms.map(([key, term]) => (
            <div key={key} id={key} className="border-t border-linha py-5">
              <dt className="text-xl font-medium">{term.plain}</dt>
              <dd className="mt-1">
                <p>{term.explanation}</p>
                {term.example && <p className="mt-2 text-suave">{term.example}</p>}
                {term.official !== term.plain && (
                  <p className="mt-2 text-sm text-suave">
                    Nos documentos oficiais: “{term.official}”.
                  </p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
