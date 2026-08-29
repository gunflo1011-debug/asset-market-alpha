import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDir = path.resolve('supabase/migrations');

// Hosted Supabase security advisor baseline observed 2026-08-29.
// This gate does not claim these functions are safe; it prevents silently adding
// new SECURITY DEFINER RPC surface before the existing functions are reviewed.
const allowed = new Set([
  'add_private_device',
  'add_private_thing',
  'delete_private_device',
  'delete_private_thing',
  'estimate_my_item_value_v1',
  'load_interest_summary_for_my_listings',
  'load_marketplace_v1',
  'load_my_inventory_market_states',
  'load_my_inventory_values',
  'load_my_marketplace_interests',
  'load_my_marketplace_listings',
  'save_my_marketplace_listing',
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

// Track the final security mode after replaying migrations in filename order.
// A later CREATE OR REPLACE or ALTER FUNCTION must be able to harden a function
// from SECURITY DEFINER back to SECURITY INVOKER without leaving a false positive.
const finalSecurityMode = new Map();

for (const file of files) {
  const sql = await readFile(path.join(migrationsDir, file), 'utf8');
  const events = [];

  const declarationPattern = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-zA-Z0-9_]+)\s*\([^]*?\)\s*returns\b[^]*?\bas\s+\$\$/gi;
  for (const match of sql.matchAll(declarationPattern)) {
    events.push({
      index: match.index,
      name: match[1],
      mode: /\bsecurity\s+definer\b/i.test(match[0]) ? 'definer' : 'invoker',
    });
  }

  const alterPattern = /alter\s+function\s+public\.([a-zA-Z0-9_]+)\s*\([^;]*?\)\s+security\s+(definer|invoker)\s*;/gi;
  for (const match of sql.matchAll(alterPattern)) {
    events.push({
      index: match.index,
      name: match[1],
      mode: match[2].toLowerCase(),
    });
  }

  events.sort((a, b) => a.index - b.index);
  for (const event of events) finalSecurityMode.set(event.name, event.mode);
}

const found = new Set(
  [...finalSecurityMode.entries()]
    .filter(([, mode]) => mode === 'definer')
    .map(([name]) => name),
);

const unexpected = [...found].filter((name) => !allowed.has(name)).sort();
if (unexpected.length > 0) {
  console.error('Unexpected SECURITY DEFINER functions found:');
  for (const name of unexpected) console.error(`- public.${name}`);
  console.error('Review authorization, EXECUTE grants, search_path, and whether SECURITY INVOKER is sufficient before updating the baseline.');
  process.exit(1);
}

console.log(`SECURITY DEFINER baseline gate passed (${found.size} known function name${found.size === 1 ? '' : 's'} found in final migration state).`);
