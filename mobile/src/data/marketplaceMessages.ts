import { requireSupabase } from './supabaseClient';
import type { MarketplaceMessage } from '../features/inventory/types';

const DEFAULT_MESSAGE_WINDOW = 100;

export async function loadMyMarketplaceMessages(conversationId: string): Promise<MarketplaceMessage[]> {
  const { data, error } = await requireSupabase().rpc('load_my_marketplace_messages_v2', {
    p_conversation_id: conversationId,
    p_limit: DEFAULT_MESSAGE_WINDOW,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    message_id: String(row.message_id),
    sender_role: row.sender_role as MarketplaceMessage['sender_role'],
    body: String(row.body),
    created_at: String(row.created_at),
  }));
}
