import {
  markItemSold,
  ownedInventoryItems,
  type OwnedInventoryItem,
  type SoldStateResult,
} from './soldState';

export type SoldItemSurface = {
  soldItemId: string;
  ownershipLabel: 'SOLD';
  ownershipMessage: string;
  countedAsOwned: false;
  countedInInventoryValue: false;
  ownedItemCount: number;
  knownOwnedValueCents: number;
  unvaluedOwnedItemCount: number;
};

export type SoldItemTransition = SoldStateResult & {
  surface: SoldItemSurface | null;
};

/**
 * Applies a completed sale and produces the minimum deterministic user-facing
 * trust surface. Sold items can remain available for future history/audit UI,
 * but this contract makes it explicit that they no longer count as owned or
 * contribute to the current inventory value.
 */
export function completeSaleWithTrustSurface(
  items: readonly OwnedInventoryItem[],
  soldItemId: string,
): SoldItemTransition {
  const result = markItemSold(items, soldItemId);
  const soldItem = result.items.find(
    (item) => item.itemId === soldItemId && item.ownershipState === 'sold',
  );

  if (!soldItem) {
    return { ...result, surface: null };
  }

  const ownedItems = ownedInventoryItems(result.items);
  return {
    ...result,
    surface: {
      soldItemId,
      ownershipLabel: 'SOLD',
      ownershipMessage: 'Sold · removed from owned inventory and total value',
      countedAsOwned: false,
      countedInInventoryValue: false,
      ownedItemCount: ownedItems.length,
      knownOwnedValueCents: result.valueSummary.knownValueCents,
      unvaluedOwnedItemCount: result.valueSummary.unvaluedItemCount,
    },
  };
}
