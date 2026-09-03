export type CapturedCodeDisplay = {
  isQr: boolean;
  visibleCode: string | null;
};

export function capturedCodeDisplay(normalizedProductCode: string, symbology?: string): CapturedCodeDisplay {
  const isQr = symbology === 'qr';
  return {
    isQr,
    visibleCode: isQr ? null : normalizedProductCode,
  };
}
