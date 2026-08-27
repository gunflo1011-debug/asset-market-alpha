import type { CatalogVariant, PrivateInventoryItem } from './types';

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
