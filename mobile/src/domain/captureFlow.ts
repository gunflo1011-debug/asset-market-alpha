export type CaptureSelection = string | null;

export type CaptureTelemetryEvent =
  | 'ITEM_CAPTURE_STARTED'
  | 'ITEM_CAPTURE_COMPLETED';

export function reconcileCaptureSelection(
  current: CaptureSelection,
  availableVariantIds: readonly string[],
): CaptureSelection {
  if (!current) return null;
  return availableVariantIds.includes(current) ? current : null;
}

export function canSubmitCapture(selection: CaptureSelection, busy: boolean): boolean {
  return selection !== null && !busy;
}

export function captureStarted(previous: CaptureSelection, next: CaptureSelection): boolean {
  return previous === null && next !== null;
}

export function captureStartEvent(
  previous: CaptureSelection,
  next: CaptureSelection,
): CaptureTelemetryEvent | null {
  return captureStarted(previous, next) ? 'ITEM_CAPTURE_STARTED' : null;
}

export function captureCompleted(saveSucceeded: boolean): boolean {
  return saveSucceeded;
}

export function captureCompletionEvent(
  saveSucceeded: boolean,
): CaptureTelemetryEvent | null {
  return captureCompleted(saveSucceeded) ? 'ITEM_CAPTURE_COMPLETED' : null;
}

export function selectionAfterSuccessfulCapture(): CaptureSelection {
  return null;
}

export type PostCaptureRefreshPlan = Readonly<{
  inventory: true;
  catalog: false;
}>;

export function postCaptureRefreshPlan(): PostCaptureRefreshPlan {
  return { inventory: true, catalog: false };
}
