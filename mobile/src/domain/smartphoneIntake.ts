export const STORAGE_OPTIONS_GB = [16, 32, 64, 128, 256, 512, 1024, 2048] as const;
export const PHONE_CONDITIONS = ['LIKE_NEW', 'GOOD', 'FAIR', 'DAMAGED'] as const;
export const PHONE_DEFECTS = ['DISPLAY', 'HOUSING', 'CAMERA', 'BIOMETRICS', 'BATTERY', 'BUTTONS', 'CHARGING', 'AUDIO', 'NETWORK', 'OTHER'] as const;
export const COARSE_REGIONS = ['DE-KARLSRUHE', 'DE-BRUCHSAL', 'DE-RHEIN-NECKAR', 'DE-OTHER-BW'] as const;
export const NETWORK_LOCK_STATES = ['UNKNOWN', 'UNLOCKED', 'LOCKED'] as const;

export type NetworkLockStatus = (typeof NETWORK_LOCK_STATES)[number];
export type SmartphoneIntake = Readonly<{
  phoneModel: string;
  storageGb: number;
  condition: (typeof PHONE_CONDITIONS)[number];
  defects: ReadonlyArray<(typeof PHONE_DEFECTS)[number]>;
  defectNote?: string;
  batteryHealthPercent?: number;
  activationLockReady: true;
  ownershipConfirmed: true;
  minimumPriceCents: number;
  region: (typeof COARSE_REGIONS)[number];
  availableFromDate: string;
  availableUntilDate: string;
  profileDisclosureConsent: boolean;
  networkLockStatus: NetworkLockStatus;
}>;
export type Validation = { ok: true; value: SmartphoneIntake } | { ok: false; issues: ReadonlyArray<{ field: string; code: string }> };
export type CatalogRow = Readonly<{ variantId: string; canonicalModel: string; storageGb: number; market: string }>;
export type ResolvedVariant = Readonly<SmartphoneIntake & { variantId: string; canonicalModel: string }>;
export type ResolveResult = { ok: true; value: ResolvedVariant } | { ok: false; reason: 'UNKNOWN_CATALOG_VARIANT' | 'AMBIGUOUS_CATALOG_VARIANT' };
export type BuyerIntent = Readonly<{
  variantId: string;
  maxPriceCents: number;
  startsOn: string;
  expiresOn: string;
  minBatteryPercent?: number;
  requireIntactDisplay?: boolean;
  requireBiometrics?: boolean;
}>;
export type CandidateEvaluation = Readonly<{
  matchable: boolean;
  eligible: false;
  eligibility: 'REQUIRES_SERVER_DECISION';
  reasons: ReadonlyArray<string>;
}>;

