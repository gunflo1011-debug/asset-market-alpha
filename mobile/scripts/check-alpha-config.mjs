const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error(`Missing required mobile alpha configuration: ${missing.join(', ')}`);
  process.exit(1);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

try {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS');
  if (!parsed.hostname.endsWith('.supabase.co') && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Supabase URL must target a Supabase project or local development');
  }
} catch (error) {
  console.error(`Invalid EXPO_PUBLIC_SUPABASE_URL: ${error.message}`);
  process.exit(1);
}

if (/service[_-]?role|secret/i.test(key)) {
  console.error('A privileged Supabase key must never be bundled into the mobile app.');
  process.exit(1);
}

console.log('Mobile alpha environment configuration is structurally safe.');
