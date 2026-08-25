export type InventoryValueInput = {
  itemId: string;
  estimatedValueCents: number | null;
};

export type InventoryValueSummary = {
  knownValueCents: number;
  valuedItemCount: number;
  unvaluedItemCount: number;
  totalItemCount: number;
  coveragePercent: number;
};

/**
 * Summarizes only explicit value evidence.
 *
 * Missing estimates remain unknown instead of being coerced to zero. This is
 * intentionally fail-closed so the UI can never imply a made-up portfolio
 * value while market-price evidence is unavailable.
 */
export function summarizeInventoryValue(items: readonly InventoryValueInput[]): InventoryValueSummary {
  let knownValueCents = 0;
  let valuedItemCount = 0;

  for (const item of items) {
    const value = item.estimatedValueCents;
    if (value == null || !Number.isFinite(value) || value < 0) continue;
    knownValueCents += Math.round(value);
    valuedItemCount += 1;
  }

  const totalItemCount = items.length;
  const unvaluedItemCount = totalItemCount - valuedItemCount;
  const coveragePercent = totalItemCount === 0 ? 0 : Math.round((valuedItemCount / totalItemCount) * 100);

  return {
    knownValueCents,
    valuedItemCount,
    unvaluedItemCount,
    totalItemCount,
    coveragePercent,
  };
}

export function canShowTotalInventoryValue(summary: InventoryValueSummary): boolean {
  return summary.totalItemCount > 0 && summary.unvaluedItemCount === 0;
}
