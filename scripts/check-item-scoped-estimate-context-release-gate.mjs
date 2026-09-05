import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260905062000_item_scoped_estimate_context.sql';
const parkedPath = `${migrationPath}.reviewed-by-item-scoped-estimate-context-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

for (const [signature, ownerPredicate] of [
  ['load_my_item_value\\(p_item_id uuid\\)', /i\.owner_id = auth\.uid\(\)/i],
  ['load_my_item_purchase_context\\(p_item_id uuid\\)', /i\.owner_id = auth\.uid\(\)/i],
]) {
  assert.match(
    migration,
    new RegExp(`create or replace function public\\.${signature}[\\s\\S]*security definer[\\s\\S]*set search_path = ''`, 'i'),
    `${signature} must remain SECURITY DEFINER with an empty search_path`,
  );
  assert.match(migration, ownerPredicate, `${signature} must remain current-owner scoped`);
}

assert.match(
  migration,
  /load_my_item_value\(p_item_id uuid\)[\s\S]*e\.item_id = p_item_id[\s\S]*i\.owner_id = auth\.uid\(\)[\s\S]*order by e\.observed_at desc, e\.created_at desc[\s\S]*limit 1/i,
  'Item value projection must return only the latest evidence for the requested owned Thing',
);
assert.match(
  migration,
  /load_my_item_purchase_context\(p_item_id uuid\)[\s\S]*a\.adopted_item_id = p_item_id[\s\S]*a\.buyer_id = auth\.uid\(\)/i,
  'Purchase context must require the requested adopted Thing and authenticated buyer',
);

for (const signature of [
  'load_my_item_value\\(uuid\\)',
  'load_my_item_purchase_context\\(uuid\\)',
]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Item-scoped Estimate context must not weaken RLS, expose private tables, or perform destructive schema/data operations',
);
assert.doesNotMatch(
  executable,
  /\b(?:notes|location_label|serial_number|seller_email|storage_path)\b/i,
  'Item-scoped Estimate context must not expose seller-private metadata',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-marketplace-interest-index-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('item-scoped Estimate context + established hardening release gate: OK');
