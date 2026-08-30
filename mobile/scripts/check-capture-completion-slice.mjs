import fs from 'node:fs';
const screen = fs.readFileSync(new URL('../src/features/inventory/InventoryScreen.tsx', import.meta.url), 'utf8');
if (!screen.includes('Keyboard.dismiss()') || !screen.includes('setCaptureOpen(false)')) {
  throw new Error('Successful capture must close the form and dismiss the keyboard.');
}
console.log('capture completion slice accepted');
