interface RankedTotal {
  id: string;
  name: string;
  total: string;
}

export interface SpendingSignalInput {
  paidTotal: string;
  committedTotal: string;
  byAgency: RankedTotal[];
  topSuppliers: RankedTotal[];
  linkedToContractTotal: string;
  linkedToContractCount: number;
  paymentCount: number;
}

const shareOf = (part: number, total: number): number | null => {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.round((part / total) * 1000) / 10);
};

/** Produces explanatory ratios from published totals without assigning judgment or causality. */
export function buildSpendingSignals(input: SpendingSignalInput) {
  const paid = Number(input.paidTotal);
  const committed = Number(input.committedTotal);
  const largestAgency = input.byAgency[0];
  const topSuppliersTotal = input.topSuppliers.reduce((sum, row) => sum + Number(row.total), 0);

  return {
    paidFromCommittedShare: shareOf(paid, committed),
    largestAgency: largestAgency
      ? { ...largestAgency, share: shareOf(Number(largestAgency.total), paid) ?? 0 }
      : null,
    topSuppliersShare: shareOf(topSuppliersTotal, paid),
    contractCoverageShare: shareOf(Number(input.linkedToContractTotal), paid),
    contractCoverageCountShare: shareOf(input.linkedToContractCount, input.paymentCount),
  };
}
