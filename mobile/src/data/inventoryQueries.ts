import { trackAlphaEvent } from './analytics';
import { requireSupabase } from './supabaseClient';
import type { CatalogVariant, InventoryMarketState, PrivateInventoryItem } from '../features/inventory/types';

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

  const [inventoryResult, marketStateResult] = await Promise.all([
    inventoryRequest,
    requireSupabase().rpc('load_my_inventory_market_states'),
  ]);

  if (inventoryResult.error) throw inventoryResult.error;

  const marketStates = new Map<string, InventoryMarketState>();
  if (!marketStateResult.error) {
    for (const row of (marketStateResult.data ?? []) as Array<{ item_id: string; market_state: InventoryMarketState }>) {
      marketStates.set(row.item_id, row.market_state);
    }
  }

  const items = (inventoryResult.data ?? []) as unknown as Array<Omit<PrivateInventoryItem, 'market_state'>>;
  const owned = items.flatMap((item) => {
    const isCatalogDevice = item.product_variants !== null;
    if (isCatalogDevice && marketStateResult.error) return [];
    const state = marketStates.get(item.id) ?? null;
    if (isCatalogDevice && !state) return [];
    if (state === 'SOLD') return [];
    return [{ ...item, market_state: state }];
  });

  void trackAlphaEvent('INVENTORY_VIEWED');
  return owned;
}
