import { trackAlphaEvent } from './analytics';
import { requireSupabase } from './supabaseClient';
import { conditionArgs, thingArgs } from '../features/inventory/input';
import type { AddPrivateDeviceInput, ConditionInput, MarketplaceConversationStatus, MarketplaceInterestStatus, MarketplaceListingStatus, PrivateThingInput, ValuationInput } from '../features/inventory/types';

export const MAX_FINAL_SALE_CENTS = 1_000_000_000;

export function extractConfirmedGtinFromNotes(notes: string | null | undefined): string | null {
  const match = notes?.match(/(?:^|\n)GTIN\/UPC:\s*(\d{8}|\d{12}|\d{13}|\d{14})(?=\n|$)/i);
  return match?.[1] ?? null;
}

export async function addPrivateThing(input: PrivateThingInput): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('add_private_thing', thingArgs(input));
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Thing command returned no item id.');

  // Scan suggestions are shown in the editable confirmation form first. Persist the
  // structured identity only after the user confirms that form by saving the Thing.
  // Keep the Thing save successful even if identity enrichment is temporarily
  // unavailable, otherwise a post-save RPC failure could encourage a duplicate add.
  const confirmedGtin = extractConfirmedGtinFromNotes(input.notes);
  if (confirmedGtin) {
    const { error: identityError } = await client.rpc('set_my_item_gtin_v1', {
      p_item_id: data,
      p_gtin: confirmedGtin,
      p_source: 'BARCODE_SCAN',
    });
    if (identityError) console.warn('Thing saved, but structured GTIN enrichment is delayed.', identityError.message);
  }

  return data;
}

export async function updatePrivateThing(itemId: string, input: PrivateThingInput): Promise<void> {
  const { error } = await requireSupabase().rpc('update_private_thing', { p_item_id: itemId, ...thingArgs(input) });
  if (error) throw error;
}

export async function updatePrivateItemMetadata(itemId: string, input: PrivateThingInput): Promise<void> {
  const { error } = await requireSupabase().rpc('update_private_item_metadata', { p_item_id: itemId, ...thingArgs(input) });
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
  const { data, error } = await requireSupabase().rpc('set_my_marketplace_interest', { p_item_id: itemId, p_interested: interested });
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
  const { data, error } = await requireSupabase().rpc('send_my_marketplace_message', { p_conversation_id: conversationId, p_body: trimmed });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Message command returned no message id.');
  return data;
}

export async function setMyMarketplaceConversationStatus(conversationId: string, status: 'RESERVED' | 'SOLD', finalSalePriceCents?: number | null): Promise<MarketplaceConversationStatus> {
  if (status === 'SOLD' && (!Number.isInteger(finalSalePriceCents) || (finalSalePriceCents ?? 0) <= 0 || (finalSalePriceCents ?? 0) > MAX_FINAL_SALE_CENTS)) {
    throw new Error('Enter a valid final sale price before marking this Thing sold.');
  }
  const { data, error } = await requireSupabase().rpc('set_my_marketplace_conversation_status_v2', {
    p_conversation_id: conversationId,
    p_status: status,
    p_final_sale_price_cents: status === 'SOLD' ? finalSalePriceCents : null,
  });
  if (error) throw error;
  if (data !== 'RESERVED' && data !== 'SOLD') throw new Error('Conversation lifecycle command returned an invalid state.');
  return data;
}

export async function adoptMySoldMarketplaceThing(conversationId: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('adopt_my_sold_marketplace_thing', { p_conversation_id: conversationId });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Purchased Thing adoption returned no item id.');
  return data;
}

export async function deletePrivateThing(itemId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_private_thing', { p_item_id: itemId });
  if (error) throw error;
}

export async function addPrivateDevice(input: AddPrivateDeviceInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('add_private_device', { p_variant_id: input.variantId, ...conditionArgs(input) });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Inventory command returned no item id.');
  void trackAlphaEvent('DEVICE_ADDED', data);
  return data;
}

export async function updatePrivateDevice(itemId: string, input: ConditionInput): Promise<void> {
  const { error } = await requireSupabase().rpc('update_private_device', { p_item_id: itemId, ...conditionArgs(input) });
  if (error) throw error;
}

export async function deletePrivateDevice(itemId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_private_device', { p_item_id: itemId });
  if (error) throw error;
}
