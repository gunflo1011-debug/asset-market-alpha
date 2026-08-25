export type CaptureSelection = string | null;

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

export function captureCompleted(saveSucceeded: boolean): boolean {
  return saveSucceeded;
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
