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

function extensionFromMime(mimeType: string | null | undefined): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
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
