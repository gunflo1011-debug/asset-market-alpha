import { createClient } from '@supabase/supabase-js';

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'ALPHA_TEST_EMAIL',
  'ALPHA_TEST_PASSWORD',
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.ALPHA_TEST_EMAIL;
const password = process.env.ALPHA_TEST_PASSWORD;
const writeMode = process.env.ALPHA_SMOKE_WRITE === '1';

if (!url.startsWith('https://')) throw new Error('Supabase URL must use HTTPS.');
if (/service_role|secret/i.test(key)) throw new Error('Refusing to run with a privileged Supabase key.');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function ok(label) {
  console.log(`✓ ${label}`);
}

async function main() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !auth.user) throw authError ?? new Error('Authentication returned no user.');
  ok('authenticated alpha test user');

  const { data: backendInfo, error: backendError } = await supabase.rpc('alpha_backend_info');
  if (backendError) throw backendError;
  const info = Array.isArray(backendInfo) ? backendInfo[0] : backendInfo;
  if (!info) throw new Error('alpha_backend_info returned no payload.');
  ok('backend compatibility endpoint reachable');

  const { data: catalog, error: catalogError } = await supabase
    .from('product_variants')
    .select('id, storage_gb, region, products(brand, family)')
    .limit(5);
  if (catalogError) throw catalogError;
  if (!catalog?.length) throw new Error('Catalog is empty; seed at least one product variant before alpha testing.');
  ok(`catalog readable (${catalog.length} variant${catalog.length === 1 ? '' : 's'} sampled)`);

  const { data: inventoryBefore, error: inventoryError } = await supabase
    .from('items')
    .select('id, owner_id, created_at')
    .order('created_at', { ascending: false });
  if (inventoryError) throw inventoryError;
  if ((inventoryBefore ?? []).some((item) => item.owner_id !== auth.user.id)) {
    throw new Error('RLS violation: inventory query returned an item owned by another user.');
  }
  ok(`private inventory RLS read passed (${inventoryBefore?.length ?? 0} visible items)`);

  if (writeMode) {
    const variantId = process.env.ALPHA_TEST_VARIANT_ID ?? catalog[0].id;
    const { data: itemId, error: writeError } = await supabase.rpc('add_private_device', {
      p_variant_id: variantId,
      p_color: 'CI smoke',
      p_display_state: 'INTACT',
      p_housing_state: 'CLEAN',
      p_cameras_working: true,
      p_biometrics_working: true,
      p_battery_health: null,
      p_network_locked: false,
      p_other_defect: false,
    });
    if (writeError) throw writeError;
    if (typeof itemId !== 'string') throw new Error('add_private_device returned no item id.');

    const { data: created, error: verifyError } = await supabase
      .from('items')
      .select('id, owner_id')
      .eq('id', itemId)
      .single();
    if (verifyError) throw verifyError;
    if (created.owner_id !== auth.user.id) throw new Error('Created item is not owned by authenticated test user.');
    ok(`private inventory write passed (${itemId})`);
  } else {
    console.log('ℹ write test skipped; set ALPHA_SMOKE_WRITE=1 for add_private_device verification');
  }

  await supabase.auth.signOut();
  console.log('Hosted closed-alpha smoke test passed.');
}

main().catch(async (error) => {
  console.error('Hosted closed-alpha smoke test failed.');
  console.error(error instanceof Error ? error.message : error);
  try { await supabase.auth.signOut(); } catch {}
  process.exitCode = 1;
});