const ALLOWED = new Set(['phoneModel', 'storageGb', 'condition', 'defects', 'defectNote', 'batteryHealthPercent', 'activationLockReady', 'ownershipConfirmed', 'minimumPriceCents', 'region', 'availableFromDate', 'availableUntilDate', 'profileDisclosureConsent', 'networkLockStatus']);
const UNSAFE = /(?:imei|serial|credential|password|passcode|full.?address|street|house.?number|latitude|longitude|gps|variant.?id|possession.?status|market.?state|verified|market.?eligible|provenance|eligib(?:le|ility))/i;
const oneOf = (value: unknown, values: readonly unknown[]) => values.includes(value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const normalizeModel = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
const isDateOnly = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const plusDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function validateSmartphoneIntake(input: unknown, submittedOn: string): Validation {
  if (!isRecord(input)) return { ok: false, issues: [{ field: '$', code: 'OBJECT_REQUIRED' }] };
  const issues: Array<{ field: string; code: string }> = [];
  for (const key of Object.keys(input)) {
    if (UNSAFE.test(key)) issues.push({ field: key, code: 'SENSITIVE_OR_AUTHORITY_FIELD_FORBIDDEN' });
    else if (!ALLOWED.has(key)) issues.push({ field: key, code: 'UNKNOWN_FIELD' });
  }

  const model = typeof input.phoneModel === 'string' ? input.phoneModel.trim().replace(/\s+/g, ' ') : '';
  if (model.length < 2 || model.length > 80 || !/[A-Za-z]/.test(model)) issues.push({ field: 'phoneModel', code: 'INVALID_MODEL' });
  if (!oneOf(input.storageGb, STORAGE_OPTIONS_GB)) issues.push({ field: 'storageGb', code: 'INVALID_STORAGE' });
  if (!oneOf(input.condition, PHONE_CONDITIONS)) issues.push({ field: 'condition', code: 'INVALID_CONDITION' });

  const defects = Array.isArray(input.defects) ? input.defects : null;
  if (!defects || !defects.every((value) => oneOf(value, PHONE_DEFECTS))) issues.push({ field: 'defects', code: 'INVALID_DEFECTS' });
  else if (new Set(defects).size !== defects.length) issues.push({ field: 'defects', code: 'DUPLICATE_DEFECT' });
  if (input.condition === 'DAMAGED' && defects?.length === 0) issues.push({ field: 'defects', code: 'DEFECT_REQUIRED' });

  const defectNote = typeof input.defectNote === 'string' ? input.defectNote.trim().replace(/\s+/g, ' ') : undefined;
  if (defects?.includes('OTHER')) {
    if (!defectNote || defectNote.length < 3 || defectNote.length > 200) issues.push({ field: 'defectNote', code: 'DEFECT_NOTE_REQUIRED' });
  } else if (input.defectNote !== undefined) {
    issues.push({ field: 'defectNote', code: 'UNEXPECTED_DEFECT_NOTE' });
  }

  if (input.batteryHealthPercent !== undefined && (!Number.isInteger(input.batteryHealthPercent) || (input.batteryHealthPercent as number) < 1 || (input.batteryHealthPercent as number) > 100)) issues.push({ field: 'batteryHealthPercent', code: 'INVALID_BATTERY_HEALTH' });
  if (input.activationLockReady !== true) issues.push({ field: 'activationLockReady', code: 'ACTIVATION_LOCK_NOT_READY' });
  if (input.ownershipConfirmed !== true) issues.push({ field: 'ownershipConfirmed', code: 'OWNERSHIP_NOT_CONFIRMED' });
  if (!Number.isInteger(input.minimumPriceCents) || (input.minimumPriceCents as number) < 100 || (input.minimumPriceCents as number) > 500000) issues.push({ field: 'minimumPriceCents', code: 'INVALID_MINIMUM_PRICE' });
  if (!oneOf(input.region, COARSE_REGIONS)) issues.push({ field: 'region', code: 'INVALID_REGION' });

  if (!isDateOnly(input.availableFromDate) || !isDateOnly(input.availableUntilDate) || !isDateOnly(submittedOn)) {
    issues.push({ field: 'availability', code: 'INVALID_AVAILABILITY_DATE' });
  } else {
    const from = input.availableFromDate as string;
    const until = input.availableUntilDate as string;
    if (from < submittedOn || until < from) issues.push({ field: 'availability', code: 'INVALID_AVAILABILITY_RANGE' });
    if (until > plusDays(submittedOn, 30)) issues.push({ field: 'availableUntilDate', code: 'AVAILABILITY_WINDOW_EXCEEDS_30_DAYS' });
  }
  if (typeof input.profileDisclosureConsent !== 'boolean') issues.push({ field: 'profileDisclosureConsent', code: 'INVALID_DISCLOSURE_CONSENT' });
  if (!oneOf(input.networkLockStatus, NETWORK_LOCK_STATES)) issues.push({ field: 'networkLockStatus', code: 'INVALID_NETWORK_LOCK_STATUS' });
  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    value: Object.freeze({
      phoneModel: model,
      storageGb: input.storageGb as number,
      condition: input.condition as SmartphoneIntake['condition'],
      defects: Object.freeze([...(defects as SmartphoneIntake['defects'])]),
      ...(defectNote ? { defectNote } : {}),
      ...(input.batteryHealthPercent === undefined ? {} : { batteryHealthPercent: input.batteryHealthPercent as number }),
      activationLockReady: true,
      ownershipConfirmed: true,
      minimumPriceCents: input.minimumPriceCents as number,
      region: input.region as SmartphoneIntake['region'],
      availableFromDate: input.availableFromDate as string,
      availableUntilDate: input.availableUntilDate as string,
      profileDisclosureConsent: input.profileDisclosureConsent as boolean,
      networkLockStatus: input.networkLockStatus as NetworkLockStatus,
    }),
  };
}

