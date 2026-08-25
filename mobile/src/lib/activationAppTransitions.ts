import { recordActivationTransition } from './activationActionBridge';
import { exportLocalActivationSummary } from './activationSummary';

/**
 * App-facing activation hooks. These functions deliberately accept no payload,
 * so callers cannot attach user, item, value, device, location or timestamp data.
 * Evidence stays process-local through activationActionBridge/localActivationCollector.
 */
export function recordCaptureSuccess(): void {
  recordActivationTransition('CAPTURE_SUCCESS');
}

export function recordInventoryVisible(): void {
  recordActivationTransition('INVENTORY_VISIBLE');
}

export function recordValueVisible(): void {
  recordActivationTransition('VALUE_VISIBLE');
}

export function recordSellInitiated(): void {
  recordActivationTransition('SELL_INITIATED');
}

/** Developer/debug-only deterministic aggregate. No persistence or network I/O. */
export function getActivationDebugExport(): string {
  return exportLocalActivationSummary();
}
