import { trackAlphaEvent } from './analytics';
import { requireSupabase } from './supabaseClient';
import { conditionArgs, thingArgs } from '../features/inventory/input';
import type { AddPrivateDeviceInput, ConditionInput, PrivateThingInput } from '../features/inventory/types';

export async function addPrivateThing(input: PrivateThingInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('add_private_thing', thingArgs(input));
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Thing command returned no item id.');
  return data;
}

export async function updatePrivateThing(itemId: string, input: PrivateThingInput): Promise<void> {
  const { error } = await requireSupabase().rpc('update_private_thing', {
    p_item_id: itemId,
    ...thingArgs(input),
  });
  if (error) throw error;
}

export async function updatePrivateItemMetadata(itemId: string, input: PrivateThingInput): Promise<void> {
  const { error } = await requireSupabase().rpc('update_private_item_metadata', {
    p_item_id: itemId,
    ...thingArgs(input),
  });
  if (error) throw error;
}

export async function deletePrivateThing(itemId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_private_thing', { p_item_id: itemId });
  if (error) throw error;
}

export async function addPrivateDevice(input: AddPrivateDeviceInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('add_private_device', {
    p_variant_id: input.variantId,
    ...conditionArgs(input),
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Inventory command returned no item id.');
  void trackAlphaEvent('DEVICE_ADDED', data);
  return data;
}

export async function updatePrivateDevice(itemId: string, input: ConditionInput): Promise<void> {
  const { error } = await requireSupabase().rpc('update_private_device', {
    p_item_id: itemId,
    ...conditionArgs(input),
  });
  if (error) throw error;
}

export async function deletePrivateDevice(itemId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_private_device', { p_item_id: itemId });
  if (error) throw error;
}
