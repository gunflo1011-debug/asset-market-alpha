import { discardConciergeDraft, loadConciergeDraft, saveConciergeDraft, ConciergeDraftStorage } from '../src/data/conciergeDraft';

class MemoryStorage implements ConciergeDraftStorage {
  private value: string | null = null;
  async getItem() { return this.value; }
  async setItem(_key: string, value: string) { this.value = value; }
  async removeItem() { this.value = null; }
}

const intake = {
  model: 'iPhone 14 Pro', storageGb: 256, condition: 'GOOD' as const, defects: 'Small scratch', batteryHealth: 91,
  activationLockRemoved: true, lawfulOwnershipConfirmed: true, priceFloorCents: 45000, localArea: 'Karlsruhe',
};

async function main() {
  const storage = new MemoryStorage();
  if (await loadConciergeDraft(storage) !== null) throw new Error('empty storage must not restore a draft');
  await saveConciergeDraft(storage, intake);
  const restored = await loadConciergeDraft(storage);
  if (!restored || restored.version !== 1 || restored.intake.model !== intake.model || restored.intake.priceFloorCents !== 45000) throw new Error('saved draft must restore intact');
  await discardConciergeDraft(storage);
  if (await loadConciergeDraft(storage) !== null) throw new Error('discard must remove the draft');

  const corrupt = new MemoryStorage();
  await corrupt.setItem('ignored', '{broken');
  if (await loadConciergeDraft(corrupt) !== null) throw new Error('corrupt draft must fail closed');
  console.log('concierge draft lifecycle ok');
}

void main();
