import { describe, expect, test } from "vitest";

import { analyzeComparablePrice } from "./price-analysis";

describe("analyzeComparablePrice", () => {
  test("flags a price at least fifty percent above a five-item median", () => {
    expect(analyzeComparablePrice(18, [9, 10, 10, 11, 12])).toEqual({
      status: "review",
      median: 10,
      differencePercent: 80,
      sampleSize: 5,
    });
  });

  test("does not flag a price inside the declared range", () => {
    expect(analyzeComparablePrice(14.9, [9, 10, 10, 11, 12])).toEqual({
      status: "within_range",
      median: 10,
      differencePercent: 49,
      sampleSize: 5,
    });
  });

  test("refuses to compare insufficient or invalid samples", () => {
    expect(analyzeComparablePrice(20, [9, 10, 11, 12])).toEqual({
      status: "insufficient_data",
      median: null,
      differencePercent: null,
      sampleSize: 4,
    });
    expect(analyzeComparablePrice(20, [0, -1, Number.NaN, 10, 11])).toEqual({
      status: "insufficient_data",
      median: null,
      differencePercent: null,
      sampleSize: 2,
    });
  });
});
