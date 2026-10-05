import type { Metadata } from "next";
import Link from "next/link";

import legislativeData from "@/data/legislative-snapshot.json";
import { formatDate } from "@/lib/format";
import { findPoliticalStory } from "@/lib/news";
import { parseLegislativeSnapshot } from "@/lib/legislative";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const story = findPoliticalStory(
    parseLegislativeSnapshot(legislativeData),
    Number((await params).id),
  );
  return { title: story?.name ?? "Político" };
}

export default async function PoliticalStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const story = findPoliticalStory(
    parseLegislativeSnapshot(legislativeData),
    Number((await params).id),
  );
  if (!story)
    return (
      <>
        <h1 className="font-display text-4xl font-medium">História não encontrada</h1>
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
      <p className="mt-10 text-sm text-suave">
        História legislativa · ano {story.recentProjects[0]?.date.slice(0, 4) ?? "atual"}
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl font-medium tracking-tight sm:text-5xl">
        {story.name}
      </h1>
      <p className="mt-4 max-w-prose text-lg text-suave">
        {story.projectsCount} projetos e {story.totalCount} matérias encontradas no recorte público
        disponível.
      </p>
      <section aria-labelledby="projetos" className="mt-12">
        <h2 id="projetos" className="font-display text-2xl font-semibold">
          Projetos recentes
        </h2>
        {story.recentProjects.length === 0 ? (
          <p className="mt-4 text-suave">Não há projetos recentes registrados neste recorte.</p>
        ) : (
          <ul className="mt-3 divide-y divide-linha">
            {story.recentProjects.map((project) => (
              <li key={project.id} className="py-4">
                <a href={project.url} target="_blank" rel="noreferrer" className="group block">
                  <p className="text-sm text-suave">
                    {project.type} {project.number} · {formatDate(project.date)}
                  </p>
                  <h3 className="mt-1 text-lg font-medium group-hover:underline">
                    {project.title}
                  </h3>
                  <span className="mt-2 inline-block text-sm text-azul">
                    Ver na fonte oficial →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
