export type BarcodeKind = 'gtin' | 'qr' | 'unknown';

export type ProductSuggestion = {
  code: string;
  kind: BarcodeKind;
  title: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  imageUrl: string | null;
  source: 'upcitemdb-trial' | 'local-qr';
  confidence: 'high' | 'medium' | 'low';
  privateSerial: string | null;
};

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

export function normalizeBarcode(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function isGtinLike(value: string): boolean {
  const normalized = normalizeBarcode(value);
  return /^\d+$/.test(normalized) && GTIN_LENGTHS.has(normalized.length);
}

function readQueryValue(url: URL, names: string[]): string | null {
  for (const name of names) {
    const value = url.searchParams.get(name);
    if (value?.trim()) return value.trim();
  }
  return null;
}

export function parseQrProductData(raw: string): ProductSuggestion | null {
  const value = raw.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const gtin = readQueryValue(url, ['gtin', 'ean', 'upc']);
    const model = readQueryValue(url, ['model', 'modelno', 'model_number', 'sku', 'mpn']);
    const serial = readQueryValue(url, ['serial', 'serialno', 'serial_number', 'sn']);
    const brand = readQueryValue(url, ['brand', 'manufacturer', 'maker']);
    const title = [brand, model].filter(Boolean).join(' ').trim();

    if (gtin && isGtinLike(gtin)) {
      return {
        code: normalizeBarcode(gtin),
        kind: 'gtin',
        title: title || `Product ${normalizeBarcode(gtin)}`,
        brand,
        model,
        category: null,
        imageUrl: null,
        source: 'local-qr',
        confidence: model ? 'medium' : 'low',
        privateSerial: serial,
      };
    }

    if (model || brand || serial) {
      return {
        code: value,
        kind: 'qr',
        title: title || 'Scanned device',
        brand,
        model,
        category: 'Device',
        imageUrl: null,
        source: 'local-qr',
        confidence: model ? 'medium' : 'low',
        privateSerial: serial,
      };
    }
  } catch {
    // Non-URL QR payloads are deliberately kept local and are not sent to a lookup provider.
  }

  return null;
}

export async function resolveBarcodeProduct(rawCode: string): Promise<ProductSuggestion | null> {
  const code = normalizeBarcode(rawCode);
  if (!isGtinLike(code)) return parseQrProductData(rawCode);

  const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Product lookup is temporarily unavailable. You can still enter the item manually.');
  }

  const payload = await response.json() as {
    total?: number;
    items?: Array<{
      title?: string;
      brand?: string;
      model?: string;
      category?: string;
      images?: string[];
    }>;
  };
  const item = payload.items?.[0];
  if (!item?.title) return null;

  return {
    code,
    kind: 'gtin',
    title: item.title.trim(),
    brand: item.brand?.trim() || null,
    model: item.model?.trim() || null,
    category: item.category?.trim() || null,
    imageUrl: item.images?.find(Boolean) ?? null,
    source: 'upcitemdb-trial',
    confidence: item.model ? 'high' : 'medium',
    privateSerial: null,
  };
}
