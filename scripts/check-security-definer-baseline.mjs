import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDir = path.resolve('supabase/migrations');

// Hosted Supabase security advisor baseline observed 2026-08-29 and reviewed additions.
// This gate prevents silently adding new SECURITY DEFINER RPC surface.
const allowed = new Set([
  'add_private_device',
  'add_private_thing',
  'adopt_my_sold_marketplace_thing',
  'delete_my_item_image',
  'delete_private_device',
  'delete_private_thing',
  'estimate_my_item_value_v1',
  'load_interest_summary_for_my_listings',
  'load_marketplace_image_refs_v1',
  'load_marketplace_v1',
  'load_marketplace_v2',
  'load_my_inventory_market_states',
  'load_my_inventory_values',
  'load_my_item_images',
  'load_my_market_value_v1',
  'load_my_marketplace_conversations',
  'load_my_marketplace_interests',
  'load_my_marketplace_listings',
  'load_my_marketplace_listings_v2',
  'load_my_marketplace_messages',
  'marketplace_image_object_access',
  'open_my_marketplace_conversation',
  'register_my_item_image',
  'save_my_marketplace_listing',
  'save_my_marketplace_listing_v2',
  'send_my_marketplace_message',
  'set_my_item_gtin_v1',
  'set_my_item_image_marketplace_visibility',
  'set_my_item_primary_image',
  'set_my_marketplace_conversation_status',
  'set_my_marketplace_conversation_status_v2',
  'set_my_marketplace_interest',
  'track_alpha_event',
  'update_private_device',
  'update_private_item_metadata',
  'update_private_thing',
  'withdraw_my_marketplace_listing',
]);

const files = (await readdir(migrationsDir))
  .filter((name) => name.endsWith('.sql'))
  .sort();

const finalSecurityMode = new Map();

for (const file of files) {
  const sql = await readFile(path.join(migrationsDir, file), 'utf8');
  const events = [];

  const declarationPattern = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-zA-Z0-9_]+)\s*\([^]*?\)\s*returns\b[^]*?\bas\s+\$\$/gi;
  for (const match of sql.matchAll(declarationPattern)) {
    events.push({ index: match.index, name: match[1], mode: /\bsecurity\s+definer\b/i.test(match[0]) ? 'definer' : 'invoker' });
  }

  const alterPattern = /alter\s+function\s+public\.([a-zA-Z0-9_]+)\s*\([^;]*?\)\s+security\s+(definer|invoker)\s*;/gi;
  for (const match of sql.matchAll(alterPattern)) {
    events.push({ index: match.index, name: match[1], mode: match[2].toLowerCase() });
  }

  events.sort((a, b) => a.index - b.index);
  for (const event of events) finalSecurityMode.set(event.name, event.mode);
}

const found = new Set([...finalSecurityMode.entries()].filter(([, mode]) => mode === 'definer').map(([name]) => name));
const unexpected = [...found].filter((name) => !allowed.has(name)).sort();
if (unexpected.length > 0) {
  console.error('Unexpected SECURITY DEFINER functions found:');
  for (const name of unexpected) console.error(`- public.${name}`);
  console.error('Review authorization, EXECUTE grants, search_path, and whether SECURITY INVOKER is sufficient before updating the baseline.');
  process.exit(1);
}

console.log(`SECURITY DEFINER baseline gate passed (${found.size} known function name${found.size === 1 ? '' : 's'} found in final migration state).`);
