import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'supabase/migrations/20260825104500_owner_inventory_market_state.sql';
const sql = fs.readFileSync(path, 'utf8');

const required = [
  /create or replace function public\.load_my_inventory_market_states\(\)/i,
  /security definer/i,
  /set search_path = ''/i,
  /join public\.items i on i\.id = ims\.item_id/i,
  /where i\.owner_id = auth\.uid\(\)/i,
  /revoke all on function public\.load_my_inventory_market_states\(\) from public, anon/i,
  /grant execute on function public\.load_my_inventory_market_states\(\) to authenticated/i,
];
for (const rule of required) assert.match(sql, rule);

// Contract: this migration is read-only with respect to product data/schema.
for (const forbidden of [
  /\binsert\s+into\b/i,
  /\bupdate\s+(public|private)\./i,
  /\bdelete\s+from\b/i,
  /\bdrop\s+(table|schema)\b/i,
  /\balter\s+table\b/i,
]) assert.doesNotMatch(sql, forbidden);

console.log('owner market-state migration contract: OK');
