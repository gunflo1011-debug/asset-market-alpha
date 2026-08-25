const test = require('node:test');
const assert = require('node:assert/strict');

const {
  reconcileCaptureSelection,
  canSubmitCapture,
  captureStarted,
  captureStartEvent,
  captureCompleted,
  captureCompletionEvent,
  selectionAfterSuccessfulCapture,
  postCaptureRefreshPlan,
} = require('../.intake-test-dist/captureFlow.js');

test('catalog load never auto-selects a device', () => {
  assert.equal(reconcileCaptureSelection(null, ['iphone-15', 'pixel-9']), null);
});

test('existing explicit selection survives catalog refresh when still valid', () => {
  assert.equal(reconcileCaptureSelection('pixel-9', ['iphone-15', 'pixel-9']), 'pixel-9');
});

test('stale selection is cleared when catalog no longer contains it', () => {
  assert.equal(reconcileCaptureSelection('pixel-9', ['iphone-15']), null);
});

test('save is disabled until the user explicitly selects a variant', () => {
  assert.equal(canSubmitCapture(null, false), false);
  assert.equal(canSubmitCapture('iphone-15', true), false);
  assert.equal(canSubmitCapture('iphone-15', false), true);
});

test('capture start is emitted only on first explicit selection', () => {
  assert.equal(captureStarted(null, 'iphone-15'), true);
  assert.equal(captureStarted('iphone-15', 'pixel-9'), false);
  assert.equal(captureStarted(null, null), false);
  assert.equal(captureStartEvent(null, 'iphone-15'), 'ITEM_CAPTURE_STARTED');
  assert.equal(captureStartEvent('iphone-15', 'pixel-9'), null);
});

test('capture completion is tied only to successful persistence', () => {
  assert.equal(captureCompleted(true), true);
  assert.equal(captureCompleted(false), false);
  assert.equal(captureCompletionEvent(true), 'ITEM_CAPTURE_COMPLETED');
  assert.equal(captureCompletionEvent(false), null);
});

test('telemetry contract exposes event names only and no item payload', () => {
  const events = [
    captureStartEvent(null, 'iphone-15'),
    captureCompletionEvent(true),
  ];
  assert.deepEqual(events, ['ITEM_CAPTURE_STARTED', 'ITEM_CAPTURE_COMPLETED']);
  assert.equal(events.some((event) => typeof event === 'object'), false);
});

test('successful capture resets selection for intentional next capture', () => {
  assert.equal(selectionAfterSuccessfulCapture(), null);
});

test('successful capture refreshes inventory but not unchanged catalog', () => {
  assert.deepEqual(postCaptureRefreshPlan(), { inventory: true, catalog: false });
});
