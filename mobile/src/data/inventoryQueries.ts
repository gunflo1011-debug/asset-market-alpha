import { trackAlphaEvent } from './analytics';
import { requireSupabase } from './supabaseClient';
import type { CatalogVariant, InventoryMarketState, InventoryValueEvidence, MarketplaceListing, OwnerMarketplaceListing, PrivateInventoryItem } from '../features/inventory/types';

export async function loadCatalog(): Promise<CatalogVariant[]> {
  const { data, error } = await requireSupabase()
    .from('product_variants')
    .select('id, storage_gb, region, products(brand, family)')
    .order('storage_gb', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CatalogVariant[];
}

export async function loadPrivateInventory(): Promise<PrivateInventoryItem[]> {
  const inventoryRequest = requireSupabase()
    .from('items')
    .select(`id, custom_name, category, location_label, notes, color, created_at, product_variants(id, storage_gb, region, products(brand, family)), condition_snapshots(display_state, housing_state, cameras_working, biometrics_working, battery_health, network_locked, other_defect, captured_at)`)
    .order('created_at', { ascending: false });

  const [inventoryResult, marketStateResult, valueResult] = await Promise.all([
    inventoryRequest,
    requireSupabase().rpc('load_my_inventory_market_states'),
    requireSupabase().rpc('load_my_inventory_values'),
  ]);

  if (inventoryResult.error) throw inventoryResult.error;

  const marketStates = new Map<string, InventoryMarketState>();
  if (!marketStateResult.error) {
    for (const row of (marketStateResult.data ?? []) as Array<{ item_id: string; market_state: InventoryMarketState }>) {
      marketStates.set(row.item_id, row.market_state);
    }
  }

  const values = new Map<string, InventoryValueEvidence>();
  if (!valueResult.error) {
    for (const row of (valueResult.data ?? []) as Array<InventoryValueEvidence & { item_id: string }>) {
      values.set(row.item_id, {
        estimated_value_cents: Number(row.estimated_value_cents),
        currency: row.currency,
        source_type: row.source_type,
        observed_at: row.observed_at,
      });
    }
  }

  const items = (inventoryResult.data ?? []) as unknown as Array<Omit<PrivateInventoryItem, 'market_state' | 'value_evidence'>>;
  const owned = items.flatMap((item) => {
    const isCatalogDevice = item.product_variants !== null;
    if (isCatalogDevice && marketStateResult.error) return [];
    const state = marketStates.get(item.id) ?? null;
    if (isCatalogDevice && !state) return [];
    if (state === 'SOLD') return [];
    return [{ ...item, market_state: state, value_evidence: values.get(item.id) ?? null }];
  });

  void trackAlphaEvent('INVENTORY_VIEWED');
  return owned;
}

export async function loadMyMarketplaceListings(): Promise<OwnerMarketplaceListing[]> {
  const { data, error } = await requireSupabase().rpc('load_my_marketplace_listings');
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    item_id: String(row.item_id),
    asking_price_cents: Number(row.asking_price_cents),
    status: row.status as OwnerMarketplaceListing['status'],
    published_at: row.published_at ? String(row.published_at) : null,
  }));
}

export async function loadMarketplace(): Promise<MarketplaceListing[]> {
  const { data, error } = await requireSupabase().rpc('load_marketplace_v1');
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    item_id: String(row.item_id),
    title: String(row.title ?? 'Thing'),
    category: String(row.category ?? 'Other'),
    asking_price_cents: Number(row.asking_price_cents),
    estimated_value_cents: row.estimated_value_cents == null ? null : Number(row.estimated_value_cents),
    condition_label: row.condition_label == null ? null : String(row.condition_label),
    published_at: row.published_at == null ? null : String(row.published_at),
  }));
}
