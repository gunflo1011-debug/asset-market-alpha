import { ConciergeSmartphoneIntake } from './conciergeIntake';

export type ConciergeDraftStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const DRAFT_KEY = 'things.concierge.smartphone-draft.v1';

export type ConciergeDraft = {
  version: 1;
  savedAt: string;
  intake: ConciergeSmartphoneIntake;
};

export async function loadConciergeDraft(storage: ConciergeDraftStorage): Promise<ConciergeDraft | null> {
  const raw = await storage.getItem(DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ConciergeDraft>;
    if (parsed.version !== 1 || typeof parsed.savedAt !== 'string' || !parsed.intake) {
      await storage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed as ConciergeDraft;
  } catch {
    await storage.removeItem(DRAFT_KEY);
    return null;
  }
}

export async function saveConciergeDraft(storage: ConciergeDraftStorage, intake: ConciergeSmartphoneIntake): Promise<ConciergeDraft> {
  const draft: ConciergeDraft = { version: 1, savedAt: new Date().toISOString(), intake };
  await storage.setItem(DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

export async function discardConciergeDraft(storage: ConciergeDraftStorage): Promise<void> {
  await storage.removeItem(DRAFT_KEY);
}
