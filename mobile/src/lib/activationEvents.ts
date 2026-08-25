export const ACTIVATION_EVENT_NAMES = [
  'CAPTURE_SUCCESS',
  'INVENTORY_VISIBLE',
  'VALUE_VISIBLE',
  'SELL_INITIATED',
] as const;

export type ActivationEventName = (typeof ACTIVATION_EVENT_NAMES)[number];

export type ActivationEvent = Readonly<{
  name: ActivationEventName;
  schemaVersion: 1;
}>;

/**
 * Privacy-minimal activation event contract.
 *
 * Deliberately contains no user, item, value, device, location, free-text,
 * timestamp or other identifying/contextual payload. It is repository-local
 * only: constructing an event does not transmit or persist anything.
 */
export function activationEvent(name: ActivationEventName): ActivationEvent {
  return Object.freeze({ name, schemaVersion: 1 as const });
}

export function isActivationEventName(value: string): value is ActivationEventName {
  return (ACTIVATION_EVENT_NAMES as readonly string[]).includes(value);
}
