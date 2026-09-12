import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260912151000_conversation_adoption_state_continuity.sql';
const parkedPath = `${migrationPath}.reviewed-by-conversation-adoption-state-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create function public\.load_my_marketplace_conversations\(\)[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Conversation reader must remain SECURITY DEFINER with an empty search_path',
);
assert.match(
  migration,
  /case when c\.buyer_id = auth\.uid\(\) then a\.adopted_item_id else null end/i,
  'Adopted inventory id must be visible only to the buyer',
);
assert.match(
  migration,
  /left join private\.marketplace_buyer_adoptions a[\s\S]*a\.conversation_id = c\.id[\s\S]*a\.buyer_id = auth\.uid\(\)/i,
  'Adoption state join must be constrained to the current buyer',
);
assert.match(
  migration,
  /where auth\.uid\(\) in \(c\.buyer_id, c\.seller_id\)/i,
  'Conversation reader must remain participant-scoped',
);
assert.match(
  migration,
  /coalesce\(nullif\(btrim\(l\.public_title\), ''\), 'Thing'\) as title/i,
  'Conversation title must remain sourced from the frozen public listing snapshot',
);
assert.match(
  migration,
  /case when c\.status = 'SOLD' then l\.sold_price_cents else null end/i,
  'Final sale price exposure must remain SOLD-only',
);
assert.match(
  migration,
  /revoke all on function public\.load_my_marketplace_conversations\(\) from public;[\s\S]*revoke all[\s\S]*from anon;[\s\S]*grant execute[\s\S]*to authenticated;/i,
  'Conversation reader must remain authenticated-only',
);
assert.doesNotMatch(
  executable,
  /\b(?:i\.custom_name|location_label|notes|serial|storage_path)\b/i,
  'Adoption continuity must not read seller-private Thing metadata',
);
assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Adoption continuity must not weaken RLS, expose private tables, truncate data, or drop tables/schemas',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-conversation-title-continuity-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace buyer adoption-state continuity + established hardening release gates: OK');
