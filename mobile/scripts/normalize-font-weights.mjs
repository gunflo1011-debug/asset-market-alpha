import fs from 'node:fs';

const appPath = new URL('../App.tsx', import.meta.url);
const source = fs.readFileSync(appPath, 'utf8');
const normalized = source.replaceAll("fontWeight:'750'", "fontWeight:'700'");

if (normalized !== source) {
  fs.writeFileSync(appPath, normalized);
  console.log('Normalized unsupported React Native fontWeight 750 to 700.');
} else {
  console.log('Font weights already normalized.');
}
