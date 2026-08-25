import { createClient } from '@supabase/supabase-js';

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'ALPHA_TEST_A_EMAIL',
  'ALPHA_TEST_A_PASSWORD',
  'ALPHA_TEST_B_EMAIL',
  'ALPHA_TEST_B_PASSWORD',
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url.startsWith('https://')) throw new Error('Supabase URL must use HTTPS.');
if (/service_role|secret/i.test(key)) throw new Error('Refusing to run with a privileged Supabase key.');

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const a = client();
const b = client();
const anon = client();
const ids = new Set();
const pass = (label) => console.log(`✓ ${label}`);

async function signIn(supabase, email, password, label) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw error ?? new Error(`${label} authentication returned no user.`);
  pass(`${label} authenticated through normal anon-key client`);
  return data.user;
}

async function readOwnInventory(supabase, expectedOwner, label) {
  const { data, error } = await supabase.from('items').select('id, owner_id').order('created_at', { ascending: false });
  if (error) throw error;
  if ((data ?? []).some((item) => item.owner_id !== expectedOwner)) {
    throw new Error(`${label} privacy failure: cross-owner item visible.`);
  }
  for (const item of data ?? []) ids.add(item.id);
  pass(`${label} inventory contains only own rows (${data?.length ?? 0} visible)`);
  return data ?? [];
}

async function assertNoKnownForeignIds(rows, foreignIds, label) {
  if (rows.some((row) => foreignIds.has(row.id))) throw new Error(`${label} privacy failure: foreign item id visible.`);
  pass(`${label} cannot see known foreign inventory rows`);
}

async function main() {
  const userA = await signIn(a, process.env.ALPHA_TEST_A_EMAIL, process.env.ALPHA_TEST_A_PASSWORD, 'Account A');
  const rowsA = await readOwnInventory(a, userA.id, 'Account A');
  const aIds = new Set(rowsA.map((row) => row.id));

  const userB = await signIn(b, process.env.ALPHA_TEST_B_EMAIL, process.env.ALPHA_TEST_B_PASSWORD, 'Account B');
  if (userA.id === userB.id) throw new Error('Two-user smoke requires two distinct normal accounts.');
  const rowsB = await readOwnInventory(b, userB.id, 'Account B');
  const bIds = new Set(rowsB.map((row) => row.id));
  await assertNoKnownForeignIds(rowsB, aIds, 'Account B');
  await assertNoKnownForeignIds(rowsA, bIds, 'Account A');

  const { data: anonRows, error: anonError } = await anon.from('items').select('id').limit(1);
  if (!anonError && (anonRows?.length ?? 0) > 0) throw new Error('Anonymous privacy failure: private item row readable.');
  pass('anonymous client cannot read private inventory rows');

  await a.auth.signOut();
  await b.auth.signOut();
  console.log('Two-user runtime RLS smoke passed. No writes were performed.');
}

main().catch(async (error) => {
  console.error('Two-user runtime RLS smoke failed.');
  console.error(error instanceof Error ? error.message : error);
  try { await a.auth.signOut(); } catch {}
  try { await b.auth.signOut(); } catch {}
  process.exitCode = 1;
});
