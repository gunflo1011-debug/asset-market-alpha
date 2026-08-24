import { conciergeIntakeReady, validateConciergeIntake, type ConciergeSmartphoneIntake } from '../src/data/conciergeIntake';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validIntake(overrides: Partial<ConciergeSmartphoneIntake> = {}): ConciergeSmartphoneIntake {
  return {
    model: 'iPhone 14 Pro',
    storageGb: 256,
    condition: 'GOOD',
    defects: 'Small scratch on frame',
    batteryHealth: 91,
    activationLockRemoved: true,
    lawfulOwnershipConfirmed: true,
    priceFloorCents: 45000,
    localArea: 'Karlsruhe',
    ...overrides,
  };
}

function expectError(overrides: Partial<ConciergeSmartphoneIntake>, key: keyof ConciergeSmartphoneIntake) {
  const errors = validateConciergeIntake(validIntake(overrides));
  assert(Boolean(errors[key]), `Expected validation error for ${key}`);
}

const validErrors = validateConciergeIntake(validIntake());
assert(conciergeIntakeReady(validErrors), `Expected valid intake, got ${JSON.stringify(validErrors)}`);

expectError({ model: '' }, 'model');
expectError({ storageGb: 4 }, 'storageGb');
expectError({ condition: 'BROKEN' as ConciergeSmartphoneIntake['condition'] }, 'condition');
expectError({ batteryHealth: 101 }, 'batteryHealth');
expectError({ activationLockRemoved: false }, 'activationLockRemoved');
expectError({ lawfulOwnershipConfirmed: false }, 'lawfulOwnershipConfirmed');
expectError({ priceFloorCents: 0 }, 'priceFloorCents');
expectError({ localArea: '' }, 'localArea');
expectError({ localArea: 'Hauptstraße 12' }, 'localArea');
expectError({ localArea: 'Hauptstrasse 12' }, 'localArea');
expectError({ localArea: 'Main Street 12' }, 'localArea');
expectError({ localArea: '12 Main Street' }, 'localArea');
expectError({ defects: 'IMEI 490154203237518' }, 'defects');
expectError({ model: 'serial ABC123' }, 'defects');

const unknownBattery = validateConciergeIntake(validIntake({ batteryHealth: null }));
assert(conciergeIntakeReady(unknownBattery), 'Battery health must be optional');

const coarsePostalArea = validateConciergeIntake(validIntake({ localArea: '76133 Karlsruhe' }));
assert(conciergeIntakeReady(coarsePostalArea), `Postal-code + city must remain allowed, got ${JSON.stringify(coarsePostalArea)}`);

console.log('concierge intake unit tests passed');
