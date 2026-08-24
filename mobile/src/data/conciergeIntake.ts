export type ConciergeCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED';

export type ConciergeSmartphoneIntake = {
  model: string;
  storageGb: number;
  condition: ConciergeCondition;
  defects: string;
  batteryHealth: number | null;
  activationLockRemoved: boolean;
  lawfulOwnershipConfirmed: boolean;
  priceFloorCents: number;
  localArea: string;
};

export type ConciergeIntakeErrors = Partial<Record<keyof ConciergeSmartphoneIntake, string>>;

const sensitiveIdentifierPattern = /\b(?:\d[ -]?){14,16}\d\b|\b(?:imei|serial|s\/n)\b/i;
const fullAddressPattern = /\b(?:straße|strasse|str\.|street|road|rd\.|avenue|ave\.|weg|platz)\s*\d+|\b\d+\s+(?:street|road|avenue)\b/i;

export function validateConciergeIntake(input: ConciergeSmartphoneIntake): ConciergeIntakeErrors {
  const errors: ConciergeIntakeErrors = {};
  const model = input.model.trim();
  const defects = input.defects.trim();
  const area = input.localArea.trim();

  if (model.length < 2 || model.length > 80) errors.model = 'Enter the phone model (2–80 characters).';
  if (!Number.isInteger(input.storageGb) || input.storageGb < 8 || input.storageGb > 4096) errors.storageGb = 'Enter storage between 8 and 4096 GB.';
  if (!['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'].includes(input.condition)) errors.condition = 'Choose a condition.';
  if (defects.length > 300) errors.defects = 'Keep defect notes under 300 characters.';
  if (sensitiveIdentifierPattern.test(defects) || sensitiveIdentifierPattern.test(model)) errors.defects = 'Do not enter an IMEI or serial number.';
  if (input.batteryHealth != null && (!Number.isInteger(input.batteryHealth) || input.batteryHealth < 0 || input.batteryHealth > 100)) errors.batteryHealth = 'Battery health must be 0–100% or left unknown.';
  if (!input.activationLockRemoved) errors.activationLockRemoved = 'Remove Find My / activation lock before handover.';
  if (!input.lawfulOwnershipConfirmed) errors.lawfulOwnershipConfirmed = 'Confirm that you lawfully own the phone.';
  if (!Number.isInteger(input.priceFloorCents) || input.priceFloorCents < 100 || input.priceFloorCents > 500000) errors.priceFloorCents = 'Enter a minimum price between €1 and €5,000.';
  if (area.length < 2 || area.length > 60) errors.localArea = 'Enter a coarse area such as Karlsruhe or 76133.';
  if (fullAddressPattern.test(area)) errors.localArea = 'Use only a city, district or postal code — never a full address.';
  if (sensitiveIdentifierPattern.test(area)) errors.localArea = 'Do not enter device identifiers here.';

  return errors;
}

export function conciergeIntakeReady(errors: ConciergeIntakeErrors): boolean {
  return Object.keys(errors).length === 0;
}