export function resolveCatalogVariant(value: SmartphoneIntake, catalog: ReadonlyArray<CatalogRow>): ResolveResult {
  const matches = catalog.filter((row) => row.market === 'DE' && row.storageGb === value.storageGb && normalizeModel(row.canonicalModel) === normalizeModel(value.phoneModel));
  if (matches.length === 0) return { ok: false, reason: 'UNKNOWN_CATALOG_VARIANT' };
  if (matches.length > 1) return { ok: false, reason: 'AMBIGUOUS_CATALOG_VARIANT' };
  const row = matches[0]!;
  return { ok: true, value: Object.freeze({ ...value, variantId: row.variantId, canonicalModel: row.canonicalModel, storageGb: row.storageGb }) };
}

export function deriveMatchFacts(value: ResolvedVariant) {
  const defects = new Set(value.defects);
  return Object.freeze({
    variantId: value.variantId,
    displayState: defects.has('DISPLAY') ? 'DAMAGED' : 'INTACT',
    housingState: defects.has('HOUSING') ? 'DAMAGED' : value.condition === 'LIKE_NEW' ? 'CLEAN' : value.condition === 'GOOD' ? 'LIGHT_WEAR' : 'HEAVY_WEAR',
    camerasWorking: !defects.has('CAMERA'),
    biometricsWorking: !defects.has('BIOMETRICS'),
    batteryHealthPercent: value.batteryHealthPercent ?? null,
    otherDefect: ['BATTERY', 'BUTTONS', 'CHARGING', 'AUDIO', 'NETWORK', 'OTHER'].some((code) => defects.has(code as (typeof PHONE_DEFECTS)[number])),
    networkLockStatus: value.networkLockStatus,
  });
}

export function evaluateCandidate(value: ResolvedVariant, buyer: BuyerIntent, asOfDate: string): CandidateEvaluation {
  const reasons: string[] = [];
  const facts = deriveMatchFacts(value);

  if (!isDateOnly(asOfDate) || !isDateOnly(buyer.startsOn) || !isDateOnly(buyer.expiresOn) || buyer.expiresOn < buyer.startsOn) {
    reasons.push('BUYER_INTENT_INVALID_RANGE');
  }
  if (value.variantId !== buyer.variantId) reasons.push('VARIANT_MISMATCH');
  if (!Number.isInteger(buyer.maxPriceCents) || buyer.maxPriceCents < 100) reasons.push('BUYER_MAX_PRICE_INVALID');
  else if (value.minimumPriceCents > buyer.maxPriceCents) reasons.push('PRICE_FLOOR_ABOVE_MAXIMUM');
  if (!value.profileDisclosureConsent) reasons.push('PROFILE_DISCLOSURE_NOT_GRANTED');

  if (!reasons.includes('BUYER_INTENT_INVALID_RANGE')) {
    if (buyer.expiresOn < asOfDate) reasons.push('BUYER_INTENT_EXPIRED');
    const buyerStart = buyer.startsOn > asOfDate ? buyer.startsOn : asOfDate;
    if (!(value.availableFromDate <= buyer.expiresOn && buyerStart <= value.availableUntilDate)) reasons.push('NO_AVAILABILITY_OVERLAP');
  }

  if (buyer.minBatteryPercent !== undefined) {
    if (!Number.isInteger(buyer.minBatteryPercent) || buyer.minBatteryPercent < 1 || buyer.minBatteryPercent > 100) reasons.push('BUYER_BATTERY_MINIMUM_INVALID');
    else if (facts.batteryHealthPercent === null) reasons.push('BATTERY_UNKNOWN');
    else if (facts.batteryHealthPercent < buyer.minBatteryPercent) reasons.push('BATTERY_BELOW_MINIMUM');
  }
  if (buyer.requireIntactDisplay && facts.displayState !== 'INTACT') reasons.push('DISPLAY_NOT_INTACT');
  if (buyer.requireBiometrics && !facts.biometricsWorking) reasons.push('BIOMETRICS_NOT_WORKING');
  if (value.networkLockStatus === 'LOCKED') reasons.push('NETWORK_LOCKED');
  if (value.networkLockStatus === 'UNKNOWN') reasons.push('NETWORK_LOCK_UNKNOWN');

  // The mobile/client contract deliberately never returns market eligibility.
  // It can only determine deterministic matchability. Final eligibility must be
  // decided by a server-side authority after possession/security checks.
  return Object.freeze({
    matchable: reasons.length === 0,
    eligible: false,
    eligibility: 'REQUIRES_SERVER_DECISION' as const,
    reasons: Object.freeze(reasons),
  });
}
