export const STORAGE_OPTIONS_GB = [16, 32, 64, 128, 256, 512, 1024, 2048] as const;

export const PHONE_CONDITIONS = ['LIKE_NEW', 'GOOD', 'FAIR', 'DAMAGED'] as const;

export const PHONE_DEFECTS = [
  'DISPLAY',
  'HOUSING',
  'CAMERA',
  'BIOMETRICS',
  'BATTERY',
  'BUTTONS',
  'CHARGING',
  'AUDIO',
  'NETWORK',
  'OTHER',
] as const;

export const COARSE_REGIONS = [
  'DE-KARLSRUHE',
  'DE-BRUCHSAL',
  'DE-RHEIN-NECKAR',
  'DE-OTHER-BW',
] as const;

export type StorageGb = (typeof STORAGE_OPTIONS_GB)[number];
export type PhoneCondition = (typeof PHONE_CONDITIONS)[number];
export type PhoneDefect = (typeof PHONE_DEFECTS)[number];
export type CoarseRegion = (typeof COARSE_REGIONS)[number];

export type SmartphoneIntake = Readonly<{
  phoneModel: string;
  storageGb: StorageGb;
  condition: PhoneCondition;
  defects: ReadonlyArray<PhoneDefect>;
  defectNote?: string;
  batteryHealthPercent?: number;
  activationLockReady: true;
  ownershipConfirmed: true;
  minimumPriceCents: number;
  region: CoarseRegion;
}>;

export type SmartphoneIntakeIssue = Readonly<{
  field: string;
  code: string;
  message: string;
}>;

export type SmartphoneIntakeValidation =
  | Readonly<{ ok: true; value: SmartphoneIntake }>
  | Readonly<{ ok: false; issues: ReadonlyArray<SmartphoneIntakeIssue> }>;

const ALLOWED_FIELDS = new Set([
  'phoneModel',
  'storageGb',
  'condition',
  'defects',
  'defectNote',
  'batteryHealthPercent',
  'activationLockReady',
  'ownershipConfirmed',
  'minimumPriceCents',
  'region',
]);

const UNSAFE_FIELD_PATTERN = /(?:imei|serial|credential|password|passcode|full.?address|street|house.?number|latitude|longitude|gps)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends readonly unknown[]>(value: unknown, values: T): value is T[number] {
  return values.includes(value);
}

function issue(field: string, code: string, message: string): SmartphoneIntakeIssue {
  return Object.freeze({ field, code, message });
}

export function validateSmartphoneIntake(input: unknown): SmartphoneIntakeValidation {
  if (!isRecord(input)) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([issue('$', 'OBJECT_REQUIRED', 'Smartphone intake must be an object.')]),
    });
  }

  const issues: SmartphoneIntakeIssue[] = [];
  for (const field of Object.keys(input)) {
    if (UNSAFE_FIELD_PATTERN.test(field)) {
      issues.push(issue(field, 'SENSITIVE_FIELD_FORBIDDEN', 'Sensitive device, credential, or precise-location data is forbidden.'));
    } else if (!ALLOWED_FIELDS.has(field)) {
      issues.push(issue(field, 'UNKNOWN_FIELD', 'Unknown intake fields are rejected.'));
    }
  }

  const phoneModel = typeof input.phoneModel === 'string' ? input.phoneModel.trim().replace(/\s+/g, ' ') : '';
  if (phoneModel.length < 2 || phoneModel.length > 80 || !/[A-Za-z]/.test(phoneModel)) {
    issues.push(issue('phoneModel', 'INVALID_MODEL', 'Phone model must contain a name between 2 and 80 characters.'));
  }

  if (!isOneOf(input.storageGb, STORAGE_OPTIONS_GB)) {
    issues.push(issue('storageGb', 'INVALID_STORAGE', 'Choose a supported storage capacity.'));
  }

  if (!isOneOf(input.condition, PHONE_CONDITIONS)) {
    issues.push(issue('condition', 'INVALID_CONDITION', 'Choose a supported condition.'));
  }

  const defects = Array.isArray(input.defects) ? input.defects : null;
  if (!defects || !defects.every((value) => isOneOf(value, PHONE_DEFECTS))) {
    issues.push(issue('defects', 'INVALID_DEFECTS', 'Defects must be a list of supported defect codes.'));
  } else if (new Set(defects).size !== defects.length) {
    issues.push(issue('defects', 'DUPLICATE_DEFECT', 'Each defect may be selected only once.'));
  }

  if (input.condition === 'DAMAGED' && defects?.length === 0) {
    issues.push(issue('defects', 'DEFECT_REQUIRED', 'A damaged phone must include at least one defect.'));
  }

  const defectNote = typeof input.defectNote === 'string' ? input.defectNote.trim().replace(/\s+/g, ' ') : undefined;
  if (defects?.includes('OTHER')) {
    if (!defectNote || defectNote.length < 3 || defectNote.length > 200) {
      issues.push(issue('defectNote', 'DEFECT_NOTE_REQUIRED', 'Describe the other defect in 3 to 200 characters.'));
    }
  } else if (input.defectNote !== undefined) {
    issues.push(issue('defectNote', 'UNEXPECTED_DEFECT_NOTE', 'A defect note is accepted only with the OTHER defect.'));
  }

  if (input.batteryHealthPercent !== undefined
      && (!Number.isInteger(input.batteryHealthPercent)
        || (input.batteryHealthPercent as number) < 1
        || (input.batteryHealthPercent as number) > 100)) {
    issues.push(issue('batteryHealthPercent', 'INVALID_BATTERY_HEALTH', 'Battery health must be a whole percentage from 1 to 100 or omitted.'));
  }

  if (input.activationLockReady !== true) {
    issues.push(issue('activationLockReady', 'ACTIVATION_LOCK_NOT_READY', 'The owner must confirm the phone can be released from activation lock before intake.'));
  }

  if (input.ownershipConfirmed !== true) {
    issues.push(issue('ownershipConfirmed', 'OWNERSHIP_NOT_CONFIRMED', 'Ownership confirmation is required.'));
  }

  if (!Number.isInteger(input.minimumPriceCents)
      || (input.minimumPriceCents as number) < 100
      || (input.minimumPriceCents as number) > 500_000) {
    issues.push(issue('minimumPriceCents', 'INVALID_MINIMUM_PRICE', 'Minimum price must be whole euro cents between EUR 1 and EUR 5,000.'));
  }

  if (!isOneOf(input.region, COARSE_REGIONS)) {
    issues.push(issue('region', 'INVALID_REGION', 'Choose a supported coarse region; precise location is not collected.'));
  }

  if (issues.length > 0) {
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }

  const value: SmartphoneIntake = {
    phoneModel,
    storageGb: input.storageGb as StorageGb,
    condition: input.condition as PhoneCondition,
    defects: Object.freeze([...(defects as PhoneDefect[])]),
    ...(defectNote ? { defectNote } : {}),
    ...(input.batteryHealthPercent === undefined ? {} : { batteryHealthPercent: input.batteryHealthPercent as number }),
    activationLockReady: true,
    ownershipConfirmed: true,
    minimumPriceCents: input.minimumPriceCents as number,
    region: input.region as CoarseRegion,
  };

  return Object.freeze({ ok: true, value: Object.freeze(value) });
}
