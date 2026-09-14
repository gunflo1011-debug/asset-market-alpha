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

const hasAccountCEmail = Boolean(process.env.ALPHA_TEST_C_EMAIL);
const hasAccountCPassword = Boolean(process.env.ALPHA_TEST_C_PASSWORD);
if (hasAccountCEmail !== hasAccountCPassword) {
  throw new Error('Account C runtime smoke requires both ALPHA_TEST_C_EMAIL and ALPHA_TEST_C_PASSWORD when either is provided.');
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url.startsWith('https://')) throw new Error('Supabase URL must use HTTPS.');
if (/service_role|secret/i.test(key)) throw new Error('Refusing to run with a privileged Supabase key.');

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = client();
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
  pass(`${label} inventory contains only own rows (${data?.length ?? 0} visible)`);
  return data ?? [];
}

function requireEvidenceRows(rows, label) {
  if (rows.length === 0) {
    throw new Error(`${label} has no inventory row. Create one disposable item through the normal app flow before running this smoke; empty inventories cannot prove account isolation.`);
  }
  pass(`${label} has at least one owned row for non-vacuous isolation evidence`);
}

async function assertNoKnownForeignIds(rows, foreignIds, label) {
  if (rows.some((row) => foreignIds.has(row.id))) throw new Error(`${label} privacy failure: foreign item id visible.`);
  pass(`${label} cannot see known foreign inventory rows`);
}

async function signOutQuietly(account) {
  try { await account.supabase.auth.signOut(); } catch {}
}

async function main() {
  const accountConfigs = [
    { label: 'Account A', email: process.env.ALPHA_TEST_A_EMAIL, password: process.env.ALPHA_TEST_A_PASSWORD },
    { label: 'Account B', email: process.env.ALPHA_TEST_B_EMAIL, password: process.env.ALPHA_TEST_B_PASSWORD },
  ];
  if (hasAccountCEmail && hasAccountCPassword) {
    accountConfigs.push({ label: 'Account C', email: process.env.ALPHA_TEST_C_EMAIL, password: process.env.ALPHA_TEST_C_PASSWORD });
  }

  const accounts = [];
  for (const config of accountConfigs) {
    const supabase = client();
    const user = await signIn(supabase, config.email, config.password, config.label);
    const rows = await readOwnInventory(supabase, user.id, config.label);
    requireEvidenceRows(rows, config.label);
    accounts.push({ ...config, supabase, user, rows, ids: new Set(rows.map((row) => row.id)) });
  }

  const distinctUserIds = new Set(accounts.map((account) => account.user.id));
  if (distinctUserIds.size !== accounts.length) {
    throw new Error(`${accounts.length}-account smoke requires distinct normal accounts.`);
  }

  for (const account of accounts) {
    for (const foreignAccount of accounts) {
      if (foreignAccount.user.id === account.user.id) continue;
      await assertNoKnownForeignIds(account.rows, foreignAccount.ids, `${account.label} vs ${foreignAccount.label}`);
    }
  }

  const { data: anonRows, error: anonError } = await anon.from('items').select('id').limit(1);
  if (!anonError && (anonRows?.length ?? 0) > 0) throw new Error('Anonymous privacy failure: private item row readable.');
  pass('anonymous client cannot read private inventory rows');

  for (const account of accounts) await signOutQuietly(account);
  console.log(`${accounts.length}-account runtime RLS smoke passed. No writes were performed.`);
}

main().catch(async (error) => {
  console.error('Multi-account runtime RLS smoke failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
