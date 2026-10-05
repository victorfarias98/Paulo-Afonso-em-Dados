import { z } from "zod";

const idSchema = z.number().int().positive();
export const parliamentSchema = z.object({
  id: idSchema,
  nome_parlamentar: z.string().trim().min(1),
  ativo: z.boolean(),
});
export const authorSchema = z.object({
  id: idSchema,
  object_id: idSchema.nullable(),
  content_type: idSchema.nullable(),
});
export const matterSchema = z.object({
  id: idSchema,
  ano: z.number().int(),
  tipo: idSchema,
  autores: z.array(idSchema),
  numero: z.number().int().nonnegative(),
  ementa: z.string(),
  data_apresentacao: z.iso.date(),
});
export const matterTypeSchema = z.object({
  id: idSchema,
  sigla: z.string().min(1),
  descricao: z.string().min(1),
});
export const legislativeSnapshotSchema = z
  .object({
    collectedAt: z.iso.datetime({ offset: true }),
    year: z.number().int().min(2000).max(2100),
    complete: z.boolean(),
    expectedMatters: z.number().int().nonnegative(),
    parliament: z.array(parliamentSchema),
    authors: z.array(authorSchema),
    matters: z.array(matterSchema),
    types: z.array(matterTypeSchema),
  })
  .superRefine((snapshot, context) => {
    const authorIds = new Set(snapshot.authors.map((author) => author.id));
    if (snapshot.matters.some((matter) => matter.autores.some((id) => !authorIds.has(id)))) {
      context.addIssue({
        code: "custom",
        path: ["authors"],
        message: "Every matter author must have a known author record",
      });
    }

    for (const key of ["matters", "parliament", "authors", "types"] as const) {
      if (new Set(snapshot[key].map((item) => item.id)).size !== snapshot[key].length)
        context.addIssue({ code: "custom", path: [key], message: "Duplicate record ids" });
    }
    if (snapshot.complete && snapshot.matters.length !== snapshot.expectedMatters)
      context.addIssue({
        code: "custom",
        path: ["expectedMatters"],
        message: "Complete collection must match expected count",
      });
    if (snapshot.matters.some((matter) => matter.ano !== snapshot.year))
      context.addIssue({
        code: "custom",
        path: ["matters"],
        message: "Matter year must match collection year",
      });
    if (snapshot.matters.some((matter) => !snapshot.types.some((type) => type.id === matter.tipo)))
      context.addIssue({
        code: "custom",
        path: ["types"],
        message: "Every matter must have a known type",
      });
  });
export type LegislativeSnapshot = z.infer<typeof legislativeSnapshotSchema>;
export interface LegislativeProject {
  id: number;
  title: string;
  number: number;
  type: string;
  date: string;
  url: string;
}
export interface LegislativeMemberSummary {
  id: number;
  name: string;
  authorIds: number[];
  projectsCount: number;
  requestsCount: number;
  totalCount: number;
  coverage: "complete" | "partial" | "unknown";
  zeroProjects: boolean;
  zeroTotal: boolean;
  recentProjects: LegislativeProject[];
}
export interface LegislativeSummary {
  year: number;
  collectedAt: string;
  complete: boolean;
  members: LegislativeMemberSummary[];
}
export type LegislativeScope = "all" | "projects" | "no-projects" | "none";
const projectTypes = ["PLO", "PLC", "PDL", "PR", "PRE", "PELO", "SUBPL"];
export function parseLegislativeSnapshot(input: unknown): LegislativeSnapshot {
  return legislativeSnapshotSchema.parse(input);
}

function summarizeMember(
  member: LegislativeSnapshot["parliament"][number],
  snapshot: LegislativeSnapshot,
): LegislativeMemberSummary {
  const authorIds = snapshot.authors
    .filter((author) => author.content_type === 1 && author.object_id === member.id)
    .map((author) => author.id);
  const matters = snapshot.matters.filter((matter) =>
    matter.autores.some((author) => authorIds.includes(author)),
  );
  const typeFor = (id: number) =>
    snapshot.types.find((type) => type.id === id)?.sigla.toUpperCase() ?? "";
  const projects = matters.filter((matter) => projectTypes.includes(typeFor(matter.tipo)));
  const coverage = authorIds.length === 0 ? "unknown" : snapshot.complete ? "complete" : "partial";
  const recentProjects = [...projects]
    .sort((a, b) => b.data_apresentacao.localeCompare(a.data_apresentacao) || b.id - a.id)
    .slice(0, 3)
    .map((matter) => ({
      id: matter.id,
      title: matter.ementa,
      number: matter.numero,
      type: typeFor(matter.tipo),
      date: matter.data_apresentacao,
      url: `https://sapl.pauloafonso.ba.leg.br/materia/${matter.id}`,
    }));
  return {
    id: member.id,
    name: member.nome_parlamentar,
    authorIds,
    projectsCount: projects.length,
    requestsCount: matters.filter((matter) => typeFor(matter.tipo) === "REQ").length,
    totalCount: matters.length,
    coverage,
    zeroProjects: coverage === "complete" && projects.length === 0,
    zeroTotal: coverage === "complete" && matters.length === 0,
    recentProjects,
  };
}
export function buildLegislativeSummary(snapshot: LegislativeSnapshot): LegislativeSummary {
  return {
    year: snapshot.year,
    collectedAt: snapshot.collectedAt,
    complete: snapshot.complete,
    members: snapshot.parliament
      .filter((member) => member.ativo)
      .map((member) => summarizeMember(member, snapshot))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.id - b.id),
  };
}
const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
export function filterLegislativeMembers(
  members: readonly LegislativeMemberSummary[],
  query: string,
  scope: LegislativeScope,
): LegislativeMemberSummary[] {
  const normalizedQuery = normalizeName(query);
  return members.filter(
    (member) =>
      normalizeName(member.name).includes(normalizedQuery) &&
      (scope === "all" ||
        (scope === "projects"
          ? member.projectsCount > 0
          : scope === "no-projects"
            ? member.zeroProjects
            : member.zeroTotal)),
  );
}
