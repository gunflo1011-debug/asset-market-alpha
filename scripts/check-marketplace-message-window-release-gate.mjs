import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260912191500_window_marketplace_messages_v2.sql';
const parkedPath = `${migrationPath}.reviewed-by-marketplace-message-window-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create or replace function public\.load_my_marketplace_messages_v2\([\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Bounded message reader must remain SECURITY DEFINER with an empty search_path',
);
assert.match(
  migration,
  /auth\.uid\(\) in \(c\.buyer_id,c\.seller_id\)/i,
  'Bounded message reader must remain participant-scoped',
);
assert.match(
  migration,
  /limit least\(greatest\(coalesce\(p_limit,100\),1\),200\)/i,
  'Message window must remain clamped to 1..200 rows',
);
assert.match(
  migration,
  /order by m\.created_at desc, m\.id desc[\s\S]*order by recent\.created_at asc, recent\.message_id asc/i,
  'Message reader must select the newest rows deterministically and return chronological UI order',
);
assert.match(
  migration,
  /revoke all on function public\.load_my_marketplace_messages_v2\(uuid,integer\) from public, anon;[\s\S]*grant execute[\s\S]*to authenticated;/i,
  'Bounded message reader must remain authenticated-only',
);
assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Message-window hardening must not weaken RLS, expose private tables, truncate data, or drop tables/schemas',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-conversation-adoption-state-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace bounded-message reader + established hardening release gates: OK');
