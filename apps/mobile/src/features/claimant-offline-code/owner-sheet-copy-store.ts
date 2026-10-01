import { Directory, File, Paths } from "expo-file-system";

import type { OwnerSheetCopy, OwnerSheetCopyLoad, OwnerSheetCopyPort } from "./owner-sheet-copy";

export type { OwnerSheetCopy, OwnerSheetCopyLoad } from "./owner-sheet-copy";

/*
 * PDF-first sheets: the owner's copy of each sheet, kept on this device so the same sheet can be shown and saved
 * again. Only ciphertext sealed by the vault session is written, one file per owner and sheet record, in the
 * app's private files (excluded from backup in the Preview build). Nothing here can open a copy without the
 * unlocked vault, and nothing is logged.
 */
type Address = Readonly<{ ownerId: string; locatorRecordId: string }>;
type Sealed = Readonly<{ nonce: string; ciphertext: string }>;

export type OwnerSheetCopySealer = Readonly<{
  seal: (input: Address & Readonly<{ plaintext: string }>) => Promise<Sealed>;
  open: (input: Address & Sealed) => Promise<string>;
}>;

/** The few file operations the store needs, so tests can run without a device. */
export type OwnerSheetCopyFiles = Readonly<{
  read: (name: string) => Promise<string | null>;
  write: (name: string, contents: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
}>;

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const copyKeys = "expiresAt,locatorRecordId,printedLocator,printedSecret,sheetPayload";
const fileKeys = "ciphertext,locatorRecordId,nonce,ownerId,version";

function fileName(address: Address): string {
  if (!uuidV4.test(address.ownerId) || !uuidV4.test(address.locatorRecordId)) {
    throw new Error("Invalid sheet copy address.");
  }
  return `${address.ownerId}.${address.locatorRecordId}.sheetcopy`;
}

function parseCopy(plaintext: string, locatorRecordId: string): OwnerSheetCopy | null {
  try {
    const value = JSON.parse(plaintext) as Record<string, unknown>;
    if (Object.keys(value).sort().join(",") !== copyKeys || value.locatorRecordId !== locatorRecordId
      || !["sheetPayload", "printedLocator", "printedSecret", "expiresAt"].every((key) =>
        typeof value[key] === "string" && (value[key] as string).length > 0)) return null;
    return Object.freeze(value as OwnerSheetCopy);
  } catch { return null; }
}

export function createOwnerSheetCopyStore(deps: Readonly<{ files: OwnerSheetCopyFiles; sealer: OwnerSheetCopySealer }>):
  OwnerSheetCopyPort {
  return Object.freeze({
    async save(ownerId: string, copy: OwnerSheetCopy): Promise<void> {
      const address = { ownerId, locatorRecordId: copy.locatorRecordId };
      const name = fileName(address);
      const plaintext = JSON.stringify({ locatorRecordId: copy.locatorRecordId, sheetPayload: copy.sheetPayload,
        printedLocator: copy.printedLocator, printedSecret: copy.printedSecret, expiresAt: copy.expiresAt });
      const sealed = await deps.sealer.seal({ ...address, plaintext });
      await deps.files.write(name, JSON.stringify({ version: 1, ownerId, locatorRecordId: copy.locatorRecordId,
        nonce: sealed.nonce, ciphertext: sealed.ciphertext }));
    },
    async load(ownerId: string, locatorRecordId: string): Promise<OwnerSheetCopyLoad> {
      const address = { ownerId, locatorRecordId };
      const stored = await deps.files.read(fileName(address)).catch(() => null);
      if (stored === null) return { status: "missing" };
      try {
        const value = JSON.parse(stored) as Record<string, unknown>;
        if (Object.keys(value).sort().join(",") !== fileKeys || value.version !== 1 || value.ownerId !== ownerId
          || value.locatorRecordId !== locatorRecordId || typeof value.nonce !== "string"
          || typeof value.ciphertext !== "string") return { status: "unreadable" };
        const copy = parseCopy(await deps.sealer.open({ ...address, nonce: value.nonce,
          ciphertext: value.ciphertext }), locatorRecordId);
        return copy ? { status: "available", copy } : { status: "unreadable" };
      } catch { return { status: "unreadable" }; }
    },
    async remove(ownerId: string, locatorRecordId: string): Promise<void> {
      await deps.files.remove(fileName({ ownerId, locatorRecordId })).catch(() => undefined);
    },
  });
}

export type OwnerSheetCopyStore = OwnerSheetCopyPort;

/** The device files: `<app documents>/owner-emergency-sheets/<owner>.<record>.sheetcopy`, ciphertext only. */
export function deviceOwnerSheetCopyFiles(): OwnerSheetCopyFiles {
  const directory = () => {
    const folder = new Directory(Paths.document, "owner-emergency-sheets");
    if (!folder.exists) folder.create({ idempotent: true, intermediates: true });
    return folder;
  };
  return Object.freeze({
    async read(name: string) {
      const file = new File(directory(), name);
      return file.exists ? file.text() : null;
    },
    async write(name: string, contents: string) {
      const file = new File(directory(), name);
      if (!file.exists) file.create();
      file.write(contents);
    },
    async remove(name: string) {
      const file = new File(directory(), name);
      if (file.exists) file.delete();
    },
  });
}
