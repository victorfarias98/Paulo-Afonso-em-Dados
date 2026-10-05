import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import type { RawSearchParams } from "@/lib/contract-filters";
import {
  BRANCHES,
  DEFAULT_BRANCH,
  type ExpenseBranch,
  type ExpenseFilters,
  expenseFiltersToQuery,
  MONTH_NAMES,
  parseBranch,
  parseExpenseFilters,
} from "@/lib/expense-filters";
import { getSpendingOverview, listExpenseYears, type SpendingOverview } from "@/lib/expenses";
import { formatDate, formatMoney } from "@/lib/format";
import { plainName } from "@/lib/plain";
import { buildSpendingSignals } from "@/lib/spending-signals";
import { Explica } from "@/components/explica";

export const metadata: Metadata = {
  title: "Gastos da Prefeitura e da Câmara",
  description:
    "Quanto a Prefeitura e a Câmara de Paulo Afonso empenharam, liquidaram e pagaram no ano, por órgão, mês e fornecedor, com a fonte oficial.",
};

type BreakdownRow = { key: string; label: string; total: string; href: string };

const registros = (filters: Omit<ExpenseFilters, "page">): string =>
  `/gastos/registros${expenseFiltersToQuery({ ...filters, page: 1 })}`;

function Phase({
  title,
  explanation,
  total,
  count,
  href,
}: {
  title: string;
  explanation: string;
  total: string;
  count: number;
  href: string;
}) {
  return (
    <li className="border-t-2 border-tinta pt-4">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-3 text-3xl">
        <span className="valor">{formatMoney(total)}</span>
      </p>
      <p className="mt-3 text-suave">{explanation}</p>
      <p className="mt-3">
        <Link href={href} className="link">
          Ver os {count.toLocaleString("pt-BR")} registros que somam este valor
        </Link>
      </p>
    </li>
  );
}

