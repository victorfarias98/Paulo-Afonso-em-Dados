import type { Metadata } from "next";
import Link from "next/link";

import { findOrganizationStory } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const story = await findOrganizationStory((await params).id);
  return { title: story?.name ?? "Órgão" };
}

export default async function OrganizationStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const story = await findOrganizationStory((await params).id);
  if (!story)
    return (
      <>
        <h1 className="font-display text-4xl font-medium">Órgão não encontrado</h1>
        <Link href="/novidades" className="link mt-5 inline-block">
          Voltar às novidades
        </Link>
      </>
    );
  return (
    <>
      <Link href="/novidades" className="link">
        ← Novidades
      </Link>
      <p className="mt-10 text-sm text-suave">História do órgão · {story.branch}</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl font-medium tracking-tight sm:text-5xl">
        {story.name}
      </h1>
      <p className="mt-4 max-w-prose text-lg text-suave">
        {story.works} obras, {story.contracts} contratos e {story.bids} licitações associadas nos
        dados públicos.
      </p>
      <section aria-labelledby="atualizacoes" className="mt-12">
        <h2 id="atualizacoes" className="font-display text-2xl font-semibold">
          Atualizações recentes
        </h2>
        <ul className="mt-3 divide-y divide-linha">
          {story.recentNews.map((item) => (
            <li key={item.id} className="py-4">
              <p className="text-sm text-suave">
                {item.date} · {item.sourceName}
              </p>
              <p className="mt-1 text-lg font-medium">{item.title}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
