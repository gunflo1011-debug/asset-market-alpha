import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'supabase/migrations/20260831024500_marketplace_reserve_sold_v1.sql';
const sql = fs.readFileSync(path, 'utf8');

const block = sql.match(/create or replace function public\.set_my_marketplace_conversation_status[\s\S]*?\$\$;/i)?.[0] ?? '';
assert.ok(block, 'Marketplace lifecycle RPC missing');
assert.match(block, /security definer/i);
assert.match(block, /set search_path = ''/i);
assert.match(block, /where c\.id = p_conversation_id and c\.seller_id = v_seller/i, 'lifecycle mutation must be seller-owned');
assert.match(block, /p_status not in \('RESERVED','SOLD'\)/i);
assert.match(block, /p_status = 'SOLD' and v_current <> 'RESERVED'/i, 'sold must require reservation first');
assert.match(block, /set status = 'CLOSED'[\s\S]*item_id = v_item[\s\S]*id <> p_conversation_id/i, 'competing conversations must close');
assert.match(block, /update private\.marketplace_listings[\s\S]*set status = 'WITHDRAWN'/i, 'reserved/sold Thing must leave public discovery');
assert.match(block, /insert into private\.item_market_state[\s\S]*p_status/i, 'Thing lifecycle source must reflect reserved/sold');
assert.doesNotMatch(block, /delete from|truncate|owner_id\s*=|buyer_id\s*=/i, 'lifecycle RPC must not destructively mutate user data or transfer ownership');
assert.match(sql, /revoke all on function public\.set_my_marketplace_conversation_status\(uuid,text\) from public, anon;/i);
assert.match(sql, /grant execute on function public\.set_my_marketplace_conversation_status\(uuid,text\) to authenticated;/i);

console.log('marketplace reserve/sold lifecycle privacy/release contract: OK');
