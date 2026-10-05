import snapshotData from "../data/legislative-snapshot.json";
import { describe, expect, it } from "vitest";
import {
  buildLegislativeSummary,
  filterLegislativeMembers,
  parseLegislativeSnapshot,
} from "./legislative";
const fixture = (overrides = {}) => ({
  collectedAt: "2026-10-05T12:00:00Z",
  year: 2026,
  complete: true,
  expectedMatters: 2,
  parliament: [
    { id: 1, nome_parlamentar: "Áurea", ativo: true },
    { id: 2, nome_parlamentar: "Bruno", ativo: true },
    { id: 3, nome_parlamentar: "Carlos", ativo: true },
  ],
  authors: [
    { id: 100, object_id: 1, content_type: 1 },
    { id: 101, object_id: 1, content_type: 1 },
    { id: 200, object_id: 2, content_type: 1 },
  ],
  types: [
    { id: 8, sigla: "PLO", descricao: "Projeto de lei" },
    { id: 10, sigla: "REQ", descricao: "Requerimento" },
    { id: 9, sigla: "PR", descricao: "Projeto de resolução" },
  ],
  matters: [
    {
      id: 5,
      ano: 2026,
      tipo: 8,
      autores: [100, 101, 200],
      numero: 1,
      ementa: "Saúde",
      data_apresentacao: "2026-09-01",
    },
    {
      id: 6,
      ano: 2026,
      tipo: 10,
      autores: [100],
      numero: 2,
      ementa: "Pedido",
      data_apresentacao: "2026-09-02",
    },
  ],
  ...overrides,
});
describe("legislative snapshot", () => {
  it("maps author ids through parliamentary records and deduplicates joint authorship", () => {
    const summary = buildLegislativeSummary(parseLegislativeSnapshot(fixture()));
    expect(summary.members[0]).toMatchObject({
      name: "Áurea",
      projectsCount: 1,
      requestsCount: 1,
      totalCount: 2,
      coverage: "complete",
    });
    expect(summary.members[1]?.totalCount).toBe(1);
    expect(summary.members[0]?.recentProjects[0]?.url).toBe(
      "https://sapl.pauloafonso.ba.leg.br/materia/5",
    );
  });
  it("never asserts absence for missing author mappings", () => {
    const members = buildLegislativeSummary(parseLegislativeSnapshot(fixture())).members;
    expect(members[2]).toMatchObject({
      coverage: "unknown",
      zeroTotal: false,
      zeroProjects: false,
    });
    expect(filterLegislativeMembers(members, "", "none")).toEqual([]);
  });
  it("only asserts zero with complete collection and mapped member", () => {
    const members = buildLegislativeSummary(
      parseLegislativeSnapshot(fixture({ matters: [], expectedMatters: 0 })),
    ).members;
    expect(filterLegislativeMembers(members, "", "none")).toHaveLength(2);
    expect(filterLegislativeMembers(members, "aurea", "all")).toHaveLength(1);
  });
  it("does not assert zero for partial collections", () => {
    const members = buildLegislativeSummary(
      parseLegislativeSnapshot(fixture({ complete: false, matters: [], expectedMatters: 4 })),
    ).members;
    expect(members[0]?.coverage).toBe("partial");
    expect(filterLegislativeMembers(members, "", "none")).toEqual([]);
  });
  it("rejects mismatched complete counts, duplicates and years", () => {
    expect(() => parseLegislativeSnapshot(fixture({ expectedMatters: 3 }))).toThrow();
    const snapshot = fixture();
    expect(() =>
      parseLegislativeSnapshot(fixture({ matters: [snapshot.matters[0], snapshot.matters[0]] })),
    ).toThrow();
    expect(() => parseLegislativeSnapshot(fixture({ year: 2025 }))).toThrow();
  });
  it("counts the official PR project type and excludes inactive parliament", () => {
    const snapshot = fixture();
    const summary = buildLegislativeSummary(
      parseLegislativeSnapshot(
        fixture({
          parliament: [
            ...snapshot.parliament,
            { id: 4, nome_parlamentar: "Inativo", ativo: false },
          ],
          matters: [{ ...snapshot.matters[0], tipo: 9 }, snapshot.matters[1]],
        }),
      ),
    );
    expect(summary.members).toHaveLength(3);
    expect(filterLegislativeMembers(summary.members, "", "projects")).toHaveLength(2);
  });
});

it("distinguishes no projects from no activity", () => {
  const snapshot = fixture();
  const members = buildLegislativeSummary(
    parseLegislativeSnapshot(fixture({ matters: [snapshot.matters[1]], expectedMatters: 1 })),
  ).members;
  expect(filterLegislativeMembers(members, "", "no-projects")).toHaveLength(2);
  expect(filterLegislativeMembers(members, "", "none")).toHaveLength(1);
});

it("validates the production collection and maps all active members", () => {
  const snapshot = parseLegislativeSnapshot(snapshotData);
  const summary = buildLegislativeSummary(snapshot);
  expect(snapshot.matters).toHaveLength(snapshot.expectedMatters);
  expect(summary.members.every((member) => member.coverage === "complete")).toBe(true);
  expect(
    snapshot.matters.every((matter) =>
      matter.autores.every((id) => snapshot.authors.some((author) => author.id === id)),
    ),
  ).toBe(true);
});
it("rejects unresolved author references before absence can be asserted", () => {
  const snapshot = fixture();
  expect(() =>
    parseLegislativeSnapshot(
      fixture({ matters: [{ ...snapshot.matters[0], autores: [999] }, snapshot.matters[1]] }),
    ),
  ).toThrow();
});

it("counts substitute bills as projects and amendments only as other matters", () => {
  const snapshot = fixture();
  const matter = snapshot.matters[0]!;
  const members = buildLegislativeSummary(
    parseLegislativeSnapshot(
      fixture({
        types: [
          ...snapshot.types,
          { id: 17, sigla: "SUBPL", descricao: "Substitutivo ao Projeto de Lei" },
          { id: 14, sigla: "EMD", descricao: "Emenda" },
          { id: 15, sigla: "EMI", descricao: "Emendas Impositivas" },
        ],
        matters: [
          { ...matter, tipo: 17 },
          { ...matter, id: 7, tipo: 14 },
          { ...matter, id: 8, tipo: 15 },
        ],
        expectedMatters: 3,
      }),
    ),
  ).members;
  expect(members[0]).toMatchObject({ projectsCount: 1, totalCount: 3 });
  expect(members[0]?.recentProjects[0]?.type).toBe("SUBPL");
});