/** Lista com barras proporcionais ao maior valor; cada linha leva aos registros que a compõem. */
function Breakdown({ rows }: { rows: BreakdownRow[] }) {
  const max = Math.max(...rows.map((row) => Number(row.total)), 1);

  return (
    <ul className="mt-4">
      {rows.map((row) => (
        <li key={row.key} className="border-b border-linha py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <Link href={row.href} className="hover:text-azul hover:underline">
              {plainName(row.label)}
            </Link>
            <span className="font-display font-semibold tabular-nums">
              {formatMoney(row.total)}
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-superficie" aria-hidden="true">
            <div
              className="h-full bg-azul"
              style={{ width: `${(Number(row.total) / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-14">
      <h2 id={id} className="font-display text-2xl font-semibold">
        {title}
      </h2>
      <p className="mt-1 max-w-prose text-suave">{note}</p>
      {children}
    </section>
  );
}

function DataIntelligence({
  year,
  branch,
  data,
}: {
  year: number;
  branch: ExpenseBranch;
  data: SpendingOverview;
}) {
  const paid = { phase: "pagamento" as const, year, branch };
  const { largestPayments, monthlySignal } = data.intelligence;
  const signalMonth =
    monthlySignal && MONTH_NAMES[monthlySignal.month - 1]
      ? MONTH_NAMES[monthlySignal.month - 1]
      : null;

  return (
    <section aria-labelledby="dados-inteligentes" className="mt-14 bg-tinta py-10 text-fundo">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-sm font-semibold tracking-wide text-amarelo uppercase">
          Análise automática, sem IA
        </p>
        <div className="mt-2 grid gap-8 lg:grid-cols-[0.9fr_1.4fr] lg:items-start">
          <div>
            <h2 id="dados-inteligentes" className="font-display text-3xl font-semibold sm:text-5xl">
              Do total para o detalhe que dá para conferir
            </h2>
            <p className="mt-4 max-w-prose text-fundo/75">
              As contas abaixo usam apenas soma, proporção e comparação entre meses. Aqui aparecem
              os maiores pagamentos a empresas e o motivo publicado na fonte. Nenhum destaque
              significa sobrepreço ou irregularidade.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {signalMonth && monthlySignal && (
                <div className="border-t border-fundo/25 pt-4">
                  <strong className="valor block text-3xl text-amarelo">
                    {formatMoney(monthlySignal.total)}
                  </strong>
                  <span className="mt-2 block">
                    pagos em {signalMonth}, o mês com maior variação contra o mês anterior importado
                  </span>
                  {monthlySignal.change && (
                    <small className="mt-2 block text-fundo/70">
                      Diferença: {formatMoney(monthlySignal.change)}.
                    </small>
                  )}
                </div>
              )}
              {data.linkedToContracts.count > 0 && (
                <div className="border-t border-fundo/25 pt-4">
                  <strong className="valor block text-3xl text-amarelo">
                    {formatMoney(data.linkedToContracts.total)}
                  </strong>
                  <span className="mt-2 block">já conectado a contratos dentro do portal</span>
                  <small className="mt-2 block text-fundo/70">
                    {data.linkedToContracts.count.toLocaleString("pt-BR")} pagamentos com vínculo
                    resolvido por licitação e recebedor.
                  </small>
                </div>
              )}
            </div>
          </div>

          {largestPayments.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-semibold">Maiores pagamentos encontrados</h3>
              <ol className="grid gap-3">
                {largestPayments.map((payment) => {
                  const text =
                    payment.description ??
                    payment.expenseElement ??
                    "A fonte não descreveu o objeto";
                  const href = payment.contractId
                    ? `/contratos/${payment.contractId}`
                    : registros({ ...paid, q: text.slice(0, 100) });

                  return (
                    <li key={payment.id} className="bg-fundo px-4 py-4 text-tinta">
                      <Link href={href} className="group block">
                        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                          <p className="max-w-2xl font-medium group-hover:underline">{text}</p>
                          <span className="valor text-xl">{formatMoney(payment.value)}</span>
                        </div>
                        <p className="mt-3 text-sm text-suave">
                          {payment.supplierName
                            ? plainName(payment.supplierName)
                            : "Recebedor não informado"}
                          {payment.agencyName && ` · ${plainName(payment.agencyName)}`}
                          {payment.date && ` · ${formatDate(payment.date)}`}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-sm text-fundo/70">
                Um pagamento grande pode reunir muitos produtos, meses de serviço ou uma obra
                inteira. O valor isolado não permite dizer que o preço foi alto.
              </p>
            </div>
          )}
        </div>
        <details className="mt-8 border-t border-fundo/25 pt-5">
          <summary className="cursor-pointer font-semibold text-amarelo">
            Como vamos identificar preços que merecem conferência
          </summary>
          <div className="mt-4 grid gap-5 text-sm text-fundo/80 md:grid-cols-3">
            <p>
              <strong className="block text-fundo">1. Comparar o mesmo item</strong>
              Mesma descrição normalizada, unidade de medida e período próximo. Produtos ou serviços
              diferentes não entram no mesmo grupo.
            </p>
            <p>
              <strong className="block text-fundo">2. Exigir amostra suficiente</strong>A referência
              será a mediana de pelo menos cinco compras comparáveis. A tela mostrará todas as
              observações usadas na conta.
            </p>
            <p>
              <strong className="block text-fundo">3. Sinalizar, sem acusar</strong>
              Desvios relevantes serão chamados de “preço para conferir”. Frete, marca, qualidade,
              escala e regras do edital podem explicar a diferença.
            </p>
          </div>
          <p className="mt-5 max-w-prose text-sm text-fundo/70">
            Essa comparação não usa IA para decidir. Ela depende dos itens, quantidades, unidades e
            preços unitários publicados no PNCP. Enquanto esses campos não estiverem sincronizados,
            o portal não atribui alerta de preço.
          </p>
        </details>
      </div>
    </section>
  );
}

function Overview({
  year,
  branch,
  data,
}: {
  year: number;
  branch: ExpenseBranch;
  data: SpendingOverview;
}) {
  const paid = { phase: "pagamento" as const, year, branch };
  const { subject, of } = BRANCHES[branch];
  const signals = buildSpendingSignals({
    paidTotal: data.paid.total,
    committedTotal: data.committed.total,
    byAgency: data.byAgency,
    topSuppliers: data.topSuppliers,
    linkedToContractTotal: data.linkedToContracts.total,
    linkedToContractCount: data.linkedToContracts.count,
    paymentCount: data.paid.count,
  });
  const percent = (value: number): string =>
    `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  return (
    <>
      <ul className="mt-10 grid gap-8 md:grid-cols-3">
        <Phase
          title="Reservado"
          explanation={`${subject} reservou o dinheiro para uma despesa. É uma promessa de gasto, ainda não um pagamento. O valor inclui os reforços e desconta os empenhos anulados.`}
          total={data.committed.total}
          count={data.committed.count}
          href={registros({ phase: "empenho", year, branch })}
        />
        <Phase
          title="Entrega conferida"
          explanation={`${subject} conferiu que o serviço foi prestado ou o produto entregue, e reconheceu a dívida.`}
          total={data.liquidated.total}
          count={data.liquidated.count}
          href={registros({ phase: "liquidacao", year, branch })}
        />
        <Phase
          title="Pago"
          explanation={`O dinheiro saiu de fato da conta ${of} para quem tinha a receber.`}
          total={data.paid.total}
          count={data.paid.count}
          href={registros(paid)}
        />
      </ul>

      <section aria-labelledby="leitura-dos-dados" className="mt-14 border-y border-linha py-8">
        <p className="text-sm font-semibold tracking-wide text-azul-forte uppercase">
          Leitura dos dados
        </p>
        <h2 id="leitura-dos-dados" className="mt-2 max-w-3xl text-2xl font-semibold sm:text-4xl">
          O que estes valores ajudam a entender
        </h2>
        <p className="mt-3 max-w-prose text-suave">
          Comparações calculadas pelo portal a partir dos registros acima. Elas organizam a leitura
          e não indicam, sozinhas, problema ou irregularidade.
        </p>
        <ul className="mt-7 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {signals.paidFromCommittedShare !== null && (
            <li className="border-t-2 border-azul pt-4">
              <strong className="valor block text-4xl">
                {percent(signals.paidFromCommittedShare)}
              </strong>
              <span className="mt-2 block text-lg">
                é a relação entre o pago e o reservado no ano
              </span>
              <small className="mt-2 block text-suave">
                É uma comparação entre totais. Os registros de cada fase podem não ser os mesmos.
              </small>
            </li>
          )}
          {signals.largestAgency && (
            <li className="border-t-2 border-azul pt-4">
              <strong className="valor block text-4xl">
                {percent(signals.largestAgency.share)}
              </strong>
              <span className="mt-2 block text-lg">
                dos pagamentos aparecem em {plainName(signals.largestAgency.name)}
              </span>
              <Link
                href={registros({ ...paid, agencyId: signals.largestAgency.id })}
                className="link mt-2 inline-block text-sm"
              >
                Conferir os registros
              </Link>
            </li>
          )}
          {signals.topSuppliersShare !== null && (
            <li className="border-t-2 border-azul pt-4">
              <strong className="valor block text-4xl">{percent(signals.topSuppliersShare)}</strong>
              <span className="mt-2 block text-lg">
                foi para os dez maiores recebedores com CNPJ
              </span>
              <small className="mt-2 block text-suave">
                Pessoas físicas não entram nesse grupo. A fonte também pode registrar folha ou
                unidade operacional como credor. Maior participação não significa irregularidade.
              </small>
            </li>
          )}
          {signals.contractCoverageShare !== null && (
            <li className="border-t-2 border-azul pt-4">
              <strong className="valor block text-4xl">
                {percent(signals.contractCoverageShare)}
              </strong>
              <span className="mt-2 block text-lg">
                do valor pago já está ligado a um contrato no portal
              </span>
              <small className="mt-2 block text-suave">
                São {data.linkedToContracts.count.toLocaleString("pt-BR")} de{" "}
                {data.paid.count.toLocaleString("pt-BR")} pagamentos. Vínculos ainda podem ser
                encontrados nas próximas atualizações.
              </small>
            </li>
          )}
        </ul>
      </section>

      <DataIntelligence year={year} branch={branch} data={data} />

      <Section
        id="por-orgao"
        title="Pago por secretaria"
        note="Soma dos pagamentos de cada secretaria ou órgão no ano."
      >
        <Breakdown
          rows={data.byAgency.map((row) => ({
            key: row.id,
            label: row.name,
            total: row.total,
            href: registros({ ...paid, agencyId: row.id }),
          }))}
        />
      </Section>

      <Section id="por-mes" title="Pago por mês" note="Pela data de cada pagamento.">
        <Breakdown
          rows={data.byMonth.map((row) => ({
            key: String(row.month),
            label: MONTH_NAMES[row.month - 1] ?? String(row.month),
            total: row.total,
            href: registros({ ...paid, month: row.month }),
          }))}
        />
      </Section>

      <Section
        id="fornecedores"
        title="Quem mais recebeu"
        note="Os dez maiores recebedores com CNPJ no ano. A lista pode incluir folha de pagamento dos servidores, registrada na fonte como um credor único de cada órgão. Pessoas físicas não entram. Receber mais não indica irregularidade."
      >
        <Breakdown
          rows={data.topSuppliers.map((row) => ({
            key: row.id,
            label: row.name,
            total: row.total,
            href: registros({ ...paid, supplierId: row.id }),
          }))}
        />
      </Section>

      <Section
        id="por-tipo"
        title="Pago por tipo de gasto"
        note="Os dez tipos de gasto com maior soma, na classificação oficial."
      >
        <Breakdown
          rows={data.byElement.map((row) => ({
            key: row.element ?? "sem",
            label: row.element ?? "Não classificado",
            total: row.total,
            href: registros({ ...paid, ...(row.element && { q: row.element.slice(0, 100) }) }),
          }))}
        />
      </Section>
    </>
  );
}

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const branch = parseBranch(params.poder) ?? DEFAULT_BRANCH;
  const years = await listExpenseYears(branch);
  const requested = parseExpenseFilters(params).year;
  const year = requested !== undefined && years.includes(requested) ? requested : years[0];
  const hrefFor = (target: ExpenseBranch, targetYear?: number): string => {
    const query = new URLSearchParams();
    if (target !== DEFAULT_BRANCH) query.set("poder", target);
    if (targetYear !== undefined) query.set("ano", String(targetYear));
    const text = query.toString();
    return text ? `/gastos?${text}` : "/gastos";
  };

  return (
    <>
      <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
        Gastos {BRANCHES[branch].of}
        {year !== undefined && ` em ${year}`}
      </h1>
      <nav aria-label="Poder" className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-lg">
        {(Object.keys(BRANCHES) as ExpenseBranch[]).map((option) =>
          option === branch ? (
            <span key={option} aria-current="page" className="border-b-4 border-azul font-semibold">
              {BRANCHES[option].name}
            </span>
          ) : (
            <Link key={option} href={hrefFor(option)} className="link">
              {BRANCHES[option].name}
            </Link>
          ),
        )}
      </nav>
      <p className="mt-4 max-w-prose text-suave sm:text-lg">
        Todo gasto público passa por três passos: primeiro o dinheiro é reservado, depois alguém
        confere a entrega, e só então vem o pagamento. Por isso os três valores abaixo são
        diferentes. Todos já descontam o que foi cancelado.
      </p>
      <Explica termo="empenho" rotulo="O que é “dinheiro reservado”?" />
      <Explica termo="liquidacao" rotulo="O que é “entrega conferida”?" />

      {year === undefined ? (
        <p className="mt-10 text-suave">Ainda não há despesas {BRANCHES[branch].of} importadas.</p>
      ) : (
        <>
          {years.length > 1 && (
            <nav aria-label="Ano" className="mt-6 flex flex-wrap gap-4">
              {years.map((option) =>
                option === year ? (
                  <span key={option} className="font-semibold">
                    {option}
                  </span>
                ) : (
                  <Link key={option} href={hrefFor(branch, option)} className="link">
                    {option}
                  </Link>
                ),
              )}
            </nav>
          )}
          <Overview year={year} branch={branch} data={await getSpendingOverview(year, branch)} />
          <p className="mt-14 max-w-prose text-sm text-suave">
            Fonte:{" "}
            <a href={BRANCHES[branch].sourceUrl} rel="noopener noreferrer" className="link">
              página de despesas {BRANCHES[branch].of} no Município Online
            </a>
            . Prefeitura e Câmara têm orçamentos separados e nunca são somadas nesta página. Os
            valores somam apenas os meses já importados para o portal e podem ser menores que o
            total do ano na fonte.
          </p>
        </>
      )}
    </>
  );
}
