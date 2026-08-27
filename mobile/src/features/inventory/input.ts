import type { ConditionInput, PrivateThingInput } from './types';

export function conditionArgs(input: ConditionInput) {
  return {
    p_color: input.color ?? null,
    p_display_state: input.displayState ?? 'INTACT',
    p_housing_state: input.housingState ?? 'CLEAN',
    p_cameras_working: input.camerasWorking ?? true,
    p_biometrics_working: input.biometricsWorking ?? true,
    p_battery_health: input.batteryHealth ?? null,
    p_network_locked: input.networkLocked ?? false,
    p_other_defect: input.otherDefect ?? false,
  };
}

export function thingArgs(input: PrivateThingInput) {
  const name = input.name.trim();
  if (!name) throw new Error('Give this Thing a name.');

  return {
    p_name: name,
    p_category: input.category?.trim() || null,
    p_location: input.location?.trim() || null,
    p_notes: input.notes?.trim() || null,
  };
}
