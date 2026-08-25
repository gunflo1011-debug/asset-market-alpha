import { supabase } from '../lib/supabase';
import { trackAlphaEvent } from './analytics';

export type CatalogVariant = {
  id: string;
  storage_gb: number | null;
  region: string;
  products: {
    brand: string;
    family: string;
  } | null;
};

export type InventoryMarketState = 'PRIVATE' | 'OFFERS_ENABLED' | 'MARKET_ELIGIBLE' | 'ACTIVATING' | 'RESERVED' | 'SOLD' | 'UNKNOWN';

export type PrivateInventoryItem = {
  id: string;
  color: string | null;
  created_at: string;
  market_state: InventoryMarketState;
  product_variants: {
    id: string;
    storage_gb: number | null;
    region: string;
    products: {
      brand: string;
      family: string;
    } | null;
  } | null;
  condition_snapshots: Array<{
    display_state: 'INTACT' | 'DAMAGED';
    housing_state: 'CLEAN' | 'LIGHT_WEAR' | 'HEAVY_WEAR' | 'DAMAGED';
    cameras_working: boolean;
    biometrics_working: boolean;
    battery_health: number | null;
    network_locked: boolean | null;
    other_defect: boolean;
    captured_at: string;
  }>;
};

export type AddPrivateDeviceInput = {
  variantId: string;
  color?: string;
  displayState?: 'INTACT' | 'DAMAGED';
  housingState?: 'CLEAN' | 'LIGHT_WEAR' | 'HEAVY_WEAR' | 'DAMAGED';
  camerasWorking?: boolean;
  biometricsWorking?: boolean;
  batteryHealth?: number | null;
  networkLocked?: boolean;
  otherDefect?: boolean;
};

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured for this build.');
  }
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
    .select(`
      id,
      color,
      created_at,
      product_variants(
        id,
        storage_gb,
        region,
        products(brand, family)
      ),
      condition_snapshots(
        display_state,
        housing_state,
        cameras_working,
        biometrics_working,
        battery_health,
        network_locked,
        other_defect,
        captured_at
      )
    `)
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
  void trackAlphaEvent('INVENTORY_VIEWED');
  return items.map((item) => ({
    ...item,
    market_state: marketStates.get(item.id) ?? 'UNKNOWN',
  }));
}

export async function addPrivateDevice(input: AddPrivateDeviceInput): Promise<string> {
  const { data, error } = await client().rpc('add_private_device', {
    p_variant_id: input.variantId,
    p_color: input.color ?? null,
    p_display_state: input.displayState ?? 'INTACT',
    p_housing_state: input.housingState ?? 'CLEAN',
    p_cameras_working: input.camerasWorking ?? true,
    p_biometrics_working: input.biometricsWorking ?? true,
    p_battery_health: input.batteryHealth ?? null,
    p_network_locked: input.networkLocked ?? false,
    p_other_defect: input.otherDefect ?? false,
  });

  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Inventory command returned no item id.');

  void trackAlphaEvent('DEVICE_ADDED', data);
  return data;
}
