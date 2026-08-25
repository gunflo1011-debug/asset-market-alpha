export type CaptureEvent = 'ITEM_CAPTURE_STARTED' | 'ITEM_CAPTURE_COMPLETED';

export function reconcileVariantSelection(
  currentVariantId: string | null,
  availableVariantIds: readonly string[],
): string | null {
  if (!currentVariantId) return null;
  return availableVariantIds.includes(currentVariantId) ? currentVariantId : null;
}

export function canSaveCapture(selectedVariantId: string | null, busy: boolean): boolean {
  return Boolean(selectedVariantId) && !busy;
}

export function captureStartedEvent(
  previousVariantId: string | null,
  nextVariantId: string | null,
): CaptureEvent | null {
  return !previousVariantId && Boolean(nextVariantId) ? 'ITEM_CAPTURE_STARTED' : null;
}

export function captureCompletedEvent(persisted: boolean): CaptureEvent | null {
  return persisted ? 'ITEM_CAPTURE_COMPLETED' : null;
}

export function selectionAfterSuccessfulCapture(): null {
  return null;
}

export function postCaptureRefreshTargets(): readonly ['inventory'] {
  return ['inventory'] as const;
}
