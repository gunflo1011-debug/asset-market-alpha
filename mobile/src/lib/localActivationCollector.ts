import { activationEvent, type ActivationEventName } from './activationEvents';
import { aggregateActivationFunnel, type ActivationFunnelSnapshot } from './activationFunnel';

/**
 * Process-local, privacy-minimal activation evidence collector.
 *
 * Events never leave memory and contain only the versioned event name. A reload,
 * sign-out or process restart can reset this collector without losing product data.
 */
const events: ReturnType<typeof activationEvent>[] = [];

export function recordLocalActivation(name: ActivationEventName): ActivationFunnelSnapshot {
  events.push(activationEvent(name));
  return getLocalActivationSnapshot();
}

export function getLocalActivationSnapshot(): ActivationFunnelSnapshot {
  return aggregateActivationFunnel(events);
}

export function resetLocalActivation(): ActivationFunnelSnapshot {
  events.splice(0, events.length);
  return getLocalActivationSnapshot();
}
