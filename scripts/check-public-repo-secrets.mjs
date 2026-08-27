import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((path) => path !== 'scripts/check-public-repo-secrets.mjs');

const forbiddenFilePatterns = [
  /(^|\/)\.env$/i,
  /(^|\/)\.env\.(?!example$|sample$|template$)[^/]+$/i,
  /(^|\/)id_rsa$/i,
  /(^|\/)id_ed25519$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.jks$/i,
  /\.keystore$/i,
];

const secretPatterns = [
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{16,}/g],
  ['GitHub classic token', /ghp_[A-Za-z0-9]{30,}/g],
  ['GitHub fine-grained token', /github_pat_[A-Za-z0-9_]{30,}/g],
  ['OpenAI-style secret key', /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g],
  ['Slack bot token', /xoxb-[A-Za-z0-9-]{20,}/g],
  ['AWS access key', /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['Credential-bearing Postgres URL', /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/gi],
];

const findings = [];
for (const path of tracked) {
  if (forbiddenFilePatterns.some((pattern) => pattern.test(path))) {
    findings.push(`${path}: sensitive file type must not be committed`);
    continue;
  }

  let source;
  try {
    source = fs.readFileSync(path, 'utf8');
  } catch {
    continue;
  }

  for (const [name, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) findings.push(`${path}: possible ${name}`);
  }
}

if (findings.length > 0) {
  console.error('Public repository secret guard failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`public repository secret guard passed (${tracked.length} tracked files checked)`);
