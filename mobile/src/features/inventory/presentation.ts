import type { CatalogVariant, InventoryMarketState, PrivateInventoryItem } from './types';

export type InventoryLifecyclePresentation = {
  label: 'Private' | 'Ready to list' | 'Publishing' | 'For sale' | 'Reserved' | 'Sold';
  accessibilityLabel: string;
  isPubliclyForSale: boolean;
};

export type InventoryLifecycleFilter = 'ALL' | 'PRIVATE' | 'FOR_SALE' | 'RESERVED';

export function inventoryLifecyclePresentation(
  state: InventoryMarketState | null | undefined,
): InventoryLifecyclePresentation {
  switch (state) {
    case 'MARKET_ELIGIBLE':
      return {
        label: 'Ready to list',
        accessibilityLabel: 'Ready to list, not yet public',
        isPubliclyForSale: false,
      };
    case 'ACTIVATING':
      return {
        label: 'Publishing',
        accessibilityLabel: 'Publishing to Marketplace',
        isPubliclyForSale: false,
      };
    case 'OFFERS_ENABLED':
      return {
        label: 'For sale',
        accessibilityLabel: 'For sale on Marketplace',
        isPubliclyForSale: true,
      };
    case 'RESERVED':
      return {
        label: 'Reserved',
        accessibilityLabel: 'Reserved for a buyer',
        isPubliclyForSale: false,
      };
    case 'SOLD':
      return {
        label: 'Sold',
        accessibilityLabel: 'Sold',
        isPubliclyForSale: false,
      };
    case 'PRIVATE':
    default:
      return {
        label: 'Private',
        accessibilityLabel: 'Private, not listed',
        isPubliclyForSale: false,
      };
  }
}

export function matchesInventoryLifecycleFilter(
  state: InventoryMarketState | null | undefined,
  filter: InventoryLifecycleFilter,
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'FOR_SALE') return inventoryLifecyclePresentation(state).isPubliclyForSale;
  if (filter === 'RESERVED') return state === 'RESERVED';
  return state == null || state === 'PRIVATE';
}

export function variantTitle(variant: CatalogVariant): string {
  const product = variant.products;
  const base = product ? `${product.brand} ${product.family}` : 'Device';
  return `${base}${variant.storage_gb ? ` · ${variant.storage_gb} GB` : ''}`;
}

export function itemTitle(item: PrivateInventoryItem): string {
  if (item.custom_name?.trim()) return item.custom_name.trim();
  const variant = item.product_variants;
  const product = variant?.products;
  if (!variant || !product) return 'Thing';
  return `${product.brand} ${product.family}${variant.storage_gb ? ` · ${variant.storage_gb} GB` : ''}`;
}

export function savedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved privately';
  return `Saved ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function friendlyInventoryError(error: unknown): string {
  const raw = error instanceof Error ? error.message.toLowerCase() : '';
  if (raw.includes('jwt') || raw.includes('auth')) return 'Your session needs to be refreshed. Sign out and sign in again.';
  if (raw.includes('network') || raw.includes('fetch')) return 'Things could not reach the service. Check your connection and try again.';
  return 'Your inventory could not be loaded. Your data is still private. Try again in a moment.';
}
