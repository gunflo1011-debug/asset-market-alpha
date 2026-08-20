import { supabase } from '../lib/supabase';

export const EXPECTED_ALPHA_CONTRACT_VERSION = 1;

export type AlphaBackendInfo = {
  contract_version: number;
  alpha_scope: string;
  capabilities: string[];
};

const requiredCapabilities = [
  'auth',
  'private_inventory',
  'condition_snapshot',
  'privacy_minimal_telemetry',
] as const;

export async function assertAlphaBackendCompatible(): Promise<AlphaBackendInfo> {
  if (!supabase) {
    throw new Error('Supabase is not configured for this build.');
  }

  const { data, error } = await supabase.rpc('alpha_backend_info');
  if (error) throw error;

  const info = data as AlphaBackendInfo | null;
  if (!info || info.contract_version !== EXPECTED_ALPHA_CONTRACT_VERSION) {
    throw new Error('This app build is incompatible with the configured alpha backend.');
  }

  if (info.alpha_scope !== 'smartphone-private-inventory') {
    throw new Error('The configured backend is not an Asset Market smartphone alpha backend.');
  }

  const advertised = new Set(info.capabilities ?? []);
  const missing = requiredCapabilities.filter((capability) => !advertised.has(capability));
  if (missing.length > 0) {
    throw new Error(`Alpha backend is missing required capabilities: ${missing.join(', ')}`);
  }

  return info;
}
