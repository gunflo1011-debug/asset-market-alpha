export type MarketplaceFailureAction =
  | 'LOAD_CONVERSATION'
  | 'SEND_MESSAGE'
  | 'UPDATE_OFFER'
  | 'UPDATE_SALE'
  | 'ADOPT_PURCHASE';

const MARKETPLACE_FAILURE_COPY: Record<MarketplaceFailureAction, string> = {
  LOAD_CONVERSATION: "Things couldn't load this conversation right now. Check your connection and try again.",
  SEND_MESSAGE: "Message wasn't sent. Check your connection and try again.",
  UPDATE_OFFER: "Things couldn't update this offer right now. Try again.",
  UPDATE_SALE: "Things couldn't update this sale right now. Try again.",
  ADOPT_PURCHASE: "Things couldn't add this purchase to My Things right now. Try again.",
};

/**
 * User-visible Marketplace failures must never depend on raw provider/RPC/database
 * exception text. Callers can log diagnostics separately, but rendered copy stays
 * stable and action-specific so retries remain understandable and privacy-safe.
 */
export function marketplaceFailureMessage(action: MarketplaceFailureAction): string {
  return MARKETPLACE_FAILURE_COPY[action];
}
