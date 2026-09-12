import { requireSupabase } from './supabaseClient';
import type { MarketplaceMessage } from '../features/inventory/types';

const DEFAULT_MESSAGE_WINDOW = 100;

type MarketplaceMessagePage = {
  messages: MarketplaceMessage[];
  hasOlder: boolean;
};

function mapMarketplaceMessage(row: Record<string, unknown>): MarketplaceMessage {
  return {
    message_id: String(row.message_id),
    sender_role: row.sender_role as MarketplaceMessage['sender_role'],
    body: String(row.body),
    created_at: String(row.created_at),
  };
}

export async function loadMyMarketplaceMessagePage(
  conversationId: string,
  before?: MarketplaceMessage | null,
): Promise<MarketplaceMessagePage> {
  const { data, error } = await requireSupabase().rpc('load_my_marketplace_messages_v3', {
    p_conversation_id: conversationId,
    p_before_created_at: before?.created_at ?? null,
    p_before_message_id: before?.message_id ?? null,
    p_limit: DEFAULT_MESSAGE_WINDOW + 1,
  });
  if (error) throw error;
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map(mapMarketplaceMessage);
  const hasOlder = rows.length > DEFAULT_MESSAGE_WINDOW;
  return {
    messages: hasOlder ? rows.slice(rows.length - DEFAULT_MESSAGE_WINDOW) : rows,
    hasOlder,
  };
}

export async function loadMyMarketplaceMessages(conversationId: string): Promise<MarketplaceMessage[]> {
  return (await loadMyMarketplaceMessagePage(conversationId)).messages;
}
