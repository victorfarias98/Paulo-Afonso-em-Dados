import { describe, expect, test } from "vitest";

import { elapsedShare, perHundred, percentOf, perResident, splitOfHundred } from "./insights";

describe("percentOf", () => {
  test("returns the share with one decimal", () => {
    expect(percentOf("25", "200")).toBe(12.5);
    expect(percentOf("1", "3")).toBe(33.3);
  });

  test("returns null when there is no total to compare with", () => {
    expect(percentOf("10", "0")).toBeNull();
    expect(percentOf("10", "-5")).toBeNull();
  });
});

describe("perHundred", () => {
  test("says how many reais of every hundred went to the part", () => {
    expect(perHundred("320", "1000")).toBe(32);
    expect(perHundred("5", "1000")).toBe(1);
    expect(perHundred("0", "1000")).toBe(0);
  });
});

describe("splitOfHundred", () => {
  const rows = [
    { key: "a", label: "Saúde", total: "500" },
    { key: "b", label: "Educação", total: "300" },
    { key: "c", label: "Fazenda", total: "150" },
    { key: "d", label: "Cultura", total: "50" },
  ];

  test("keeps the largest parts and groups the rest, always adding up to the whole", () => {
    const parts = splitOfHundred(rows, 2, "Demais órgãos");

    expect(parts.map((part) => part.label)).toEqual(["Saúde", "Educação", "Demais órgãos"]);
    expect(parts.map((part) => part.share)).toEqual([50, 30, 20]);
    expect(parts.reduce((sum, part) => sum + part.share, 0)).toBe(100);
  });

  test("does not add a rest group when everything fits", () => {
    expect(splitOfHundred(rows, 4, "Demais")).toHaveLength(4);
  });

  test("returns nothing when the total is zero", () => {
    expect(splitOfHundred([{ key: "a", label: "x", total: "0" }], 3, "Demais")).toEqual([]);
  });
});

describe("perResident", () => {
  test("divides the total by the census population", () => {
    expect(perResident("112870")).toBe(1);
    expect(perResident("421173833.19")).toBe(3731);
  });
});

describe("elapsedShare", () => {
  test("says how much of the deadline has gone by", () => {
    expect(elapsedShare("2026-01-01", "2026-12-31", "2026-07-02")).toBe(50);
  });

  test("stays between 0 and 100", () => {
    expect(elapsedShare("2026-06-01", "2026-12-01", "2026-01-01")).toBe(0);
    expect(elapsedShare("2026-01-01", "2026-03-01", "2026-10-05")).toBe(100);
  });

  test("returns null without both dates or with dates out of order", () => {
    expect(elapsedShare(null, "2026-03-01", "2026-10-05")).toBeNull();
    expect(elapsedShare("2026-03-01", "2026-01-01", "2026-10-05")).toBeNull();
  });
});
