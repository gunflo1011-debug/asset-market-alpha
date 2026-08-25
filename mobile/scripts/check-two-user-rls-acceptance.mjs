import fs from 'node:fs';

const auth = fs.readFileSync(new URL('../src/data/auth.ts', import.meta.url), 'utf8');
const inventory = fs.readFileSync(new URL('../src/data/inventory.ts', import.meta.url), 'utf8');
const core = fs.readFileSync(new URL('../../supabase/migrations/20260819171000_core.sql', import.meta.url), 'utf8');
const smoke = fs.readFileSync(new URL('./hosted-alpha-smoke.mjs', import.meta.url), 'utf8');

function requireMatch(source, pattern, label) {
  if (!pattern.test(source)) throw new Error(`Two-user RLS acceptance contract missing: ${label}`);
}

// Normal auth path must exist; acceptance must never depend on service-role/admin bypass.
requireMatch(auth, /signInWithPassword/, 'password sign-in');
requireMatch(auth, /auth\.signUp/, 'normal signup');
requireMatch(auth, /auth\.signOut/, 'logout');
requireMatch(auth, /auth\.getSession/, 'session restore');

// Private inventory must use the authenticated client and owner-safe commands.
requireMatch(inventory, /from\('items'\)/, 'private inventory read');
requireMatch(inventory, /rpc\('add_private_device'/, 'private inventory write command');

// Database contract: FORCE RLS plus owner-only item and condition access.
requireMatch(core, /alter table public\.items force row level security/i, 'FORCE RLS on items');
requireMatch(core, /alter table public\.condition_snapshots force row level security/i, 'FORCE RLS on condition snapshots');
requireMatch(core, /create policy item_owner_select[\s\S]*?auth\.uid\(\)[\s\S]*?owner_id/i, 'owner-only item select');
requireMatch(core, /create policy item_owner_insert[\s\S]*?auth\.uid\(\)[\s\S]*?owner_id/i, 'owner-only item insert');
requireMatch(core, /create policy condition_owner_select[\s\S]*?i\.owner_id[\s\S]*?auth\.uid\(\)/i, 'owner-only condition select');
requireMatch(core, /revoke all on public\.items from anon, authenticated/i, 'item grants reset before authenticated grants');
requireMatch(core, /revoke all on public\.condition_snapshots from anon, authenticated/i, 'condition grants reset before authenticated grants');

// Existing hosted smoke must refuse privileged keys and detect cross-owner leakage.
requireMatch(smoke, /service_role\|secret/i, 'privileged-key refusal');
requireMatch(smoke, /item\.owner_id !== auth\.user\.id/, 'cross-owner leakage assertion');

console.log('Two-user Auth/RLS acceptance static contract passed.');
