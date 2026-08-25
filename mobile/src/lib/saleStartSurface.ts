import { createSellIntent, SellIntent } from './valueToSell';

export type SaleStartSurface = {
  intent: SellIntent;
  valueLabel: string;
  actionLabel: 'Start selling';
  privacyNotice: string;
};

function formatEuroCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/**
 * Builds the smallest user-facing hand-off from a private inventory item into
 * sale initiation. Unknown value evidence stays explicit and never becomes a
 * made-up price. Creating this surface does not publish or sell the item.
 */
export function buildSaleStartSurface(itemId: string, estimatedValueCents: number | null): SaleStartSurface {
  const intent = createSellIntent({ itemId, estimatedValueCents });

  return {
    intent,
    valueLabel: intent.valueEvidence === 'KNOWN' && intent.referenceValueCents != null
      ? `Estimated value ${formatEuroCents(intent.referenceValueCents)}`
      : 'Estimated value not available yet',
    actionLabel: 'Start selling',
    privacyNotice: 'Nothing is listed or sold until you explicitly continue.',
  };
}
