import { getLocalActivationSnapshot } from './localActivationCollector';
import type { ActivationEventName } from './activationEvents';
import type { ActivationFunnelSnapshot } from './activationFunnel';

const ORDER: readonly ActivationEventName[] = [
  'CAPTURE_SUCCESS',
  'INVENTORY_VISIBLE',
  'VALUE_VISIBLE',
  'SELL_INITIATED',
];

export type ActivationStageSummary = Readonly<{
  name: ActivationEventName;
  reached: boolean;
  count: number;
}>;

export type LocalActivationSummary = Readonly<{
  schemaVersion: 1;
  stages: readonly ActivationStageSummary[];
  highestReachedStage: ActivationEventName | null;
  completed: boolean;
}>;

/**
 * Convert process-local activation evidence into an inspectable aggregate.
 * The output contains only coarse stage names, reached flags and counts.
 * It deliberately contains no user/item identifiers, prices, free text,
 * timestamps, device/location data, persistence or network destination.
 */
export function summarizeActivationSnapshot(
  snapshot: ActivationFunnelSnapshot,
): LocalActivationSummary {
  const stages = ORDER.map((name) => Object.freeze({
    name,
    reached: snapshot.counts[name] > 0,
    count: snapshot.counts[name],
  }));

  let highestReachedStage: ActivationEventName | null = null;
  for (const stage of stages) {
    if (!stage.reached) break;
    highestReachedStage = stage.name;
  }

  return Object.freeze({
    schemaVersion: 1 as const,
    stages: Object.freeze(stages),
    highestReachedStage,
    completed: stages.every((stage) => stage.reached),
  });
}

export function getLocalActivationSummary(): LocalActivationSummary {
  return summarizeActivationSnapshot(getLocalActivationSnapshot());
}

/** Deterministic developer/debug export. No network transmission occurs here. */
export function exportLocalActivationSummary(): string {
  return JSON.stringify(getLocalActivationSummary());
}
