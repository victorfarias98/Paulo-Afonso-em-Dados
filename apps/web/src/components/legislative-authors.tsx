"use client";

import { useEffect, useRef, useState } from "react";

import { capturePortalEvent } from "@/lib/analytics-client";

import {
  filterLegislativeMembers,
  type LegislativeMemberSummary,
  type LegislativeScope,
  type LegislativeSummary,
} from "@/lib/legislative";
import { formatDate, formatDateTime } from "@/lib/format";

const SOURCE = "https://sapl.pauloafonso.ba.leg.br";

function Member({ member, year }: { member: LegislativeMemberSummary; year: number }) {
  const query = new URLSearchParams({ ano: String(year) });
  const author = member.authorIds[0];
  if (author) query.set("autoria__autor", String(author));
  const unknown = member.coverage === "unknown";

  return (
    <li className="legislative-member">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">
            <a
              href={`${SOURCE}/parlamentar/${member.id}`}
              className="inline-flex min-h-11 items-center hover:underline"
            >
              {member.name}
            </a>
          </h3>
          <p className="text-sm text-suave">
            {unknown
              ? "Autoria ainda não identificada na fonte"
              : member.coverage === "partial"
                ? "Consulta parcial: outros registros podem faltar"
                : member.zeroTotal
                  ? "Nenhuma proposta encontrada neste período"
                  : member.zeroProjects
                    ? "Nenhum projeto encontrado; veja as demais propostas"
                    : "Projetos registrados no período"}
          </p>
        </div>
        <dl className="flex gap-5 sm:gap-8">
          {[
            ["Projetos", member.projectsCount],
            ["Pedidos", member.requestsCount],
            ["Total de propostas", member.totalCount],
          ].map(([label, count]) => (
            <div key={label}>
              <dt className="text-xs text-suave">{label}</dt>
              <dd className={unknown ? "text-sm" : "valor text-2xl"}>
                {unknown
                  ? "Não verificado"
                  : member.coverage === "partial"
                    ? `Pelo menos ${count}`
                    : count}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <details
        className="mt-3"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            capturePortalEvent("portal_legislative_member_opened", {
              page_path: "/",
              section: "autores",
              member_id: member.id,
              snapshot_year: year,
            });
          }
        }}
      >
        <summary>Ver propostas e entender os números</summary>
        {member.recentProjects.length > 0 && (
          <ul className="mt-3 grid gap-4">
            {member.recentProjects.map((project) => (
              <li key={project.id}>
                <a
                  href={project.url}
                  data-analytics-source
                  className="link inline-flex min-h-11 items-center text-sm"
                >
                  {project.type} {project.number}/{year}, apresentado em {formatDate(project.date)}
                </a>
                <p className="max-w-prose text-sm">{project.title.replace(/[–—]/g, "-")}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 max-w-prose text-sm text-suave">
          {member.zeroTotal || member.zeroProjects
            ? "A consulta não traz uma justificativa individual para essa ausência. Fiscalização, comissões e participação nas sessões são outras atividades e não estão medidas aqui."
            : "Apresentar uma proposta não significa que ela foi aprovada ou executada. Confira a tramitação na Câmara."}
        </p>
        {author && (
          <a
            href={`${SOURCE}/materia/pesquisar-materia?${query.toString()}`}
            data-analytics-source
            className="link mt-2 inline-flex min-h-11 items-center text-sm"
          >
            Ver propostas de {member.name} no SAPL
          </a>
        )}
        <a
          href={`${SOURCE}/parlamentar/${member.id}`}
          data-analytics-source
          className="link mt-2 flex min-h-11 items-center text-sm"
        >
          Consultar o perfil na Câmara
        </a>
      </details>
    </li>
  );
}

export function LegislativeAuthors({ summary }: { summary: LegislativeSummary }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<LegislativeScope>("all");
  const searchPending = useRef(false);
  const members = filterLegislativeMembers(summary.members, query, scope);

  useEffect(() => {
    if (!searchPending.current || query.trim().length === 0) return;

    const timer = window.setTimeout(() => {
      searchPending.current = false;
      capturePortalEvent("portal_legislative_search", {
        page_path: "/",
        section: "autores",
        search_length: query.trim().length,
        results_count: filterLegislativeMembers(summary.members, query, scope).length,
        legislative_scope: scope,
        snapshot_year: summary.year,
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [query, scope, summary.members, summary.year]);

  return (
    <div>
      <p className="max-w-prose text-suave">
        Projetos propõem leis e regras. Pedidos são requerimentos feitos pelos vereadores. O total
        também inclui moções e outras matérias.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-medium">Busque o vereador</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              searchPending.current = event.target.value.trim().length > 0;
              setQuery(event.target.value);
            }}
            maxLength={100}
            className="campo"
            placeholder="Nome do vereador"
          />
        </label>
        <label>
          <span className="mb-2 block text-sm font-medium">O que você quer ver?</span>
          <select
            value={scope}
            onChange={(event) => {
              const selected = event.target.value as LegislativeScope;
              setScope(selected);
              capturePortalEvent("portal_legislative_filter", {
                page_path: "/",
                section: "autores",
                legislative_scope: selected,
                results_count: filterLegislativeMembers(summary.members, query, selected).length,
                snapshot_year: summary.year,
              });
            }}
            className="campo"
          >
            <option value="all">Todos os vereadores</option>
            <option value="projects">Com projetos apresentados</option>
            <option value="no-projects">Sem projetos encontrados</option>
            <option value="none">Sem nenhuma proposta encontrada</option>
          </select>
        </label>
      </div>
      <p className="mt-4 text-sm text-suave">
        Dados de {summary.year}, consultados em {formatDateTime(new Date(summary.collectedAt))}.
      </p>
      <p role="status" aria-live="polite" className="mt-4 text-sm text-suave">
        {members.length} de {summary.members.length} parlamentares marcados como ativos na fonte.
        Ordem alfabética.
      </p>
      {members.length > 0 ? (
        <ul className="mt-4">
          {members.map((member) => (
            <Member key={member.id} member={member} year={summary.year} />
          ))}
        </ul>
      ) : (
        <div className="my-6 rounded-xl bg-superficie p-5">
          <p>Nenhum vereador corresponde a essa busca.</p>
          <button
            type="button"
            onClick={() => {
              searchPending.current = false;
              setQuery("");
              setScope("all");
              capturePortalEvent("portal_legislative_filter", {
                page_path: "/",
                section: "autores",
                legislative_scope: "all",
                results_count: summary.members.length,
                snapshot_year: summary.year,
              });
            }}
            className="botao mt-3"
          >
            Limpar filtros
          </button>
        </div>
      )}
      <details
        data-analytics-explanation="metodologia-legislativa"
        className="mt-4 rounded-xl bg-superficie p-5"
      >
        <summary>O que esses números dizem?</summary>
        <p className="mt-3 max-w-prose text-sm">
          Projetos incluem leis ordinárias e complementares, decretos legislativos, resoluções,
          propostas de emenda à Lei Orgânica e substitutivos. Emendas e moções entram apenas no
          total.
        </p>
        <p className="mt-3 max-w-prose text-sm">
          A contagem inclui autoria e coautoria parlamentar das matérias de {summary.year} presentes
          no SAPL. Uma proposta conjunta conta para cada autor. Por isso, somar os totais dos
          vereadores pode contar a mesma proposta mais de uma vez.
        </p>
        <p className="mt-3 max-w-prose text-sm">
          Propostas do Executivo, de comissões ou de coletivos não são atribuídas a vereadores sem
          autoria individual registrada. Zero significa ausência de registros desse tipo no período
          consultado, não ausência de trabalho. Não temos aqui presenças, atuação em comissões ou
          justificativas individuais. Esses dados ajudam a perguntar e cobrar, mas não são uma nota
          de desempenho.
        </p>
      </details>
      <p className="mt-4 text-sm text-suave">
        Fonte:{" "}
        <a href={`${SOURCE}/materia/pesquisar-materia?ano=${summary.year}`} className="link">
          SAPL da Câmara Municipal
        </a>
        . {summary.complete ? "Consulta completa" : "Consulta parcial"} de {summary.year}, realizada
        em {formatDateTime(new Date(summary.collectedAt))}. Atualização quando uma nova coleta é
        publicada; não é tempo real.
      </p>
    </div>
  );
}
