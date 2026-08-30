export type BarcodeKind = 'gtin' | 'qr' | 'unknown';

export type ProductSuggestion = {
  code: string;
  kind: BarcodeKind;
  title: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  imageUrl: string | null;
  source: 'upcitemdb-trial' | 'open-facts' | 'local-qr';
  confidence: 'high' | 'medium' | 'low';
  privateSerial: string | null;
};

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);
const OPEN_FACTS_FIELDS = 'code,product_name,product_name_en,generic_name,brands,model,mpn,categories,image_front_url,image_url';

export function normalizeBarcode(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function isGtinLike(value: string): boolean {
  const normalized = normalizeBarcode(value);
  return /^\d+$/.test(normalized) && GTIN_LENGTHS.has(normalized.length);
}

function gtinLookupCandidates(code: string): string[] {
  const candidates = [code];
  if (code.length === 8 || code.length === 12) candidates.push(code.padStart(13, '0'));
  return [...new Set(candidates)];
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

async function resolveWithUpcItemDb(code: string): Promise<ProductSuggestion | null> {
  const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`UPCitemdb ${response.status}`);

  const payload = await response.json() as {
    items?: Array<{ title?: string; brand?: string; model?: string; category?: string; images?: string[] }>;
  };
  const item = payload.items?.[0];
  if (!item?.title?.trim()) return null;

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

async function resolveWithOpenFacts(originalCode: string): Promise<ProductSuggestion | null> {
  for (const candidate of gtinLookupCandidates(originalCode)) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(candidate)}.json?product_type=all&fields=${encodeURIComponent(OPEN_FACTS_FIELDS)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ThingsAlpha/0.1 (Android barcode scan)',
      },
    });
    if (!response.ok) {
      if (response.status === 404) continue;
      throw new Error(`Open Facts ${response.status}`);
    }

    const payload = await response.json() as {
      status?: number;
      product?: {
        product_name?: string;
        product_name_en?: string;
        generic_name?: string;
        brands?: string;
        model?: string;
        mpn?: string;
        categories?: string;
        image_front_url?: string;
        image_url?: string;
      };
    };
    if (payload.status !== 1 || !payload.product) continue;

    const product = payload.product;
    const brand = product.brands?.split(',')[0]?.trim() || null;
    const model = product.model?.trim() || product.mpn?.trim() || null;
    const title = product.product_name?.trim()
      || product.product_name_en?.trim()
      || product.generic_name?.trim()
      || [brand, model].filter(Boolean).join(' ').trim();
    if (!title) continue;

    return {
      code: originalCode,
      kind: 'gtin',
      title,
      brand,
      model,
      category: product.categories?.split(',')[0]?.trim() || null,
      imageUrl: product.image_front_url?.trim() || product.image_url?.trim() || null,
      source: 'open-facts',
      confidence: model ? 'high' : brand ? 'medium' : 'low',
      privateSerial: null,
    };
  }

  return null;
}

export async function resolveBarcodeProduct(rawCode: string): Promise<ProductSuggestion | null> {
  const code = normalizeBarcode(rawCode);
  if (!isGtinLike(code)) return parseQrProductData(rawCode);

  let providerResponded = false;
  try {
    const primary = await resolveWithUpcItemDb(code);
    providerResponded = true;
    if (primary) return primary;
  } catch {
    // Continue to the independent open-data fallback instead of failing the capture flow.
  }

  try {
    const fallback = await resolveWithOpenFacts(code);
    providerResponded = true;
    if (fallback) return fallback;
  } catch {
    // If at least one provider answered normally, a missing product is not a network error.
  }

  if (!providerResponded) {
    throw new Error('Product lookup is temporarily unavailable. You can still enter the item manually.');
  }
  return null;
}
