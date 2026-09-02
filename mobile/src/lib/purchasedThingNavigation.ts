type PurchasedThingNavigationListener = (itemId: string) => void;

let listener: PurchasedThingNavigationListener | null = null;

export function subscribeToPurchasedThingNavigation(nextListener: PurchasedThingNavigationListener): () => void {
  listener = nextListener;
  return () => {
    if (listener === nextListener) listener = null;
  };
}

export function viewPurchasedThingInInventory(itemId: string): void {
  listener?.(itemId);
}
