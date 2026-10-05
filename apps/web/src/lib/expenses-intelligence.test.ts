import { describe, expect, test } from "vitest";

import { buildSpendingIntelligence, largestMonthlySignal } from "./expenses";

describe("largestMonthlySignal", () => {
  test("returns the month with the largest absolute movement", () => {
    expect(
      largestMonthlySignal([
        { month: 3, total: "200" },
        { month: 1, total: "100" },
        { month: 2, total: "450" },
      ]),
    ).toEqual({
      month: 2,
      total: "450",
      previousTotal: "100",
      change: "350.00",
    });
  });

  test("handles empty and single-month datasets", () => {
    expect(largestMonthlySignal([])).toBeNull();
    expect(largestMonthlySignal([{ month: 8, total: "99" }])).toEqual({
      month: 8,
      total: "99",
      previousTotal: null,
      change: null,
    });
  });
});

describe("buildSpendingIntelligence", () => {
  test("keeps the strongest supplier and concrete payment rows", () => {
    const payment = {
      id: "p1",
      date: "2026-09-10",
      value: "1000",
      supplierName: "Empresa A",
      agencyName: "Saúde",
      description: "Compra de material hospitalar",
      expenseElement: "Material de consumo",
      contractId: null,
    };

    expect(
      buildSpendingIntelligence({
        paidTotal: "5000",
        byMonth: [
          { month: 1, total: "2000" },
          { month: 2, total: "5000" },
        ],
        topSuppliers: [{ name: "Empresa A", total: "1250" }],
        largestPayments: [payment],
      }),
    ).toEqual({
      topSupplierShare: 25,
      topSupplierName: "Empresa A",
      monthlySignal: {
        month: 2,
        total: "5000",
        previousTotal: "2000",
        change: "3000.00",
      },
      largestPayments: [payment],
    });
  });
});
