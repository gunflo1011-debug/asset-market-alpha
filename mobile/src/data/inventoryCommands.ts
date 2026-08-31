import { trackAlphaEvent } from './analytics';
import { requireSupabase } from './supabaseClient';
import { conditionArgs, thingArgs } from '../features/inventory/input';
import type { AddPrivateDeviceInput, ConditionInput, MarketplaceConversationStatus, MarketplaceInterestStatus, MarketplaceListingStatus, PrivateThingInput, ValuationInput } from '../features/inventory/types';

export async function addPrivateThing(input: PrivateThingInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('add_private_thing', thingArgs(input));
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Thing command returned no item id.');
  return data;
}

export async function updatePrivateThing(itemId: string, input: PrivateThingInput): Promise<void> {
  const { error } = await requireSupabase().rpc('update_private_thing', {
    p_item_id: itemId,
    ...thingArgs(input),
  });
  if (error) throw error;
}

export async function updatePrivateItemMetadata(itemId: string, input: PrivateThingInput): Promise<void> {
  const { error } = await requireSupabase().rpc('update_private_item_metadata', {
    p_item_id: itemId,
    ...thingArgs(input),
  });
  if (error) throw error;
}

export async function estimatePrivateItemValue(itemId: string, input: ValuationInput): Promise<number> {
  const { data, error } = await requireSupabase().rpc('estimate_my_item_value_v1', {
    p_item_id: itemId,
    p_purchase_price_cents: input.purchasePriceCents,
    p_purchase_year: input.purchaseYear,
    p_condition_grade: input.conditionGrade,
  });
  if (error) throw error;
  const cents = Number(data);
  if (!Number.isFinite(cents) || cents < 0) throw new Error('Value estimate returned an invalid amount.');
  return cents;
}

export async function saveMyMarketplaceListing(itemId: string, askingPriceCents: number, publish: boolean, publicLocation?: string | null): Promise<MarketplaceListingStatus> {
  const { data, error } = await requireSupabase().rpc('save_my_marketplace_listing_v2', {
    p_item_id: itemId,
    p_asking_price_cents: askingPriceCents,
    p_publish: publish,
    p_public_location: publicLocation?.trim() || null,
  });
  if (error) throw error;
  if (data !== 'DRAFT' && data !== 'PUBLISHED' && data !== 'WITHDRAWN') throw new Error('Listing command returned an invalid state.');
  return data;
}

export async function withdrawMyMarketplaceListing(itemId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('withdraw_my_marketplace_listing', { p_item_id: itemId });
  if (error) throw error;
}

export async function setMyMarketplaceInterest(itemId: string, interested: boolean): Promise<MarketplaceInterestStatus> {
  const { data, error } = await requireSupabase().rpc('set_my_marketplace_interest', {
    p_item_id: itemId,
    p_interested: interested,
  });
  if (error) throw error;
  if (data !== 'INTERESTED' && data !== 'WITHDRAWN') throw new Error('Interest command returned an invalid state.');
  return data;
}

export async function openMyMarketplaceConversation(itemId: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('open_my_marketplace_conversation', { p_item_id: itemId });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Conversation command returned no conversation id.');
  return data;
}

export async function sendMyMarketplaceMessage(conversationId: string, body: string): Promise<string> {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 1200) throw new Error('Message must be between 1 and 1200 characters.');
  const { data, error } = await requireSupabase().rpc('send_my_marketplace_message', {
    p_conversation_id: conversationId,
    p_body: trimmed,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Message command returned no message id.');
  return data;
}

export async function setMyMarketplaceConversationStatus(conversationId: string, status: 'RESERVED' | 'SOLD'): Promise<MarketplaceConversationStatus> {
  const { data, error } = await requireSupabase().rpc('set_my_marketplace_conversation_status', {
    p_conversation_id: conversationId,
    p_status: status,
  });
  if (error) throw error;
  if (data !== 'RESERVED' && data !== 'SOLD') throw new Error('Conversation lifecycle command returned an invalid state.');
  return data;
}

export async function deletePrivateThing(itemId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_private_thing', { p_item_id: itemId });
  if (error) throw error;
}

export async function addPrivateDevice(input: AddPrivateDeviceInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('add_private_device', {
    p_variant_id: input.variantId,
    ...conditionArgs(input),
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Inventory command returned no item id.');
  void trackAlphaEvent('DEVICE_ADDED', data);
  return data;
}

export async function updatePrivateDevice(itemId: string, input: ConditionInput): Promise<void> {
  const { error } = await requireSupabase().rpc('update_private_device', {
    p_item_id: itemId,
    ...conditionArgs(input),
  });
  if (error) throw error;
}

export async function deletePrivateDevice(itemId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_private_device', { p_item_id: itemId });
  if (error) throw error;
}
