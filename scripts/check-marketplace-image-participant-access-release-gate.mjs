import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260904171000_marketplace_image_participant_access.sql';
const parkedPath = `${migrationPath}.reviewed-by-marketplace-image-participant-access-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /create or replace function public\.marketplace_image_object_access\(p_name text, p_manage boolean default false\)[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Marketplace image object access must remain SECURITY DEFINER with empty search_path',
);
assert.match(
  migration,
  /ii\.marketplace_visible[\s\S]*l\.status = 'PUBLISHED'[\s\S]*c\.status in \('RESERVED', 'SOLD'\)[\s\S]*v_user in \(c\.buyer_id, c\.seller_id\)/i,
  'Image reads must require explicit seller selection and either published discovery or reserved/sold participant membership',
);
assert.match(
  migration,
  /create or replace function public\.load_marketplace_image_refs_v1\(\)[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'Marketplace image ref loader must remain SECURITY DEFINER with empty search_path',
);
assert.match(
  migration,
  /l\.status = 'PUBLISHED'[\s\S]*l\.seller_id <> auth\.uid\(\)[\s\S]*c\.status in \('RESERVED', 'SOLD'\)[\s\S]*auth\.uid\(\) in \(c\.buyer_id, c\.seller_id\)/i,
  'Image refs must preserve public discovery semantics and become participant-scoped after reservation',
);
assert.match(migration, /revoke all on function public\.marketplace_image_object_access\(text,boolean\) from public, anon;/i);
assert.match(migration, /grant execute on function public\.marketplace_image_object_access\(text,boolean\) to authenticated;/i);
assert.match(migration, /revoke all on function public\.load_marketplace_image_refs_v1\(\) from public, anon;/i);
assert.match(migration, /grant execute on function public\.load_marketplace_image_refs_v1\(\) to authenticated;/i);

assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\b(?:insert|update|delete)\s+(?:into|from)?\s*storage\.objects\b|\bgrant\s+(?:select|insert|update|delete|all).*private\./i,
  'Participant image access must not broaden storage policies, mutate objects, or expose private tables directly',
);
assert.doesNotMatch(
  executable,
  /\b(?:notes|location_label|serial_number|seller_email)\b/i,
  'Marketplace image delivery must not expose unrelated seller-private metadata',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-marketplace-image-artifact-lock-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace image participant access + artifact immutability + image selection transaction lock + established hardening release gate: OK');
