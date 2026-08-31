import { trackAlphaEvent } from './analytics';
import { loadMarketplaceImageRefs } from './itemImages';
import { requireSupabase } from './supabaseClient';
import type { CatalogVariant, InventoryMarketState, InventoryValueEvidence, MarketplaceConversation, MarketplaceInterest, MarketplaceInterestSummary, MarketplaceListing, MarketplaceMessage, OwnerMarketplaceListing, PrivateInventoryItem } from '../features/inventory/types';

export type MarketValueInsight = {
  marketValueCents: number | null;
  sampleCount: number;
  source: 'SOLD_MEDIAN' | 'ACTIVE_MEDIAN' | 'INSUFFICIENT_DATA';
};

export async function loadCatalog(): Promise<CatalogVariant[]> {
  const { data, error } = await requireSupabase().from('product_variants').select('id, storage_gb, region, products(brand, family)').order('storage_gb', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CatalogVariant[];
}

export async function loadPrivateInventory(): Promise<PrivateInventoryItem[]> {
  const inventoryRequest = requireSupabase().from('items').select(`id, custom_name, category, location_label, notes, color, created_at, product_variants(id, storage_gb, region, products(brand, family)), condition_snapshots(display_state, housing_state, cameras_working, biometrics_working, battery_health, network_locked, other_defect, captured_at)`).order('created_at', { ascending: false });
  const [inventoryResult, marketStateResult, valueResult] = await Promise.all([
    inventoryRequest,
    requireSupabase().rpc('load_my_inventory_market_states'),
    requireSupabase().rpc('load_my_inventory_values'),
  ]);
  if (inventoryResult.error) throw inventoryResult.error;
  const marketStates = new Map<string, InventoryMarketState>();
  if (!marketStateResult.error) for (const row of (marketStateResult.data ?? []) as Array<{ item_id: string; market_state: InventoryMarketState }>) marketStates.set(row.item_id, row.market_state);
  const values = new Map<string, InventoryValueEvidence>();
  if (!valueResult.error) for (const row of (valueResult.data ?? []) as Array<InventoryValueEvidence & { item_id: string }>) values.set(row.item_id, { estimated_value_cents: Number(row.estimated_value_cents), currency: row.currency, source_type: row.source_type, observed_at: row.observed_at });
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
  const { data, error } = await requireSupabase().rpc('load_my_marketplace_listings_v2');
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    item_id: String(row.item_id),
    title: String(row.title ?? 'Thing'),
    category: String(row.category ?? 'Other'),
    asking_price_cents: Number(row.asking_price_cents),
    public_location: row.public_location == null ? null : String(row.public_location),
    status: row.status as OwnerMarketplaceListing['status'],
    published_at: row.published_at ? String(row.published_at) : null,
  }));
}

export async function loadMarketplace(): Promise<MarketplaceListing[]> {
  const { data, error } = await requireSupabase().rpc('load_marketplace_v2');
  if (error) throw error;

  const imageUrls = new Map<string, string[]>();
  try {
    const refs = await loadMarketplaceImageRefs();
    for (const ref of refs) {
      const current = imageUrls.get(ref.itemId) ?? [];
      current.push(ref.signedUrl);
      imageUrls.set(ref.itemId, current);
    }
  } catch {
    // Listings remain usable when optional photo delivery is temporarily unavailable.
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const itemId = String(row.item_id);
    return {
      item_id: itemId,
      title: String(row.title ?? 'Thing'),
      category: String(row.category ?? 'Other'),
      asking_price_cents: Number(row.asking_price_cents),
      estimated_value_cents: row.estimated_value_cents == null ? null : Number(row.estimated_value_cents),
      condition_label: row.condition_label == null ? null : String(row.condition_label),
      public_location: row.public_location == null ? null : String(row.public_location),
      published_at: row.published_at == null ? null : String(row.published_at),
      image_urls: imageUrls.get(itemId) ?? [],
    };
  });
}

export async function loadMarketValueForMyItem(itemId: string): Promise<MarketValueInsight> {
  const { data, error } = await requireSupabase().rpc('load_my_market_value_v1', { p_item_id: itemId });
  if (error) throw error;
  const row = ((data ?? []) as Array<Record<string, unknown>>)[0];
  if (!row) return { marketValueCents: null, sampleCount: 0, source: 'INSUFFICIENT_DATA' };
  const source = row.source === 'SOLD_MEDIAN' || row.source === 'ACTIVE_MEDIAN' ? row.source : 'INSUFFICIENT_DATA';
  const marketValueCents = row.market_value_cents == null ? null : Number(row.market_value_cents);
  return {
    marketValueCents: Number.isFinite(marketValueCents) ? marketValueCents : null,
    sampleCount: Math.max(0, Number(row.sample_count ?? 0) || 0),
    source,
  };
}

export async function loadMyMarketplaceInterests(): Promise<MarketplaceInterest[]> {
  const { data, error } = await requireSupabase().rpc('load_my_marketplace_interests');
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({ item_id: String(row.item_id), status: row.status as MarketplaceInterest['status'], updated_at: String(row.updated_at) }));
}

export async function loadInterestSummaryForMyListings(): Promise<MarketplaceInterestSummary[]> {
  const { data, error } = await requireSupabase().rpc('load_interest_summary_for_my_listings');
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({ item_id: String(row.item_id), interested_count: Number(row.interested_count ?? 0), latest_interest_at: row.latest_interest_at == null ? null : String(row.latest_interest_at) }));
}

export async function loadMyMarketplaceConversations(): Promise<MarketplaceConversation[]> {
  const { data, error } = await requireSupabase().rpc('load_my_marketplace_conversations');
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    conversation_id: String(row.conversation_id),
    item_id: String(row.item_id),
    role: row.role as MarketplaceConversation['role'],
    status: row.status as MarketplaceConversation['status'],
    updated_at: String(row.updated_at),
  }));
}

export async function loadMyMarketplaceMessages(conversationId: string): Promise<MarketplaceMessage[]> {
  const { data, error } = await requireSupabase().rpc('load_my_marketplace_messages', { p_conversation_id: conversationId });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    message_id: String(row.message_id),
    sender_role: row.sender_role as MarketplaceMessage['sender_role'],
    body: String(row.body),
    created_at: String(row.created_at),
  }));
}
