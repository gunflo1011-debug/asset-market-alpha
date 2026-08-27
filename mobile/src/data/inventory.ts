import { supabase } from '../lib/supabase';
import { trackAlphaEvent } from './analytics';
import { conditionArgs, thingArgs } from '../features/inventory/input';
import type {
  AddPrivateDeviceInput,
  CatalogVariant,
  ConditionInput,
  InventoryMarketState,
  PrivateInventoryItem,
  PrivateThingInput,
} from '../features/inventory/types';

export type {
  AddPrivateDeviceInput,
  CatalogVariant,
  ConditionInput,
  InventoryMarketState,
  PrivateInventoryItem,
  PrivateThingInput,
} from '../features/inventory/types';

function client() {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  return supabase;
}

export async function loadCatalog(): Promise<CatalogVariant[]> {
  const { data, error } = await client()
    .from('product_variants')
    .select('id, storage_gb, region, products(brand, family)')
    .order('storage_gb', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CatalogVariant[];
}

export async function loadPrivateInventory(): Promise<PrivateInventoryItem[]> {
  const inventoryRequest = client()
    .from('items')
    .select(`id, custom_name, category, location_label, notes, color, created_at, product_variants(id, storage_gb, region, products(brand, family)), condition_snapshots(display_state, housing_state, cameras_working, biometrics_working, battery_health, network_locked, other_defect, captured_at)`)
    .order('created_at', { ascending: false });

  const [inventoryResult, marketStateResult] = await Promise.all([
    inventoryRequest,
    client().rpc('load_my_inventory_market_states'),
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
    // Generic Things are protected directly by owner-scoped items RLS and do not have a market-state row.
    // Catalog-backed devices require authoritative market-state evidence; RPC failure or a missing row must fail closed.
    if (isCatalogDevice && marketStateResult.error) return [];
    const state = marketStates.get(item.id) ?? null;
    if (isCatalogDevice && !state) return [];
    if (state === 'SOLD') return [];
    return [{ ...item, market_state: state }];
  });

  void trackAlphaEvent('INVENTORY_VIEWED');
  return owned;
}

export async function addPrivateThing(input: PrivateThingInput): Promise<string> {
  const { data, error } = await client().rpc('add_private_thing', thingArgs(input));
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Thing command returned no item id.');
  return data;
}

export async function updatePrivateThing(itemId: string, input: PrivateThingInput): Promise<void> {
  const { error } = await client().rpc('update_private_thing', {
    p_item_id: itemId,
    ...thingArgs(input),
  });
  if (error) throw error;
}

export async function updatePrivateItemMetadata(itemId: string, input: PrivateThingInput): Promise<void> {
  const { error } = await client().rpc('update_private_item_metadata', {
    p_item_id: itemId,
    ...thingArgs(input),
  });
  if (error) throw error;
}

export async function deletePrivateThing(itemId: string): Promise<void> {
  const { error } = await client().rpc('delete_private_thing', { p_item_id: itemId });
  if (error) throw error;
}

export async function addPrivateDevice(input: AddPrivateDeviceInput): Promise<string> {
  const { data, error } = await client().rpc('add_private_device', {
    p_variant_id: input.variantId,
    ...conditionArgs(input),
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Inventory command returned no item id.');
  void trackAlphaEvent('DEVICE_ADDED', data);
  return data;
}

export async function updatePrivateDevice(itemId: string, input: ConditionInput): Promise<void> {
  const { error } = await client().rpc('update_private_device', {
    p_item_id: itemId,
    ...conditionArgs(input),
  });
  if (error) throw error;
}

export async function deletePrivateDevice(itemId: string): Promise<void> {
  const { error } = await client().rpc('delete_private_device', { p_item_id: itemId });
  if (error) throw error;
}
