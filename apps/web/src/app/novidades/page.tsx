import type { Metadata } from "next";
import Link from "next/link";

import { StoryReel, type StorySlide } from "@/components/story-reel";
import legislativeData from "@/data/legislative-snapshot.json";
import { formatDate } from "@/lib/format";
import { listPoliticalStories, listNews, listOrganizationStories } from "@/lib/news";
import { parseLegislativeSnapshot } from "@/lib/legislative";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Novidades",
  description:
    "Atualizações recentes nos dados públicos de Paulo Afonso, por fonte, órgão e político.",
};

function StoryCard({
  href,
  eyebrow,
  title,
  text,
}: {
  href: string;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl bg-superficie p-5 transition-colors hover:bg-linha"
    >
      <p className="text-sm text-suave">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-medium group-hover:underline">{title}</h3>
      <p className="mt-2 text-sm text-suave">{text}</p>
      <span className="mt-5 inline-flex min-h-10 items-center font-medium text-azul">
        Ver registros →
      </span>
    </Link>
  );
}

export default async function NewsPage() {
  const snapshot = parseLegislativeSnapshot(legislativeData);
  const [news, organizations] = await Promise.all([listNews(), listOrganizationStories()]);
  const politicians = listPoliticalStories(snapshot).slice(0, 12);
  const tones = ["blue", "aqua", "navy", "sand"] as const;
  const stories: StorySlide[] = [
    ...news.slice(0, 5).map((item, index) => ({
      id: `news-${item.id}`,
      eyebrow: "Atualização pública",
      title: item.title,
      summary: `${item.created + item.updated} registros entraram ou mudaram na base em ${formatDate(item.date)}.`,
      metric: String(item.created + item.updated),
      href: item.href,
      sourceLabel: item.sourceName,
      sourceHref: "/fontes",
      tone: tones[index % tones.length] ?? "blue",
    })),
    ...politicians.slice(0, 5).map((person, index) => ({
      id: `politician-${person.id}`,
      eyebrow: "Atuação política",
      title: person.name,
      summary: `${person.projectsCount} projetos e ${person.totalCount} matérias nos dados publicados pela Câmara.`,
      metric: String(person.totalCount),
      href: person.href,
      sourceLabel: "SAPL da Câmara",
      sourceHref: "/fontes",
      tone: tones[(index + 1) % tones.length] ?? "aqua",
    })),
    ...organizations.slice(0, 4).map((organization, index) => ({
      id: `organization-${organization.id}`,
      eyebrow: "Órgão público",
      title: organization.name,
      summary: `${organization.works} obras, ${organization.contracts} contratos e ${organization.bids} licitações associados.`,
      metric: String(organization.works + organization.contracts + organization.bids),
      href: organization.href,
      sourceLabel: "Bases oficiais integradas",
      sourceHref: "/fontes",
      tone: tones[(index + 2) % tones.length] ?? "navy",
    })),
  ];

  return (
    <>
      <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
        Novidades da cidade
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-suave">
        O que mudou nos dados públicos, quem está apresentando projetos e quais órgãos estão
        movimentando recursos. Cada história aponta para a fonte e para os registros que a explicam.
      </p>

      <StoryReel stories={stories} />

      <section aria-labelledby="feed" className="mt-12">
        <div className="flex items-end justify-between gap-4 border-b-2 border-tinta pb-3">
          <div>
            <h2 id="feed" className="font-display text-2xl font-semibold">
              Atualizações recentes
            </h2>
            <p className="mt-1 text-sm text-suave">
              Só aparecem dias com dados novos ou alterados.
            </p>
          </div>
          <Link href="/fontes" className="link text-sm">
            Ver fontes
          </Link>
        </div>
        {news.length === 0 ? (
          <p className="mt-6 text-suave">
            Nenhuma novidade foi registrada nas últimas duas semanas.
          </p>
        ) : (
          <ol className="mt-2 divide-y divide-linha">
            {news.map((item) => (
              <li key={item.id} className="py-5">
                <Link href={item.href} className="group block">
                  <p className="text-sm text-suave">
                    {formatDate(item.date)} · {item.sourceName}
                  </p>
                  <h3 className="mt-1 text-xl font-medium group-hover:underline">{item.title}</h3>
                  <p className="mt-1 text-suave">
                    {item.created + item.updated} registros entraram ou mudaram na base.
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="politicos" className="mt-16">
        <h2 id="politicos" className="font-display text-2xl font-semibold">
          Acompanhe por político
        </h2>
        <p className="mt-2 max-w-prose text-suave">
          Veja os projetos apresentados e a participação registrada na Câmara.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {politicians.map((person) => (
            <StoryCard
              key={person.id}
              href={person.href}
              eyebrow={`${person.projectsCount} projetos · ${person.totalCount} matérias`}
              title={person.name}
              text={
                person.recentProjects[0]?.title ??
                "Ainda não há projeto recente no recorte disponível."
              }
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="orgaos" className="mt-16">
        <h2 id="orgaos" className="font-display text-2xl font-semibold">
          Acompanhe por órgão
        </h2>
        <p className="mt-2 max-w-prose text-suave">
          Uma visão simples dos registros associados a cada órgão.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {organizations.map((organization) => (
            <StoryCard
              key={organization.id}
              href={organization.href}
              eyebrow={organization.branch}
              title={organization.name}
              text={`${organization.works} obras · ${organization.contracts} contratos · ${organization.bids} licitações`}
            />
          ))}
        </div>
        {organizations.length === 0 && (
          <p className="mt-5 text-suave">
            Os órgãos aparecerão assim que houver registros associados.
          </p>
        )}
      </section>
    </>
  );
}
