import { describe, expect, test } from "vitest";

import { expenseMonthsFor, msUntilNextRun } from "./schedule";

const HOUR = 3_600_000;

describe("msUntilNextRun", () => {
  // America/Bahia é UTC-3 o ano todo.
  test("waits until today's run time when it is still ahead", () => {
    expect(msUntilNextRun(new Date("2026-10-05T06:00:00Z"), "05:00")).toBe(2 * HOUR);
  });

  test("waits until tomorrow when today's run time has passed", () => {
    expect(msUntilNextRun(new Date("2026-10-05T09:00:00Z"), "05:00")).toBe(23 * HOUR);
  });

  test("schedules a full day ahead when called exactly at the run time", () => {
    expect(msUntilNextRun(new Date("2026-10-05T08:00:00Z"), "05:00")).toBe(24 * HOUR);
  });

  test("rejects a malformed time", () => {
    expect(() => msUntilNextRun(new Date(), "25:99")).toThrow(/horário inválido/i);
  });

  test("skips the weekend after Friday", () => {
    // 09/10/2026, sexta-feira, 06:00 UTC; a coleta às 05:00 Bahia já passou.
    expect(msUntilNextRun(new Date("2026-10-09T09:00:00Z"), "05:00")).toBe(71 * HOUR);
  });

  test("does not schedule a collection on Sunday", () => {
    expect(msUntilNextRun(new Date("2026-10-11T10:00:00Z"), "05:00")).toBe(22 * HOUR);
  });
});

describe("expenseMonthsFor", () => {
  test("covers the current and the previous month, where late entries appear", () => {
    expect(expenseMonthsFor("2026-10-05")).toEqual([{ year: 2026, months: [9, 10] }]);
  });

  test("crosses the year boundary in January", () => {
    expect(expenseMonthsFor("2027-01-10")).toEqual([
      { year: 2026, months: [12] },
      { year: 2027, months: [1] },
    ]);
  });
});
