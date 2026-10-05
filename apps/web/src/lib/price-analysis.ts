export type PriceAnalysisStatus = "review" | "within_range" | "insufficient_data";

export interface PriceAnalysis {
  status: PriceAnalysisStatus;
  median: number | null;
  differencePercent: number | null;
  sampleSize: number;
}

export const MIN_COMPARABLE_PRICES = 5;
export const REVIEW_DIFFERENCE_PERCENT = 50;

const medianOf = (values: number[]): number => {
  const middle = Math.floor(values.length / 2);
  const upper = values[middle] ?? 0;
  if (values.length % 2 === 1) return upper;
  return ((values[middle - 1] ?? upper) + upper) / 2;
};

/**
 * Compares one unit price with a prevalidated group of equivalent items.
 * Grouping by item, unit and period happens before this calculation.
 */
export function analyzeComparablePrice(
  unitPrice: number,
  comparableUnitPrices: number[],
): PriceAnalysis {
  const sample = comparableUnitPrices
    .filter((value) => Number.isFinite(value) && value > 0)
    .toSorted((a, b) => a - b);

  if (!Number.isFinite(unitPrice) || unitPrice <= 0 || sample.length < MIN_COMPARABLE_PRICES) {
    return {
      status: "insufficient_data",
      median: null,
      differencePercent: null,
      sampleSize: sample.length,
    };
  }

  const median = medianOf(sample);
  const differencePercent = Math.round(((unitPrice - median) / median) * 1000) / 10;

  return {
    status: differencePercent >= REVIEW_DIFFERENCE_PERCENT ? "review" : "within_range",
    median,
    differencePercent,
    sampleSize: sample.length,
  };
}
