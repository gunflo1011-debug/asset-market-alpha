import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'supabase/migrations/20260830192000_marketplace_conversation_v1.sql';
const sql = fs.readFileSync(path, 'utf8');

assert.match(sql, /create table if not exists private\.marketplace_conversations/i);
assert.match(sql, /unique\(item_id, buyer_id\)/i);
assert.match(sql, /check \(buyer_id <> seller_id\)/i);
assert.match(sql, /create table if not exists private\.marketplace_messages/i);
assert.match(sql, /char_length\(btrim\(body\)\) between 1 and 1200/i);
assert.match(sql, /revoke all on table private\.marketplace_conversations from public, anon, authenticated/i);
assert.match(sql, /revoke all on table private\.marketplace_messages from public, anon, authenticated/i);

for (const fn of ['open_my_marketplace_conversation', 'send_my_marketplace_message', 'load_my_marketplace_conversations', 'load_my_marketplace_messages']) {
  const block = sql.match(new RegExp(`create or replace function public\\.${fn}[\\s\\S]*?\\$\\$;`, 'i'))?.[0] ?? '';
  assert.ok(block, `missing ${fn}`);
  assert.match(block, /security definer/i);
  assert.match(block, /set search_path = ''/i, `${fn} must pin an empty search_path`);
}

assert.match(sql, /where l\.item_id = p_item_id and l\.status = 'PUBLISHED'/i);
assert.match(sql, /i\.buyer_id = v_buyer[\s\S]*i\.seller_id = v_seller[\s\S]*i\.status = 'INTERESTED'/i);
assert.match(sql, /OWN_LISTING_CHAT_NOT_ALLOWED/i);
assert.match(sql, /where c\.id=p_conversation_id and v_user in \(c\.buyer_id,c\.seller_id\)/i);
assert.match(sql, /CONVERSATION_CLOSED/i);
assert.match(sql, /where auth\.uid\(\) in \(c\.buyer_id,c\.seller_id\)/i);

const conversationReturn = sql.match(/create or replace function public\.load_my_marketplace_conversations\(\)[\s\S]*?returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] ?? '';
const messageReturn = sql.match(/create or replace function public\.load_my_marketplace_messages\(p_conversation_id uuid\)[\s\S]*?returns table\(([\s\S]*?)\)\s*language sql/i)?.[1] ?? '';
assert.ok(conversationReturn && messageReturn, 'conversation return contracts missing');
assert.doesNotMatch(conversationReturn, /buyer_id|seller_id|email|phone|address|location/i);
assert.doesNotMatch(messageReturn, /sender_id|buyer_id|seller_id|email|phone|address|location/i);
assert.match(messageReturn, /sender_role text/i);

for (const signature of [
  'open_my_marketplace_conversation\\(uuid\\)',
  'send_my_marketplace_message\\(uuid,text\\)',
  'load_my_marketplace_conversations\\(\\)',
  'load_my_marketplace_messages\\(uuid\\)',
]) {
  assert.match(sql, new RegExp(`revoke all on function public\\.${signature} from public, anon;`, 'i'));
  assert.match(sql, new RegExp(`grant execute on function public\\.${signature} to authenticated;`, 'i'));
}

console.log('marketplace conversation privacy/release contract: OK');
