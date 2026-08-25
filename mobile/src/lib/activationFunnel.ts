import {
  ACTIVATION_EVENT_NAMES,
  type ActivationEvent,
  type ActivationEventName,
} from './activationEvents';

export type ActivationFunnelCounts = Readonly<Record<ActivationEventName, number>>;

export type ActivationFunnelSnapshot = Readonly<{
  schemaVersion: 1;
  counts: ActivationFunnelCounts;
}>;

function emptyCounts(): Record<ActivationEventName, number> {
  return Object.fromEntries(
    ACTIVATION_EVENT_NAMES.map((name) => [name, 0]),
  ) as Record<ActivationEventName, number>;
}

/**
 * Aggregate privacy-minimal activation events locally.
 *
 * The snapshot contains only event-name counts. It deliberately has no user,
 * item, value, device, location, free-text, timestamp, session identifier or
 * external destination, so it cannot reconstruct an individual journey.
 */
export function aggregateActivationFunnel(
  events: readonly ActivationEvent[],
): ActivationFunnelSnapshot {
  const counts = emptyCounts();

  for (const event of events) {
    if (event.schemaVersion !== 1) continue;
    counts[event.name] += 1;
  }

  return Object.freeze({
    schemaVersion: 1 as const,
    counts: Object.freeze({ ...counts }),
  });
}

/** Human-readable definitions for local diagnostics and product decisions. */
export const ACTIVATION_METRIC_DEFINITIONS: Readonly<Record<ActivationEventName, string>> =
  Object.freeze({
    CAPTURE_SUCCESS: 'Successful completion of the item capture flow.',
    INVENTORY_VISIBLE: 'Inventory is successfully visible to the user.',
    VALUE_VISIBLE: 'A value result or explicit unknown-value state is visible.',
    SELL_INITIATED: 'The user explicitly starts the sell flow.',
  });
