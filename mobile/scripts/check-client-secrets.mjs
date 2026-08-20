import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.env', '.example']);
const ignored = new Set(['node_modules', 'dist', 'dist-ci', '.expo']);

const forbiddenPatterns = [
  { label: 'Supabase service-role variable', pattern: /SUPABASE_SERVICE_ROLE(?:_KEY)?/i },
  { label: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]+/ },
  { label: 'service_role JWT claim', pattern: /["']role["']\s*:\s*["']service_role["']/i },
];

async function walk(dir) {
  const matches = [];
  for (const entry of await readdir(dir)) {
    if (ignored.has(entry)) continue;
    const path = join(dir, entry);
    const info = await stat(path);
    if (info.isDirectory()) {
      matches.push(...await walk(path));
      continue;
    }
    const ext = extname(entry);
    if (!allowedExtensions.has(ext) && !entry.startsWith('.env')) continue;
    const text = await readFile(path, 'utf8');
    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(text)) {
        matches.push(`${relative(root, path)}: ${rule.label}`);
      }
    }
  }
  return matches;
}

const matches = await walk(root);
if (matches.length) {
  console.error('Client-secret safety check failed:');
  for (const match of matches) console.error(`- ${match}`);
  console.error('Never ship Supabase service-role/secret credentials in an Expo client.');
  process.exit(1);
}

console.log('Client-secret safety check passed.');
