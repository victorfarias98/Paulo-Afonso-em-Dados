import { describe, expect, test } from "vitest";

import { addDays, deriveWorkStatus } from "./work-status";

const today = "2026-10-04";

describe("addDays", () => {
  test("adds days across months and years", () => {
    expect(addDays("2025-07-16", 360)).toBe("2026-07-11");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("deriveWorkStatus", () => {
  test.each([
    ["Em andamento", "em_andamento"],
    ["Em Andamento", "em_andamento"],
    ["Não Iniciada", "nao_iniciada"],
    ["Paralisada", "paralisada"],
    ["Em Fiscalização", "em_fiscalizacao"],
    ["Concluída", "concluida"],
    ["Recbto Provisório", "concluida"],
    ["Recbto Definitivo", "concluida"],
  ])("maps the source label %s to %s when the deadline has not passed", (label, expected) => {
    expect(deriveWorkStatus({ sourceStatus: label, expectedEndDate: "2027-01-01", today })).toBe(
      expected,
    );
  });

  test("is 'prazo_vencido' when the expected end passed and the work is not concluded", () => {
    expect(
      deriveWorkStatus({ sourceStatus: "Em andamento", expectedEndDate: "2026-07-11", today }),
    ).toBe("prazo_vencido");
    expect(
      deriveWorkStatus({ sourceStatus: "Paralisada", expectedEndDate: "2026-07-11", today }),
    ).toBe("prazo_vencido");
  });

  test("a concluded work is never 'prazo_vencido'", () => {
    expect(
      deriveWorkStatus({ sourceStatus: "Concluída", expectedEndDate: "2026-07-11", today }),
    ).toBe("concluida");
  });

  test("the deadline day itself is still within the deadline", () => {
    expect(deriveWorkStatus({ sourceStatus: "Em andamento", expectedEndDate: today, today })).toBe(
      "em_andamento",
    );
  });

  test("keeps the source status when there is no deadline to compare", () => {
    expect(deriveWorkStatus({ sourceStatus: "Em andamento", expectedEndDate: null, today })).toBe(
      "em_andamento",
    );
  });

  test("is 'informacao_insuficiente' for a missing or unknown source status", () => {
    expect(deriveWorkStatus({ sourceStatus: null, expectedEndDate: "2020-01-01", today })).toBe(
      "informacao_insuficiente",
    );
    expect(deriveWorkStatus({ sourceStatus: "Outro", expectedEndDate: null, today })).toBe(
      "informacao_insuficiente",
    );
  });
});
