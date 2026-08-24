const assert = require('node:assert/strict');
const { test } = require('node:test');
const { join } = require('node:path');

const compiled = join(__dirname, '..', '.intake-test-dist', 'smartphoneIntake.js');
const { validateSmartphoneIntake } = require(compiled);
const submittedOn = '2026-08-24';

function valid(overrides = {}) {
  return {
    phoneModel: 'Apple iPhone 13',
    storageGb: 128,
    condition: 'GOOD',
    defects: ['HOUSING'],
    batteryHealthPercent: 87,
    activationLockReady: true,
    ownershipConfirmed: true,
    minimumPriceCents: 25000,
    region: 'DE-KARLSRUHE',
    availableFromDate: '2026-08-24',
    availableUntilDate: '2026-08-31',
    profileDisclosureConsent: true,
    networkLockStatus: 'UNLOCKED',
    ...overrides,
  };
}

function codes(result) {
  assert.equal(result.ok, false);
  return result.issues.map(({ code }) => code);
}

function validate(input) {
  return validateSmartphoneIntake(input, submittedOn);
}

test('accepts, normalizes, and freezes a complete safe intake', () => {
  const result = validate(valid({ phoneModel: '  Apple   iPhone 13  ' }));
  assert.equal(result.ok, true);
  assert.equal(result.value.phoneModel, 'Apple iPhone 13');
  assert.equal(result.value.minimumPriceCents, 25000);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.defects), true);
});

test('battery health is optional', () => {
  const input = valid();
  delete input.batteryHealthPercent;
  const result = validate(input);
  assert.equal(result.ok, true);
  assert.equal('batteryHealthPercent' in result.value, false);
});

test('requires an object', () => {
  assert.deepEqual(codes(validate(null)), ['OBJECT_REQUIRED']);
  assert.deepEqual(codes(validate([])), ['OBJECT_REQUIRED']);
});

for (const field of ['imei', 'serialNumber', 'password', 'credentials', 'fullAddress', 'street', 'gps']) {
  test(`rejects forbidden sensitive field ${field}`, () => {
    assert.ok(codes(validate(valid({ [field]: 'secret' }))).includes('SENSITIVE_OR_AUTHORITY_FIELD_FORBIDDEN'));
  });
}

test('rejects unknown fields instead of silently persisting them', () => {
  assert.ok(codes(validate(valid({ nickname: 'my phone' }))).includes('UNKNOWN_FIELD'));
});

test('rejects numeric identifiers disguised as model names', () => {
  assert.ok(codes(validate(valid({ phoneModel: '490154203237518' }))).includes('INVALID_MODEL'));
});

test('rejects unsupported storage and condition', () => {
  const result = validate(valid({ storageGb: 96, condition: 'PERFECT' }));
  assert.deepEqual(codes(result).sort(), ['INVALID_CONDITION', 'INVALID_STORAGE']);
});

test('requires a defect for damaged phones', () => {
  assert.ok(codes(validate(valid({ condition: 'DAMAGED', defects: [] }))).includes('DEFECT_REQUIRED'));
});

test('rejects duplicate and unsupported defects', () => {
  assert.ok(codes(validate(valid({ defects: ['DISPLAY', 'DISPLAY'] }))).includes('DUPLICATE_DEFECT'));
  assert.ok(codes(validate(valid({ defects: ['WATER_DAMAGE'] }))).includes('INVALID_DEFECTS'));
});

test('requires a bounded note only for OTHER', () => {
  assert.ok(codes(validate(valid({ defects: ['OTHER'] }))).includes('DEFECT_NOTE_REQUIRED'));
  assert.ok(codes(validate(valid({ defectNote: 'scratch' }))).includes('UNEXPECTED_DEFECT_NOTE'));
  assert.equal(validate(valid({ defects: ['OTHER'], defectNote: 'Charging port is intermittent.' })).ok, true);
});

test('validates optional battery health bounds', () => {
  for (const batteryHealthPercent of [0, 50.5, 101]) {
    assert.ok(codes(validate(valid({ batteryHealthPercent }))).includes('INVALID_BATTERY_HEALTH'));
  }
  assert.equal(validate(valid({ batteryHealthPercent: 1 })).ok, true);
  assert.equal(validate(valid({ batteryHealthPercent: 100 })).ok, true);
});

test('requires activation-lock readiness and ownership confirmation', () => {
  const result = validate(valid({ activationLockReady: false, ownershipConfirmed: false }));
  assert.deepEqual(codes(result).sort(), ['ACTIVATION_LOCK_NOT_READY', 'OWNERSHIP_NOT_CONFIRMED']);
});

test('requires a bounded integer minimum price', () => {
  for (const minimumPriceCents of [99, 100.5, 500001]) {
    assert.ok(codes(validate(valid({ minimumPriceCents }))).includes('INVALID_MINIMUM_PRICE'));
  }
  assert.equal(validate(valid({ minimumPriceCents: 100 })).ok, true);
  assert.equal(validate(valid({ minimumPriceCents: 500000 })).ok, true);
});

test('accepts only coarse region codes', () => {
  assert.ok(codes(validate(valid({ region: '76694 Hambrücken, Hauptstraße 1' }))).includes('INVALID_REGION'));
  assert.equal(validate(valid({ region: 'DE-RHEIN-NECKAR' })).ok, true);
});
