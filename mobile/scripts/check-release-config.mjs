import fs from 'node:fs';

const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error(`Missing required mobile release configuration: ${missing.join(', ')}`);
  process.exit(1);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

try {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS');
  if (!parsed.hostname.endsWith('.supabase.co')) {
    throw new Error('Release builds must target a hosted Supabase project');
  }
} catch (error) {
  console.error(`Invalid EXPO_PUBLIC_SUPABASE_URL: ${error.message}`);
  process.exit(1);
}

if (/service[_-]?role|secret/i.test(key)) {
  console.error('A privileged Supabase key must never be bundled into the mobile app.');
  process.exit(1);
}

const appConfig = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const expo = appConfig.expo ?? {};
const failures = [];

if (expo.name !== 'Things') failures.push('expo.name must be Things');
if (expo.slug !== 'things') failures.push('expo.slug must be things');
if (expo.scheme !== 'things') failures.push('expo.scheme must be things');
if (expo.version !== '1.0.0') failures.push('expo.version must be 1.0.0 for the first production candidate');
if (expo.android?.package !== 'com.gunflo1011.things') failures.push('android.package must use the production Things application id');

const serialized = JSON.stringify(appConfig).toLowerCase();
if (serialized.includes('things-alpha') || serialized.includes('thingsalpha')) {
  failures.push('release app config must not contain alpha product identifiers');
}

if (failures.length) {
  console.error('Mobile release configuration is not production-ready:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Mobile release configuration is structurally production-ready.');
