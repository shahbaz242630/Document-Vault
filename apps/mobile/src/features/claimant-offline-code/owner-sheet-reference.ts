/**
 * Slice 6J: a short reference, printed on the sheet and shown in "My emergency sheets", so the owner can tell
 * sheets apart. It is the first six characters of the sheet's record ID, which is not secret: the server uses it
 * to identify the sheet.
 */
export function ownerSheetReference(locatorRecordId: string): string {
  return locatorRecordId.replaceAll("-", "").slice(0, 6).toUpperCase();
}
