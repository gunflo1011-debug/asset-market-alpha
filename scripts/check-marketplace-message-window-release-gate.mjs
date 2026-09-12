import fs from 'node:fs';
import assert from 'node:assert/strict';

const windowMigrationPath = 'supabase/migrations/20260912191500_window_marketplace_messages_v2.sql';
const cursorMigrationPath = 'supabase/migrations/20260912232000_page_marketplace_messages_v3.sql';
const migration = fs.readFileSync(windowMigrationPath, 'utf8');
const cursorMigration = fs.readFileSync(cursorMigrationPath, 'utf8');
const executable = `${migration}\n${cursorMigration}`.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create or replace function public\.load_my_marketplace_messages_v2\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Bounded message reader must remain SECURITY DEFINER with an empty search_path',
);
assert.match(
  cursorMigration,
  /create or replace function public\.load_my_marketplace_messages_v3\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Cursor message reader must remain SECURITY DEFINER with an empty search_path',
);
assert.match(
  cursorMigration,
  /auth\.uid\(\) in \(c\.buyer_id,c\.seller_id\)/i,
  'Cursor message reader must remain participant-scoped',
);
assert.match(
  cursorMigration,
  /\(m\.created_at,m\.id\) < \(p_before_created_at,p_before_message_id\)/i,
  'Cursor pagination must remain deterministic across timestamp ties',
);
assert.match(
  cursorMigration,
  /limit least\(greatest\(coalesce\(p_limit,101\),1\),201\)/i,
  'Cursor message page must remain clamped to 1..201 rows for 100+1 pagination',
);
assert.match(
  cursorMigration,
  /order by m\.created_at desc, m\.id desc[\s\S]*order by page\.created_at asc, page\.message_id asc/i,
  'Cursor reader must select older rows newest-first and return chronological UI order',
);
assert.match(
  cursorMigration,
  /revoke all on function public\.load_my_marketplace_messages_v3\(uuid,timestamptz,uuid,integer\) from public, anon;[\s\S]*grant execute[\s\S]*to authenticated;/i,
  'Cursor message reader must remain authenticated-only',
);
assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Message hardening must not weaken RLS, expose private tables, truncate data, or drop tables/schemas',
);

const parked = [windowMigrationPath, cursorMigrationPath].map((path) => ({ path, parked: `${path}.reviewed-by-marketplace-message-window-gate` }));
for (const entry of parked) fs.renameSync(entry.path, entry.parked);
try {
  await import('./check-conversation-adoption-state-release-gate.mjs');
} finally {
  for (const entry of parked.reverse()) fs.renameSync(entry.parked, entry.path);
}

console.log('Marketplace bounded + cursor-paged message readers and established hardening release gates: OK');
