import { describe, expect, test } from "vitest";

import { buildSpendingSignals } from "./spending-signals";

describe("buildSpendingSignals", () => {
  test("turns spending totals into plain, auditable shares", () => {
    expect(
      buildSpendingSignals({
        paidTotal: "1000",
        committedTotal: "1600",
        byAgency: [
          { id: "saude", name: "Saúde", total: "400" },
          { id: "educacao", name: "Educação", total: "300" },
        ],
        topSuppliers: [
          { id: "a", name: "Empresa A", total: "250" },
          { id: "b", name: "Empresa B", total: "150" },
        ],
        linkedToContractTotal: "350",
        linkedToContractCount: 7,
        paymentCount: 20,
      }),
    ).toEqual({
      paidFromCommittedShare: 62.5,
      largestAgency: { id: "saude", name: "Saúde", total: "400", share: 40 },
      topSuppliersShare: 40,
      contractCoverageShare: 35,
      contractCoverageCountShare: 35,
    });
  });

  test("returns null shares when there is no valid denominator", () => {
    expect(
      buildSpendingSignals({
        paidTotal: "0",
        committedTotal: "0",
        byAgency: [],
        topSuppliers: [],
        linkedToContractTotal: "0",
        linkedToContractCount: 0,
        paymentCount: 0,
      }),
    ).toEqual({
      paidFromCommittedShare: null,
      largestAgency: null,
      topSuppliersShare: null,
      contractCoverageShare: null,
      contractCoverageCountShare: null,
    });
  });

  test("does not hide ratios above one hundred", () => {
    const result = buildSpendingSignals({
      paidTotal: "120",
      committedTotal: "100",
      byAgency: [{ id: "a", name: "Órgão", total: "140" }],
      topSuppliers: [{ id: "s", name: "Empresa", total: "130" }],
      linkedToContractTotal: "150",
      linkedToContractCount: 12,
      paymentCount: 10,
    });

    expect(result.paidFromCommittedShare).toBe(120);
    expect(result.largestAgency?.share).toBe(116.7);
    expect(result.topSuppliersShare).toBe(108.3);
    expect(result.contractCoverageShare).toBe(125);
    expect(result.contractCoverageCountShare).toBe(120);
  });
});
