const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

export function normalizeGtin(value: string): string {
  return value.trim().replace(/\s+/g, '');
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
