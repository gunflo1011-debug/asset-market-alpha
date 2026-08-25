import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const surface = fs.readFileSync(path.join(root, 'src/lib/activationDebugSurface.ts'), 'utf8');
const summary = fs.readFileSync(path.join(root, 'src/lib/activationSummary.ts'), 'utf8');
const transitions = fs.readFileSync(path.join(root, 'src/lib/activationAppTransitions.ts'), 'utf8');

const required = [
  "getLocalActivationSummary",
  "Local activation funnel",
  "stage.name",
  "stage.count",
  "summary.completed",
  "Process-local aggregate only",
];
for (const token of required) {
  if (!surface.includes(token)) throw new Error(`activation debug surface missing: ${token}`);
}

const forbidden = [
  'fetch(', 'AsyncStorage', 'supabase', 'userId', 'user_id', 'itemId', 'item_id',
  'price', 'estimatedValue', 'timestamp', 'location', 'deviceId', 'device_id',
];
for (const token of forbidden) {
  if (surface.includes(token)) throw new Error(`activation debug surface violates privacy boundary: ${token}`);
}

for (const stage of ['CAPTURE_SUCCESS', 'INVENTORY_VISIBLE', 'VALUE_VISIBLE', 'SELL_INITIATED']) {
  if (!summary.includes(stage)) throw new Error(`summary missing funnel stage: ${stage}`);
}

for (const hook of ['recordCaptureSuccess', 'recordInventoryVisible', 'recordValueVisible', 'recordSellInitiated']) {
  if (!transitions.includes(hook)) throw new Error(`app transition hook missing: ${hook}`);
}

console.log('activation debug surface regression: ok');
