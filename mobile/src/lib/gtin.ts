const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

export type ProductBarcodeSymbology = 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'qr' | string;

export function normalizeGtin(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function expandUpcEToUpcA(value: string): string | null {
  const upcE = normalizeGtin(value);
  if (!/^\d{8}$/.test(upcE)) return null;

  const numberSystem = upcE[0];
  if (numberSystem !== '0' && numberSystem !== '1') return null;

  const [d1, d2, d3, d4, d5, d6] = upcE.slice(1, 7).split('');
  const checkDigit = upcE[7];
  let manufacturerAndItem: string;

  if (d6 === '0' || d6 === '1' || d6 === '2') {
    manufacturerAndItem = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  } else if (d6 === '3') {
    manufacturerAndItem = `${d1}${d2}${d3}00000${d4}${d5}`;
  } else if (d6 === '4') {
    manufacturerAndItem = `${d1}${d2}${d3}${d4}00000${d5}`;
  } else {
    manufacturerAndItem = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }

  return `${numberSystem}${manufacturerAndItem}${checkDigit}`;
}

export function normalizeScannedGtin(value: string, symbology?: ProductBarcodeSymbology): string {
  const normalized = normalizeGtin(value);
  if (symbology === 'upc_e') return expandUpcEToUpcA(normalized) ?? normalized;
  return normalized;
}

export function isValidGtin(value: string): boolean {
  const gtin = normalizeGtin(value);
  if (!/^\d+$/.test(gtin) || !GTIN_LENGTHS.has(gtin.length)) return false;

  const expectedCheckDigit = Number(gtin[gtin.length - 1]);
  let weightedSum = 0;
  let weight = 3;

  for (let index = gtin.length - 2; index >= 0; index -= 1) {
    weightedSum += Number(gtin[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }

  const calculatedCheckDigit = (10 - (weightedSum % 10)) % 10;
  return calculatedCheckDigit === expectedCheckDigit;
}
