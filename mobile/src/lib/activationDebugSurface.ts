import { getLocalActivationSummary } from './activationSummary';

export type ActivationDebugSurface = Readonly<{
  title: 'Local activation funnel';
  lines: readonly string[];
  completed: boolean;
  privacyNotice: string;
}>;

/**
 * Developer-readable, process-local activation evidence.
 * This surface deliberately exposes only funnel stage names, counts and completion.
 * It performs no persistence or network I/O and carries no user/item/value payload.
 */
export function buildActivationDebugSurface(): ActivationDebugSurface {
  const summary = getLocalActivationSummary();
  const lines = summary.stages.map((stage) =>
    `${stage.name}: ${stage.reached ? 'reached' : 'not reached'} (${stage.count})`,
  );

  return Object.freeze({
    title: 'Local activation funnel' as const,
    lines: Object.freeze(lines),
    completed: summary.completed,
    privacyNotice: 'Process-local aggregate only. No user, item, price, free-text, timestamp, device or location data; no network transmission.',
  });
}
