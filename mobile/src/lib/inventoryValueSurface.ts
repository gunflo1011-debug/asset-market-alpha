import { InventoryValueInput, summarizeInventoryValue } from './inventoryValue';

export type InventoryValueSurface = {
  knownValueLabel: string;
  coverageLabel: string;
  isComplete: boolean;
};

export function buildInventoryValueSurface(items: readonly InventoryValueInput[]): InventoryValueSurface {
  const summary = summarizeInventoryValue(items);
  const euros = (summary.knownValueCents / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });

  if (summary.totalItemCount === 0) {
    return {
      knownValueLabel: 'Known inventory value: no owned items yet',
      coverageLabel: 'No value evidence available yet.',
      isComplete: false,
    };
  }

  if (summary.unvaluedItemCount > 0) {
    return {
      knownValueLabel: `Known inventory value: ${euros}`,
      coverageLabel: `${summary.unvaluedItemCount} of ${summary.totalItemCount} owned item${summary.totalItemCount === 1 ? '' : 's'} still ${summary.unvaluedItemCount === 1 ? 'has' : 'have'} unknown value. Unknown values are not counted as €0.`,
      isComplete: false,
    };
  }

  return {
    knownValueLabel: `Total inventory value: ${euros}`,
    coverageLabel: `Verified value coverage: ${summary.valuedItemCount}/${summary.totalItemCount} owned items.`,
    isComplete: true,
  };
}
