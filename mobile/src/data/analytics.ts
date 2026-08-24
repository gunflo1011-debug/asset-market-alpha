import { supabase } from '../lib/supabase';

export type AlphaEventName =
  | 'SESSION_RESTORED'
  | 'SIGN_IN_SUCCEEDED'
  | 'SIGN_UP_REQUESTED'
  | 'PASSWORD_RECOVERY_SUCCEEDED'
  | 'INVENTORY_VIEWED'
  | 'DEVICE_ADDED'
  | 'ITEM_CAPTURE_STARTED'
  | 'ITEM_CAPTURE_COMPLETED'
  | 'VALUE_VIEWED'
  | 'TOTAL_VALUE_VIEWED'
  | 'SELL_FLOW_STARTED'
  | 'SELL_FLOW_COMPLETED';

/**
 * Best-effort, privacy-minimal product telemetry.
 *
 * Event names describe only core-loop progression. Deliberately sends no email,
 * free text, value/price, location, condition, catalog identity, device
 * fingerprint or advertising identifier. Optional item ids are owner-bound by
 * the server RPC. Product flows must never fail because telemetry did.
 */
export async function trackAlphaEvent(
  eventName: AlphaEventName,
  itemId?: string | null,
): Promise<void> {
  if (!supabase) return;

  try {
    const { error } = await supabase.rpc('track_alpha_event', {
      p_event_name: eventName,
      p_item_id: itemId ?? null,
    });

    if (error) {
      console.warn('alpha telemetry failed', error.code);
    }
  } catch {
    // Telemetry is non-critical and must never block auth or inventory actions.
  }
}
