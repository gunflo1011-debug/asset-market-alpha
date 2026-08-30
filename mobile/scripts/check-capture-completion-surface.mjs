import fs from 'node:fs';

const screen = fs.readFileSync(new URL('../src/features/inventory/InventoryScreen.tsx', import.meta.url), 'utf8');

for (const marker of [
  "Keyboard",
  "isSuccessfulCaptureMessage",
  "setCaptureOpen(false)",
  "Keyboard.dismiss()",
  "Thing added to your inventory.",
  "Device saved privately.",
]) {
  if (!screen.includes(marker)) throw new Error(`Missing capture completion contract: ${marker}`);
}

if (!/useEffect\(\(\) => \{[\s\S]*!props\.editingItemId[\s\S]*isSuccessfulCaptureMessage\(props\.message\)[\s\S]*setCaptureOpen\(false\)[\s\S]*Keyboard\.dismiss\(\)/s.test(screen)) {
  throw new Error('Successful non-edit capture must close the form and dismiss the keyboard.');
}

console.log('capture completion surface regression passed');
