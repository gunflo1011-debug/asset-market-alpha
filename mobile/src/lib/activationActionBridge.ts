import { getLocalActivationSnapshot, recordLocalActivation, type LocalActivationSnapshot } from './localActivationCollector';
import type { ActivationEventName } from './activationEvents';

const ORDER: readonly ActivationEventName[] = [
  'CAPTURE_SUCCESS',
  'INVENTORY_VISIBLE',
  'VALUE_VISIBLE',
  'SELL_INITIATED',
];

/**
 * Process-local bridge from real product transitions to activation evidence.
 * It carries no user/item/value payload and emits each funnel stage at most once.
 * Later stages are accepted only after all earlier stages have happened.
 */
export function recordActivationTransition(name: ActivationEventName): LocalActivationSnapshot {
  const snapshot = getLocalActivationSnapshot();
  const targetIndex = ORDER.indexOf(name);
  if (targetIndex < 0) return snapshot;

  for (let index = 0; index < targetIndex; index += 1) {
    if (snapshot[ORDER[index]] < 1) return snapshot;
  }

  if (snapshot[name] > 0) return snapshot;
  return recordLocalActivation(name);
}
