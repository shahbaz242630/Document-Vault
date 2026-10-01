import type { OwnerOfflineCodeSheet } from "./owner-offline-code-sheet-factory";

/** PDF-first sheets: what the owner's copy of a sheet holds, enough to draw, save or print the same sheet again. */
export type OwnerSheetCopy = Readonly<{
  locatorRecordId: string;
  sheetPayload: string;
  printedLocator: string;
  printedSecret: string;
  expiresAt: string;
}>;

export function toOwnerSheetCopy(sheet: OwnerOfflineCodeSheet): OwnerSheetCopy {
  return Object.freeze({ locatorRecordId: sheet.registration.locatorRecordId, sheetPayload: sheet.sheetPayload,
    printedLocator: sheet.printedLocator, printedSecret: sheet.printedSecret, expiresAt: sheet.expiresAt });
}

/** What "Save PDF" ended with. A share sheet cannot prove a file was saved, so it is "shared", never "saved". */
export type OwnerSheetSaveMode = "folder" | "share";

export type OwnerSheetSaveResult =
  | Readonly<{ status: "saved"; fileName: string; folder: string | null }>
  | Readonly<{ status: "shared"; fileName: string }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "failed" }>;

export type OwnerSheetCopyLoad =
  | Readonly<{ status: "available"; copy: OwnerSheetCopy }>
  | Readonly<{ status: "missing" | "unreadable" }>;

/** The device copy store as the flows see it (owner-sheet-copy-store.ts). */
export type OwnerSheetCopyPort = Readonly<{
  save: (ownerId: string, copy: OwnerSheetCopy) => Promise<void>;
  load: (ownerId: string, locatorRecordId: string) => Promise<OwnerSheetCopyLoad>;
  remove: (ownerId: string, locatorRecordId: string) => Promise<void>;
}>;

/** The PDF exporter as the flows see it (owner-sheet-export.ts). */
export type OwnerSheetExportPort = Readonly<{
  canPickFolder: boolean;
  save: (html: string, locatorRecordId: string, mode: OwnerSheetSaveMode) => Promise<OwnerSheetSaveResult>;
  print: (html: string) => Promise<boolean>;
}>;
