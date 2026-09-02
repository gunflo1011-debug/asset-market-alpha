import { requireSupabase } from './supabaseClient';
import type { MarketplaceOffer, MarketplaceOfferResponseAction } from '../features/inventory/types';

export const MAX_OFFER_CENTS = 100_000_000_000;
const MAX_OFFER_MESSAGE_LENGTH = 500;

function assertOfferAmount(amountCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_OFFER_CENTS) {
    throw new Error('Offer amount must be a positive whole number of cents.');
  }
}

function normalizeOfferMessage(message?: string | null): string | null {
  if (message == null) return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_OFFER_MESSAGE_LENGTH) throw new Error('Offer message must be 500 characters or fewer.');
  return trimmed;
}

function mapOffer(row: Record<string, unknown>): MarketplaceOffer {
  const amountCents = Number(row.amount_cents);
  if (!Number.isInteger(amountCents) || amountCents < 1) throw new Error('Offer history returned an invalid amount.');
  if (row.proposer_role !== 'ME' && row.proposer_role !== 'OTHER') throw new Error('Offer history returned an invalid proposer role.');
  if (row.status !== 'PENDING' && row.status !== 'ACCEPTED' && row.status !== 'DECLINED' && row.status !== 'COUNTERED') {
    throw new Error('Offer history returned an invalid status.');
  }
  return {
    offer_id: String(row.offer_id),
    proposer_role: row.proposer_role,
    amount_cents: amountCents,
    message: row.message == null ? null : String(row.message),
    status: row.status,
    parent_offer_id: row.parent_offer_id == null ? null : String(row.parent_offer_id),
    created_at: String(row.created_at),
    responded_at: row.responded_at == null ? null : String(row.responded_at),
  };
}

export async function loadMyMarketplaceOffers(conversationId: string): Promise<MarketplaceOffer[]> {
  const { data, error } = await requireSupabase().rpc('load_my_marketplace_offers', { p_conversation_id: conversationId });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapOffer);
}

export async function makeMyMarketplaceOffer(conversationId: string, amountCents: number, message?: string | null): Promise<string> {
  assertOfferAmount(amountCents);
  const { data, error } = await requireSupabase().rpc('make_my_marketplace_offer', {
    p_conversation_id: conversationId,
    p_amount_cents: amountCents,
    p_message: normalizeOfferMessage(message),
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Offer command returned no offer id.');
  return data;
}

export async function respondToMyMarketplaceOffer(
  offerId: string,
  action: MarketplaceOfferResponseAction,
  counterAmountCents?: number | null,
  counterMessage?: string | null,
): Promise<string> {
  if (action === 'COUNTER') {
    if (counterAmountCents == null) throw new Error('Counter offer amount is required.');
    assertOfferAmount(counterAmountCents);
  }
  const { data, error } = await requireSupabase().rpc('respond_to_my_marketplace_offer', {
    p_offer_id: offerId,
    p_action: action,
    p_counter_amount_cents: action === 'COUNTER' ? counterAmountCents : null,
    p_counter_message: action === 'COUNTER' ? normalizeOfferMessage(counterMessage) : null,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Offer response returned no offer id.');
  return data;
}
