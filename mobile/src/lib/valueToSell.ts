export type ValueToSellInput = {
  itemId: string;
  estimatedValueCents: number | null;
};

export type SellIntent = {
  itemId: string;
  referenceValueCents: number | null;
  valueEvidence: 'KNOWN' | 'UNKNOWN';
};

/**
 * Creates the smallest deterministic hand-off from inventory value to selling.
 *
 * A missing/invalid estimate never blocks selling and is never coerced to zero;
 * callers can start the sale while clearly preserving that value evidence is
 * unknown.
 */
export function createSellIntent(input: ValueToSellInput): SellIntent {
  const value = input.estimatedValueCents;
  const hasKnownValue = value != null && Number.isFinite(value) && value >= 0;

  return {
    itemId: input.itemId,
    referenceValueCents: hasKnownValue ? Math.round(value) : null,
    valueEvidence: hasKnownValue ? 'KNOWN' : 'UNKNOWN',
  };
}
