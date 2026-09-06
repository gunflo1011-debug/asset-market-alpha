import { requireSupabase } from './supabaseClient';

export type ItemImage = {
  id: string;
  storagePath: string;
  sortOrder: number;
  isPrimary: boolean;
  marketplaceVisible: boolean;
  createdAt: string;
  signedUrl: string;
};

export type InventoryCoverImageRef = {
  itemId: string;
  signedUrl: string;
};

export type MarketplaceImageRef = {
  itemId: string;
  imageId: string;
  sortOrder: number;
  signedUrl: string;
};

function extensionFromMime(mimeType: string | null | undefined): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function normalizeImageMime(mimeType: string | null): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (mimeType === 'image/png' || mimeType === 'image/webp') return mimeType;
  return 'image/jpeg';
}

export async function loadMyInventoryCoverImageRefs(): Promise<InventoryCoverImageRef[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('load_my_inventory_cover_image_refs_v1');
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const signedRefs = await Promise.all(rows.map(async (row): Promise<InventoryCoverImageRef | null> => {
    const storagePath = String(row.storage_path);
    const { data: signed, error: signedError } = await client.storage.from('thing-images').createSignedUrl(storagePath, 1800);
    if (signedError || !signed?.signedUrl) return null;
    return { itemId: String(row.item_id), signedUrl: signed.signedUrl };
  }));
  return signedRefs.filter((ref): ref is InventoryCoverImageRef => ref !== null);
}

export async function loadMyItemImages(itemId: string): Promise<ItemImage[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('load_my_item_images', { p_item_id: itemId });
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return Promise.all(rows.map(async (row) => {
    const storagePath = String(row.storage_path);
    const { data: signed, error: signedError } = await client.storage.from('thing-images').createSignedUrl(storagePath, 3600);
    if (signedError || !signed?.signedUrl) throw signedError ?? new Error('Could not open Thing image.');
    return {
      id: String(row.id),
      storagePath,
      sortOrder: Number(row.sort_order),
      isPrimary: Boolean(row.is_primary),
      marketplaceVisible: Boolean(row.marketplace_visible),
      createdAt: String(row.created_at),
      signedUrl: signed.signedUrl,
    };
  }));
}

export async function uploadMyItemImage(itemId: string, uri: string, mimeType?: string | null): Promise<void> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('Sign in again before adding a photo.');

  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read the selected photo.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('The selected photo is empty.');
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');

  const normalizedMime = mimeType === 'image/png' || mimeType === 'image/webp' ? mimeType : 'image/jpeg';
  const random = Math.random().toString(36).slice(2, 10);
  const path = `${userData.user.id}/${itemId}/${Date.now()}-${random}.${extensionFromMime(normalizedMime)}`;

  const { error: uploadError } = await client.storage.from('thing-images').upload(path, bytes, {
    contentType: normalizedMime,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error: registerError } = await client.rpc('register_my_item_image', {
    p_item_id: itemId,
    p_storage_path: path,
  });
  if (registerError) {
    await client.storage.from('thing-images').remove([path]);
    throw registerError;
  }
}

export async function setMyItemPrimaryImage(itemId: string, imageId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('set_my_item_primary_image', {
    p_item_id: itemId,
    p_image_id: imageId,
  });
  if (error) throw error;
}

export async function setMyItemMarketplaceVisibility(itemId: string, imageId: string, visible: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('set_my_item_image_marketplace_visibility', {
    p_item_id: itemId,
    p_image_id: imageId,
    p_visible: visible,
  });
  if (error) throw error;
}

async function removeStaleMarketplaceImageProjections(itemId: string, selectedImageIds: Set<string>): Promise<void> {
  const bucket = requireSupabase().storage.from('marketplace-images');
  const { data, error } = await bucket.list(itemId, { limit: 100 });
  if (error) throw new Error('Could not verify existing Marketplace photo projections.');

  const stalePaths = (data ?? [])
    .filter((entry) => entry.name && !selectedImageIds.has(entry.name))
    .map((entry) => `${itemId}/${entry.name}`);

  if (stalePaths.length === 0) return;

  const { error: removeError } = await bucket.remove(stalePaths);
  if (removeError) throw new Error('Could not remove an outdated Marketplace photo projection.');
}

export async function syncMyMarketplaceImageProjections(itemId: string): Promise<number> {
  const client = requireSupabase();
  const selected = (await loadMyItemImages(itemId)).filter((image) => image.marketplaceVisible).slice(0, 6);
  const selectedImageIds = new Set(selected.map((image) => image.id));

  await removeStaleMarketplaceImageProjections(itemId, selectedImageIds);

  for (const image of selected) {
    const response = await fetch(image.signedUrl);
    if (!response.ok) throw new Error('Could not prepare a selected Marketplace photo.');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 10 * 1024 * 1024) throw new Error('A selected Marketplace photo has an invalid size.');
    const contentType = normalizeImageMime(response.headers.get('content-type'));
    const path = `${itemId}/${image.id}`;

    // Marketplace image paths are deterministic so the same selected photo can be
    // republished safely. Upsert avoids the delete-then-upload race that can return
    // "The resource already exists" while preserving the existing owner-only RLS.
    const { error: uploadError } = await client.storage.from('marketplace-images').upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (uploadError) throw uploadError;
  }

  return selected.length;
}

export async function loadMarketplaceImageRefs(): Promise<MarketplaceImageRef[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('load_marketplace_image_refs_v1');
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const signedRefs = await Promise.all(rows.map(async (row): Promise<MarketplaceImageRef | null> => {
    const itemId = String(row.item_id);
    const imageId = String(row.image_id);
    const path = `${itemId}/${imageId}`;
    const { data: signed, error: signedError } = await client.storage.from('marketplace-images').createSignedUrl(path, 1800);
    if (signedError || !signed?.signedUrl) return null;
    return { itemId, imageId, sortOrder: Number(row.sort_order), signedUrl: signed.signedUrl };
  }));
  return signedRefs.filter((ref): ref is MarketplaceImageRef => ref !== null);
}

export async function deleteMyItemImage(itemId: string, imageId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('delete_my_item_image', {
    p_item_id: itemId,
    p_image_id: imageId,
  });
  if (error) throw error;
  if (typeof data === 'string' && data) {
    const { error: storageError } = await client.storage.from('thing-images').remove([data]);
    if (storageError) throw new Error('Photo was removed from the Thing but its file cleanup is delayed.');
  }
}
