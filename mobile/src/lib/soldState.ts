import { summarizeInventoryValue, type InventoryValueInput, type InventoryValueSummary } from './inventoryValue';

export type OwnedInventoryItem = InventoryValueInput & {
  ownershipState?: 'owned' | 'sold';
};

export type SoldStateResult = {
  items: OwnedInventoryItem[];
  valueSummary: InventoryValueSummary;
  changed: boolean;
};

/**
 * Applies the minimum local post-sale ownership transition.
 *
 * Sold items remain representable for future history/audit UI, but they are
 * excluded from the owned inventory and its value summary immediately. This
 * keeps ownership/value views consistent without collecting any new data.
 */
export function markItemSold(
  items: readonly OwnedInventoryItem[],
  soldItemId: string,
): SoldStateResult {
  let changed = false;
  const nextItems = items.map((item) => {
    if (item.itemId !== soldItemId || item.ownershipState === 'sold') return { ...item };
    changed = true;
    return { ...item, ownershipState: 'sold' as const };
  });

  const ownedItems = nextItems.filter((item) => item.ownershipState !== 'sold');
  return {
    items: nextItems,
    valueSummary: summarizeInventoryValue(ownedItems),
    changed,
  };
}

export function ownedInventoryItems(items: readonly OwnedInventoryItem[]): OwnedInventoryItem[] {
  return items.filter((item) => item.ownershipState !== 'sold');
}
