import {
  ArrowRightIcon,
  BankIcon,
  BooksIcon,
  HandCoinsIcon,
  HardHatIcon,
  MagnifyingGlassIcon,
  ReceiptIcon,
  ScrollIcon,
  ShoppingCartIcon,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { HundredBar, MoneyFlow, MonthColumns } from "@/components/charts";
import { Explica } from "@/components/explica";
import { LegislativeAuthors } from "@/components/legislative-authors";
import legislativeData from "@/data/legislative-snapshot.json";
import { buildLegislativeSummary, parseLegislativeSnapshot } from "@/lib/legislative";
import { HomeScroll } from "@/components/home-scroll";
import { StoryReel, type StorySlide } from "@/components/story-reel";
import { MONTH_NAMES } from "@/lib/expense-filters";
import { getPaidTotal, getSpendingOverview } from "@/lib/expenses";
import { formatDate, formatMoney, formatMoneySpoken } from "@/lib/format";
import {
  elapsedShare,
  ENDING_SOON_DAYS,
  type FeaturedWork,
  getFeaturedWork,
  getHomeFacts,
  listRecentPayments,
  percentOf,
  perResident,
  POPULATION_SOURCE,
  type RecentPayment,
  splitOfHundred,
} from "@/lib/insights";
import { getHomeNumbers } from "@/lib/overview";
import { listNews } from "@/lib/news";
import { plainModality, plainName } from "@/lib/plain";

/** Os números vêm do banco a cada visita; a página não é gerada no build. */
export const dynamic = "force-dynamic";

const TOP_ROWS = 5;
const TOP_AGENCIES = 4;
const TIME_ZONE = "America/Bahia";

const todayInBahia = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

/** "R$ 421,2 milhões" separado em número (para a contagem animada) e texto final. */
function spokenCount(total: string): {
  value: number;
  decimals: number;
  figure: string;
  unit: string;
} {
  const [figure = "0", ...unit] = formatMoneySpoken(total)
    .replace(/^R\$\s/, "")
    .split(" ");
  return {
    value: Number(figure.replace(/\./g, "").replace(",", ".")),
    decimals: figure.includes(",") ? 1 : 0,
    figure,
    unit: unit.join(" "),
  };
}

const percent = (value: number): string =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function Block({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section data-story-section aria-labelledby={id} className="home-section mt-16 sm:mt-24">
      <h2 data-story-reveal id={id} className="max-w-3xl text-2xl font-medium sm:text-4xl">
        {title}
      </h2>
      {lead && <p className="mt-3 max-w-prose text-suave sm:text-lg">{lead}</p>}
      <div className="mt-6 sm:mt-8">{children}</div>
    </section>
  );
}

/** As perguntas que trazem as pessoas ao portal, cada uma levando direto à resposta. */
const QUESTIONS = [
  { icon: HardHatIcon, text: "Tem obra no meu bairro?", href: "/obras" },
  { icon: HandCoinsIcon, text: "Com o que a Prefeitura gasta?", href: "/gastos" },
  { icon: ReceiptIcon, text: "Quem recebe esse dinheiro?", href: "/fornecedores" },
  { icon: ScrollIcon, text: "Que contratos estão valendo?", href: "/contratos?situacao=vigente" },
  { icon: ShoppingCartIcon, text: "O que está sendo comprado?", href: "/licitacoes" },
  { icon: BankIcon, text: "E a Câmara de Vereadores?", href: "/gastos?poder=camara" },
  { icon: BooksIcon, text: "Não entendi uma palavra", href: "/entenda" },
] as const;

function Questions() {
  return (
    <section
      data-story-section
      aria-labelledby="acompanhar"
      className="home-section home-questions mt-12"
    >
      <h2 data-story-reveal id="acompanhar" className="max-w-3xl text-2xl font-medium sm:text-4xl">
        O que você quer acompanhar?
      </h2>
      <nav aria-label="O que você quer saber" className="mt-6">
        <ul className="grid gap-2 sm:grid-cols-2">
          {QUESTIONS.map(({ icon: Icon, text, href }) => (
            <li data-story-reveal key={href}>
              <Link
                href={href}
                className="group flex min-h-16 items-center gap-3 rounded-xl bg-superficie px-4 py-3 text-lg font-medium transition-colors hover:bg-linha"
              >
                <Icon size={26} aria-hidden="true" className="flex-none text-azul" />
                <span className="flex-1 leading-snug">{text}</span>
                <ArrowRightIcon
                  size={20}
                  aria-hidden="true"
                  className="flex-none text-suave transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

/** Uma obra contada do começo ao prazo: onde, quem, quanto e quanto tempo já passou. */
function WorkStory({ work, today }: { work: FeaturedWork; today: string }) {
  const elapsed = elapsedShare(work.startDate, work.expectedEndDate, today);

  return (
    <article data-story-reveal className="home-feature rounded-xl bg-superficie p-5 sm:p-8">
      <h3 className="text-2xl font-medium sm:text-3xl">{plainName(work.title)}</h3>
      <p className="mt-2 text-suave sm:text-lg">
        {work.neighborhood ? `Em ${plainName(work.neighborhood)}. ` : ""}
        {work.supplierName ? `Feita por ${plainName(work.supplierName)}.` : ""}
      </p>
      <p className="valor mt-5 text-[clamp(1.25rem,6vw,3rem)]">{formatMoney(work.initialValue)}</p>

      {elapsed !== null && (
        <div data-grow-group className="mt-6">
          <p className="font-medium">Já passou {elapsed}% do prazo combinado no início.</p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-fundo" aria-hidden="true">
            <div
              data-grow="x"
              className="h-full rounded-full bg-azul"
              style={{ width: `${elapsed}%` }}
            />
          </div>
          <p className="mt-2 flex justify-between gap-4 text-sm text-suave">
            <span>Começou em {formatDate(work.startDate)}</span>
            <span className="text-right">Prazo: {formatDate(work.expectedEndDate)}</span>
          </p>
        </div>
      )}
      <p className="mt-4">
        <Link
          href={`/obras/${work.id}`}
          className="link inline-flex min-h-11 items-center font-medium"
        >
          Ver tudo sobre esta obra
        </Link>
      </p>
    </article>
  );
}

function RecentPayments({ payments }: { payments: RecentPayment[] }) {
  return (
    <ul>
      {payments.map((payment) => (
        <li key={payment.id} className="border-t border-linha py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-lg font-medium">
              {payment.recipient ? plainName(payment.recipient) : "Recebedor não informado"}
            </p>
            <p className="valor text-xl">{formatMoney(payment.value)}</p>
          </div>
          {payment.description && (
            <p className="mt-1 line-clamp-2 max-w-prose">{payment.description}</p>
          )}
          <p className="mt-1 text-sm text-suave">
            {formatDate(payment.date)}
            {payment.agencyName ? `, pago pela ${plainName(payment.agencyName)}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

interface Fact {
  key: string;
  figure: string;
  text: string;
  note?: string;
  href: string;
}

/** Um fato por linha: o número em destaque, a frase que o explica e o caminho até os registros. */
function FactList({ facts }: { facts: Fact[] }) {
  return (
    <ul className="grid gap-x-12 md:grid-cols-2">
      {facts.map((fact) => (
        <li data-story-reveal key={fact.key} className="border-t border-linha">
          <Link href={fact.href} className="group flex items-start gap-4 py-5">
            <span className="min-w-0 flex-1">
              <span className="valor block text-3xl sm:text-4xl">{fact.figure}</span>
              <span className="mt-1 block text-lg leading-snug">{fact.text}</span>
              {fact.note && <span className="mt-1 block text-sm text-suave">{fact.note}</span>}
            </span>
            <ArrowRightIcon
              size={22}
              aria-hidden="true"
              className="mt-2 flex-none text-azul transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TopList({
  id,
  title,
  rows,
  moreHref,
  moreLabel,
}: {
  id: string;
  title: string;
  rows: Array<{ key: string; label: string; total: string; href: string }>;
  moreHref: string;
  moreLabel: string;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xl font-medium sm:text-2xl">
        {title}
      </h2>
      <ol className="mt-3">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-linha py-3"
          >
            <Link href={row.href} className="hover:underline">
              {plainName(row.label)}
            </Link>
            <span className="valor">{formatMoney(row.total)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2">
        <Link href={moreHref} className="link inline-flex min-h-11 items-center">
          {moreLabel}
        </Link>
      </p>
    </section>
  );
}

export default async function HomePage() {
  const legislative = buildLegislativeSummary(parseLegislativeSnapshot(legislativeData));
  const [numbers, recentNews] = await Promise.all([
    getHomeNumbers(),
    listNews({ days: 7, limit: 5 }),
  ]);
  const year = numbers.latestExpenseYear;
  // Prefeitura e Câmara têm orçamentos separados: os totais nunca são somados.
  const today = todayInBahia();
  const [spending, councilPaid, facts, featuredWork, recentPayments] =
    year === null
      ? [null, null, null, null, []]
      : await Promise.all([
          getSpendingOverview(year, "prefeitura"),
          getPaidTotal(year, "camara"),
          getHomeFacts(year, today),
          getFeaturedWork(),
          listRecentPayments(),
        ]);
  const paidInYear = `/gastos/registros?fase=pagamento&poder=prefeitura&ano=${year}`;
  const hasSpending = spending !== null && Number(spending.paid.total) > 0;
  const paidSpoken = spokenCount(spending?.paid.total ?? "0");
  const storyTones = ["blue", "aqua", "navy", "sand"] as const;
  const homeStories: StorySlide[] = [
    ...recentNews.slice(0, 3).map((item, index) => ({
      id: `news-${item.id}`,
      eyebrow: "Dados atualizados",
      title: item.title,
      summary: `A fonte publicou novos dados em ${formatDate(item.date)}: ${item.created} registros entraram e ${item.updated} foram alterados.`,
      metric: String(item.created + item.updated),
      metricLabel: "registros novos ou alterados",
      icon: "update" as const,
      href: item.href,
      sourceLabel: item.sourceName,
      sourceHref: "/fontes",
      tone: storyTones[index % storyTones.length] ?? "blue",
    })),
    ...[...legislative.members]
      .sort((left, right) => right.totalCount - left.totalCount)
      .slice(0, 5)
      .map((member, index) => ({
        id: `politician-${member.id}`,
        eyebrow: "Atuação na Câmara",
        title: member.name,
        summary: `A Câmara registra ${member.requestsCount} requerimentos e ${member.totalCount} matérias no nome deste parlamentar em ${legislative.year}.`,
        metric: String(member.projectsCount),
        metricLabel: `projetos apresentados em ${legislative.year}`,
        image: `/people/vereador-${member.id}.png`,
        imageAlt: `Foto oficial de ${member.name}`,
        href: `/novidades/politico/${member.id}`,
        sourceLabel: "SAPL da Câmara",
        sourceHref: "/fontes",
        tone: storyTones[(index + 1) % storyTones.length] ?? "navy",
      })),
  ];

  const agencyParts = spending
    ? splitOfHundred(
        spending.byAgency.map((row) => ({
          key: row.id,
          label: plainName(row.name),
          total: row.total,
        })),
        TOP_AGENCIES,
        "Outras secretarias e órgãos",
      )
    : [];
  const paidOfCommitted = spending
    ? percentOf(spending.paid.total, spending.committed.total)
    : null;
  const payrollShare = spending && facts ? percentOf(facts.payrollPaid, spending.paid.total) : null;
  const peak = spending?.byMonth.reduce(
    (best, row) => (Number(row.total) > Number(best.total) ? row : best),
    spending.byMonth[0] ?? { month: 0, total: "0" },
  );

  const factRows: Fact[] = [];
  if (facts && year !== null) {
    if (facts.worksOpen > 0) {
      factRows.push({
        key: "obras-prazo",
        figure: `${facts.worksPastOriginalDeadline} de ${facts.worksOpen}`,
        text: "obras em andamento já passaram do prazo combinado no início.",
        note: "O prazo pode ter mudado. Essa informação não aparece junto da obra na fonte consultada.",
        href: "/obras?situacao=prazo_vencido",
      });
      factRows.push({
        key: "obras-valor",
        figure: formatMoneySpoken(facts.worksOpenValue),
        text: `é quanto custam, somadas, as ${facts.worksOpen} obras em andamento.`,
        href: "/obras?ordem=maior_valor",
      });
    }
    if (payrollShare !== null && payrollShare > 0) {
      factRows.push({
        key: "folha",
        figure: percent(payrollShare),
        text: `do que a Prefeitura pagou em ${year} foi para os salários dos servidores.`,
        href: `${paidInYear}&q=${encodeURIComponent("FOLHA DE PAGAMENTO")}`,
      });
    }
    factRows.push({
      key: "contratos-fim",
      figure: facts.contractsEndingSoon.toLocaleString("pt-BR"),
      text: `contratos em vigor terminam nos próximos ${ENDING_SOON_DAYS} dias.`,
      note: `Entre os ${numbers.importedContracts.toLocaleString("pt-BR")} contratos disponíveis neste portal.`,
      href: "/contratos?situacao=vigente&ordem=vencimento",
    });
    if (facts.topModality && facts.bidsInYear > 0) {
      factRows.push({
        key: "modalidade",
        figure: `${facts.topModalityCount} de ${facts.bidsInYear}`,
        text: `licitações de ${year} foram do tipo “${plainModality(facts.topModality)}”, o mais usado no ano.`,
        href: `/licitacoes?ano=${year}&modalidade=${encodeURIComponent(facts.topModality)}`,
      });
    }
    if (councilPaid && councilPaid.count > 0) {
      factRows.push({
        key: "camara",
        figure: formatMoneySpoken(councilPaid.total),
        text: `foi quanto a Câmara Municipal pagou em ${year}, em ${councilPaid.count.toLocaleString("pt-BR")} pagamentos.`,
        href: "/gastos?poder=camara",
      });
    }
  }

  return (
    <HomeScroll>
      <section aria-label="Resumo do dinheiro público" className="home-hero">
        <div className="home-hero-copy min-w-0">
          <p data-hero-reveal className="home-hero-kicker">
            Dados públicos, do jeito que a cidade entende
          </p>
          <h1 data-hero-reveal>
            Veja para onde vai o dinheiro de <span>Paulo Afonso.</span>
          </h1>
          <p data-hero-reveal className="home-hero-lead">
            Pesquise obras, gastos, contratos e a atuação de quem você elegeu. Cada número leva até
            a fonte oficial.
          </p>
          <div data-hero-reveal className="home-hero-actions">
            <Link href="#fatos" className="botao home-hero-primary">
              Explorar os dados <ArrowRightIcon size={20} aria-hidden="true" />
            </Link>
            <Link href="/novidades" className="home-hero-secondary">
              Ver o que mudou hoje
            </Link>
          </div>
          <ul data-hero-reveal className="home-hero-trust" aria-label="Compromissos do portal">
            <li>Fonte em cada dado</li>
            <li>Acesso livre</li>
            <li>Linguagem simples</li>
          </ul>
          {hasSpending && spending && year !== null ? (
            <div data-hero-reveal className="home-hero-proof">
              <span>Pagamentos encontrados em {year}</span>
              <strong className="valor">
                R$ {paidSpoken.figure} {paidSpoken.unit}
              </strong>
              <small>
                Cerca de R$ {perResident(spending.paid.total).toLocaleString("pt-BR")} por morador ,
                usando {POPULATION_SOURCE}
              </small>
            </div>
          ) : (
            <div data-hero-reveal className="home-hero-proof">
              <span>Informação para acompanhar a cidade</span>
              <strong>Obras, contratos e gastos</strong>
              <small>Dados organizados com link para a fonte oficial</small>
            </div>
          )}
        </div>
        <div data-hero-reveal data-city-parallax className="home-city-illustration">
          <Image
            src="/illustrations/civic-city.webp"
            alt=""
            width={960}
            height={640}
            sizes="(max-width: 767px) 100vw, 38vw"
            preload
            className="home-city-image"
          />
          <div className="home-city-caption">
            <span>Feito para quem vive a cidade</span>
            <strong>Entenda. Compare. Acompanhe.</strong>
          </div>
        </div>
      </section>

      <form
        method="get"
        action="/busca"
        role="search"
        className="mt-7 flex max-w-2xl flex-col items-stretch gap-2 sm:flex-row sm:items-end"
      >
        <label className="relative block min-w-0 flex-1">
          <span className="mb-2 block text-sm font-medium">
            Procure uma obra, empresa ou contrato
          </span>
          <MagnifyingGlassIcon
            size={20}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3.5 left-3.5 text-suave"
          />
          <input
            type="search"
            name="q"
            minLength={3}
            maxLength={100}
            placeholder="Procure uma obra, empresa ou contrato"
            enterKeyHint="search"
            className="campo pl-11 placeholder:text-suave"
          />
        </label>
        <button type="submit" className="botao w-full px-5 sm:w-auto">
          Buscar
        </button>
      </form>

      <StoryReel stories={homeStories} />

      {factRows.length > 0 && (
        <Block
          id="fatos"
          title="O que os números mostram hoje"
          lead="Prazos, valores e registros para acompanhar de perto."
        >
          <FactList facts={factRows} />
        </Block>
      )}

      <Block
        id="autores"
        title={`O que os vereadores apresentaram em ${legislative.year}`}
        lead="Encontre quem você elegeu. Veja projetos, pedidos e os registros que ainda não aparecem."
      >
        <LegislativeAuthors summary={legislative} />
      </Block>

      <Questions />

      {featuredWork && (
        <Block id="obra" title="A maior obra em andamento na cidade">
          <WorkStory work={featuredWork} today={today} />
        </Block>
      )}

      {hasSpending && spending && year !== null && (
        <>
          <Block
            id="cem"
            title={`De cada R$ 100 que a Prefeitura pagou em ${year}`}
            lead="Para onde foi o dinheiro, secretaria por secretaria."
          >
            <HundredBar
              parts={agencyParts}
              hrefFor={(part) =>
                part.sourceKey ? `${paidInYear}&orgao=${part.sourceKey}` : "/gastos#por-orgao"
              }
            />
          </Block>

          <Block
            id="caminho"
            title="Como o dinheiro chega ao pagamento"
            lead={
              paidOfCommitted === null
                ? undefined
                : `Até agora, ${percent(paidOfCommitted)} do valor que a Prefeitura reservou em ${year} já foi pago.`
            }
          >
            <MoneyFlow
              steps={[
                {
                  label: "Reservado",
                  explanation:
                    "A Prefeitura separou o dinheiro para uma despesa. Isso ainda não significa que houve pagamento.",
                  total: spending.committed.total,
                  href: `/gastos/registros?fase=empenho&poder=prefeitura&ano=${year}`,
                },
                {
                  label: "Entrega conferida",
                  explanation: "Alguém conferiu que o serviço foi feito ou o produto chegou.",
                  total: spending.liquidated.total,
                  href: `/gastos/registros?fase=liquidacao&poder=prefeitura&ano=${year}`,
                },
                {
                  label: "Pago",
                  explanation: "O dinheiro saiu da conta e chegou a quem tinha a receber.",
                  total: spending.paid.total,
                  href: paidInYear,
                },
              ]}
            />
            <Explica termo="empenho" rotulo="Por que os três valores são diferentes?" />
          </Block>

          <details className="home-details mt-10 rounded-xl border border-linha p-5 sm:p-7">
            <summary className="min-h-11 cursor-pointer text-lg font-medium">
              Ver os gastos mês a mês
            </summary>
            <Block
              id="meses"
              title="Pagamentos mês a mês"
              lead={
                peak && peak.month > 0
                  ? `O mês de maior pagamento foi ${MONTH_NAMES[peak.month - 1]?.toLowerCase()}: ${formatMoney(peak.total)}.`
                  : undefined
              }
            >
              <MonthColumns
                columns={spending.byMonth.map((row) => ({
                  month: row.month,
                  label: MONTH_NAMES[row.month - 1] ?? String(row.month),
                  total: row.total,
                  href: `${paidInYear}&mes=${row.month}`,
                }))}
              />
              <p className="mt-4">
                <Link href="/gastos" className="link inline-flex min-h-11 items-center">
                  Ver todos os gastos da Prefeitura e da Câmara
                </Link>
              </p>
            </Block>
          </details>
        </>
      )}

      <Block id="mandato" title="Como acompanhar quem você elegeu">
        <div className="rounded-xl border border-linha p-5 sm:p-7">
          <p className="max-w-prose text-lg">
            Veja o que foi proposto e acompanhe os gastos e as obras da cidade.
          </p>
          <p className="mt-3 max-w-prose text-suave">
            O SAPL da Câmara permite pesquisar matérias por autor e situação, incluindo propostas
            aprovadas. A seção de autores acima mostra as propostas apresentadas. Aprovação de uma
            proposta e pagamento de uma despesa não comprovam a entrega de uma obra.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <a
              href="https://sapl.pauloafonso.ba.leg.br/materia/pesquisar-materia"
              className="botao"
            >
              Consultar propostas
            </a>
            <Link
              href="/gastos?poder=camara"
              className="link inline-flex min-h-11 items-center font-medium"
            >
              Acompanhar a Câmara
            </Link>
            <Link href="/fontes" className="link inline-flex min-h-11 items-center">
              Conferir fontes e cobertura
            </Link>
          </div>
        </div>
      </Block>

      {recentPayments.length > 0 && (
        <Block
          id="recentes"
          title="Os pagamentos mais recentes"
          lead="Os maiores pagamentos a empresas no último dia registrado. Salários ficam de fora desta lista."
        >
          <RecentPayments payments={recentPayments} />
          <p className="mt-2 border-t border-linha pt-2">
            <Link href={paidInYear} className="link inline-flex min-h-11 items-center">
              Ver todos os pagamentos do ano
            </Link>
          </p>
        </Block>
      )}

      {spending && year !== null && (
        <details className="home-details mt-12 rounded-xl border border-linha p-5 sm:p-7">
          <summary className="min-h-11 cursor-pointer text-lg font-medium">
            Ver quem mais recebeu e pagou
          </summary>
          <div className="mt-6 grid gap-12 lg:grid-cols-2">
            <TopList
              id="orgaos"
              title="Secretarias que mais pagaram"
              rows={spending.byAgency.slice(0, TOP_ROWS).map((row) => ({
                key: row.id,
                label: row.name,
                total: row.total,
                href: `${paidInYear}&orgao=${row.id}`,
              }))}
              moreHref="/gastos#por-orgao"
              moreLabel="Ver todas as secretarias"
            />
            <TopList
              id="empresas"
              title="Quem mais recebeu da Prefeitura"
              rows={spending.topSuppliers.slice(0, TOP_ROWS).map((row) => ({
                key: row.id,
                label: row.name,
                total: row.total,
                href: `/fornecedores/${row.id}`,
              }))}
              moreHref="/fornecedores"
              moreLabel="Ver todos que receberam"
            />
          </div>
        </details>
      )}

      <Block
        id="novidades"
        title="O que mudou por aqui"
        lead="Atualizações recentes nos dados públicos, sempre ligadas à fonte oficial."
      >
        {recentNews.length === 0 ? (
          <p className="rounded-xl bg-superficie p-5 text-suave">
            Nenhuma novidade registrada nos últimos sete dias.
          </p>
        ) : (
          <ol className="divide-y divide-linha rounded-xl bg-superficie px-5">
            {recentNews.map((item) => (
              <li key={item.id} className="py-4">
                <Link href={item.href} className="group block">
                  <p className="text-sm text-suave">
                    {item.date} · {item.sourceName}
                  </p>
                  <h3 className="mt-1 text-lg font-medium group-hover:underline">{item.title}</h3>
                  <p className="mt-1 text-sm text-suave">
                    {item.created + item.updated} registros novos ou alterados.
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        )}
        <Link href="/novidades" className="link mt-4 inline-flex min-h-11 items-center">
          Ver todas as novidades e histórias →
        </Link>
      </Block>

      <Block
        id="participar"
        title="A cidade também é sua"
        lead="Escolha uma pergunta, confira a fonte e leve os registros para cobrar uma resposta."
      >
        <div className="home-citizen-actions grid gap-4 md:grid-cols-3">
          <Link
            data-story-reveal
            href="/obras"
            className="rounded-xl border border-linha p-5 hover:bg-superficie"
          >
            <HardHatIcon size={28} aria-hidden="true" className="text-azul" />
            <h3 className="mt-4 text-xl font-medium">Acompanhe uma obra</h3>
            <p className="mt-2 text-suave">Veja o bairro, o valor e o prazo informado.</p>
            <span className="link mt-4 inline-flex min-h-11 items-center">Encontrar uma obra</span>
          </Link>
          <Link
            data-story-reveal
            href="/contratos?situacao=vigente"
            className="rounded-xl border border-linha p-5 hover:bg-superficie"
          >
            <ScrollIcon size={28} aria-hidden="true" className="text-azul" />
            <h3 className="mt-4 text-xl font-medium">Confira um contrato</h3>
            <p className="mt-2 text-suave">Saiba quem foi contratado e por quanto tempo.</p>
            <span className="link mt-4 inline-flex min-h-11 items-center">Consultar contratos</span>
          </Link>
          <Link
            data-story-reveal
            href="/fontes"
            className="rounded-xl border border-linha p-5 hover:bg-superficie"
          >
            <BooksIcon size={28} aria-hidden="true" className="text-azul" />
            <h3 className="mt-4 text-xl font-medium">Vá até a fonte</h3>
            <p className="mt-2 text-suave">Confira de onde vêm os dados e o que ainda falta.</p>
            <span className="link mt-4 inline-flex min-h-11 items-center">Conferir fontes</span>
          </Link>
        </div>
      </Block>

      <p className="mt-14 max-w-prose text-suave">
        “Folha de pagamento” são os salários dos servidores: a Prefeitura registra os de cada
        secretaria como um único recebedor. Cada número desta página leva à lista que o compõe, e
        cada item mostra a página oficial de onde veio.{" "}
        <Link href="/fontes" className="link">
          Veja as fontes e quando foram consultadas
        </Link>
        .
      </p>
    </HomeScroll>
  );
}
