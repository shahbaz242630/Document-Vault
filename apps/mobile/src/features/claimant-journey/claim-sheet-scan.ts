import { OFFLINE_CODE_V2_SHEET_MAX_LENGTH, OFFLINE_CODE_V2_SHEET_PREFIX } from "@vault/shared-types";

/** The only fields of a camera barcode result the claim screen reads. */
export type ClaimSheetScanResult = Readonly<{ type: unknown; data: unknown }>;

/*
 * Slice 6I: one scanning session hands at most one emergency-sheet QR to the claim flow. Other barcodes, foreign
 * QR codes and over-long values are dropped silently so scanning can continue. The value is passed straight on
 * and never kept, logged or shown.
 */
export function createClaimSheetScan(submit: (sheetText: string) => void) {
  let done = false;
  return Object.freeze({
    onScan(result: ClaimSheetScanResult): void {
      if (done || result.type !== "qr" || typeof result.data !== "string"
        || result.data.length > OFFLINE_CODE_V2_SHEET_MAX_LENGTH
        || !result.data.startsWith(OFFLINE_CODE_V2_SHEET_PREFIX)) return;
      done = true;
      submit(result.data);
    },
    close(): void { done = true; },
  });
}
