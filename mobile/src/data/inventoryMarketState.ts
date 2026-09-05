import { requireSupabase } from './supabaseClient';
import type { InventoryMarketState } from '../features/inventory/types';

export async function loadMyInventoryMarketState(itemId: string): Promise<InventoryMarketState | null> {
  const { data, error } = await requireSupabase().rpc('load_my_inventory_market_states');
  if (error) throw error;

  const row = ((data ?? []) as Array<{ item_id: string; market_state: InventoryMarketState }>).find(
    (candidate) => candidate.item_id === itemId,
  );
  return row?.market_state ?? null;
}
