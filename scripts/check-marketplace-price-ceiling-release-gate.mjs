import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260911052000_align_marketplace_offer_price_ceiling.sql';
const parkedPath = `${migrationPath}.reviewed-by-marketplace-price-ceiling-gate`;
const migration = fs.readFileSync(migrationPath, 'utf8');
const executable = migration.replace(/--.*$/gm, '');

assert.match(
  migration,
  /where\s+amount_cents\s*>\s*1000000000[\s\S]*raise exception 'MARKETPLACE_OFFER_PRICE_CEILING_PRECHECK_FAILED'/i,
  'Marketplace price ceiling migration must fail closed when historical offers exceed the target ceiling',
);
assert.match(
  migration,
  /add constraint marketplace_offers_amount_cents_check[\s\S]*check\s*\(\s*amount_cents\s*>=\s*1\s+and\s+amount_cents\s*<=\s*1000000000\s*\)/i,
  'Marketplace offer amount constraint must stay within the shared 1..1,000,000,000 cent range',
);

for (const rpc of ['make_my_marketplace_offer', 'respond_to_my_marketplace_offer']) {
  assert.match(
    migration,
    new RegExp(`create or replace function public\\.${rpc}\\([\\s\\S]*security definer[\\s\\S]*set search_path to ''`, 'i'),
    `${rpc} must remain SECURITY DEFINER with an empty search_path`,
  );
}

assert.match(
  migration,
  /p_amount_cents\s+is\s+null\s+or\s+p_amount_cents\s*<\s*1\s+or\s+p_amount_cents\s*>\s*1000000000/i,
  'Buyer offer validation must enforce the shared price ceiling',
);
assert.match(
  migration,
  /p_counter_amount_cents\s+is\s+null\s+or\s+p_counter_amount_cents\s*<\s*1\s+or\s+p_counter_amount_cents\s*>\s*1000000000/i,
  'Counter-offer validation must enforce the shared price ceiling',
);
assert.match(migration, /if\s+v_user\s*<>\s*v_buyer\s+then\s+raise exception 'BUYER_ONLY'/i);
assert.match(migration, /if\s+v_user\s*=\s*v_proposer\s+then\s+raise exception 'PROPOSER_CANNOT_RESPOND'/i);
assert.match(migration, /if\s+v_conversation_status\s*<>\s*'OPEN'\s+then\s+raise exception 'CONVERSATION_NOT_OPEN'/i);
assert.match(migration, /perform\s+pg_catalog\.pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(v_item::text,\s*0\)\)/i);
assert.match(migration, /set status='RESERVED',\s*updated_at=now\(\)/i);
assert.match(migration, /set status='CLOSED',\s*updated_at=now\(\)[\s\S]*status in \('OPEN','RESERVED'\)/i);
assert.match(migration, /set status='WITHDRAWN',\s*published_at=null,\s*updated_at=now\(\)/i);

assert.doesNotMatch(
  executable,
  /\b(?:create|alter|drop)\s+policy\b|\bdisable\s+row\s+level\s+security\b|\bgrant\s+(?:select|insert|update|delete|all).*private\.|\btruncate\b|\bdrop\s+(?:table|schema)\b/i,
  'Marketplace price ceiling migration must not weaken RLS, expose private tables, truncate data, or drop tables/schemas',
);
assert.doesNotMatch(
  executable,
  /\b(?:serial_number|seller_email|exact_address|storage_path)\b/i,
  'Marketplace price ceiling migration must not introduce unrelated private seller fields',
);

fs.renameSync(migrationPath, parkedPath);
try {
  await import('./check-marketplace-foreign-key-index-release-gate.mjs');
} finally {
  fs.renameSync(parkedPath, migrationPath);
}

console.log('Marketplace price ceiling + established hardening release gate: OK');
