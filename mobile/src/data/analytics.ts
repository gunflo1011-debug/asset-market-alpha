import { supabase } from '../lib/supabase';

export type AlphaEventName =
  | 'SESSION_RESTORED'
  | 'SIGN_IN_SUCCEEDED'
  | 'SIGN_UP_REQUESTED'
  | 'INVENTORY_VIEWED'
  | 'DEVICE_ADDED'
  | 'THING_ADDED';

/**
 * Best-effort, privacy-minimal closed-alpha telemetry.
 *
 * Deliberately sends no email, free-text metadata, device fingerprint or
 * advertising identifier. Product flows must never fail because telemetry did.
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
