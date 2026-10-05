import { describe, expect, test } from "vitest";

import { deriveContractStatus } from "./contract-status";

const today = "2026-10-04";

describe("deriveContractStatus", () => {
  test("is 'cancelado' when the source says the contract was cancelled", () => {
    expect(deriveContractStatus({ sourceStatus: "CANCELADO", endsAt: "2027-01-01", today })).toBe(
      "cancelado",
    );
  });

  test("is 'vigente' while the end date has not passed", () => {
    expect(deriveContractStatus({ sourceStatus: "NORMAL", endsAt: "2027-07-15", today })).toBe(
      "vigente",
    );
  });

  test("is 'vigente' on the last day of the term", () => {
    expect(deriveContractStatus({ sourceStatus: "NORMAL", endsAt: today, today })).toBe("vigente");
  });

  test("is 'vigencia_encerrada' after the end date, whatever the source label", () => {
    expect(deriveContractStatus({ sourceStatus: "NORMAL", endsAt: "2026-02-03", today })).toBe(
      "vigencia_encerrada",
    );
  });

  test("is 'informacao_insuficiente' when there is no end date", () => {
    expect(deriveContractStatus({ sourceStatus: "NORMAL", endsAt: null, today })).toBe(
      "informacao_insuficiente",
    );
  });
});
