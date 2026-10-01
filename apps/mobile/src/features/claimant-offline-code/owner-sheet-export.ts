import { Directory, File, Paths } from "expo-file-system";
import { printAsync, printToFileAsync } from "expo-print";
import { shareAsync } from "expo-sharing";
import { Platform } from "react-native";

import type { OwnerSheetExportPort, OwnerSheetSaveMode, OwnerSheetSaveResult } from "./owner-sheet-copy";
import { ownerSheetReference } from "./owner-sheet-reference";

export type { OwnerSheetSaveMode, OwnerSheetSaveResult } from "./owner-sheet-copy";

/*
 * PDF-first sheets: saving and printing the owner's sheet. The PDF is rendered to a temporary file in the app
 * cache, handed to the platform, and the temporary files are always deleted afterwards. Android lets the owner pick
 * a folder (Downloads is the usual choice), so a save can be confirmed and its folder named; a share sheet cannot
 * prove a file was saved, so it reports the location as unknown.
 */
type PickedFolder = Readonly<{ name: string | null; writeFile: (name: string, bytes: Uint8Array) => Promise<string> }>;

export type OwnerSheetExportDeps = Readonly<{
  /** Whether the platform can write into a folder the owner picks (Android). */
  canPickFolder: boolean;
  renderPdf: (html: string) => Promise<string>;
  readFile: (uri: string) => Promise<Uint8Array>;
  /** Null when the owner closes the folder picker. */
  pickFolder: () => Promise<PickedFolder | null>;
  /** Copies the PDF to a cache file with the sheet's file name, for sharing; returns its URI. */
  copyForSharing: (uri: string, fileName: string) => Promise<string>;
  share: (uri: string) => Promise<void>;
  deleteFile: (uri: string) => void;
  print: (html: string) => Promise<void>;
}>;

export function ownerSheetFileName(locatorRecordId: string): string {
  return `Sanduqkin-emergency-sheet-${ownerSheetReference(locatorRecordId)}.pdf`;
}

export function createOwnerSheetExporter(deps: OwnerSheetExportDeps): OwnerSheetExportPort {
  const discard = (uri: string | null) => { if (uri) { try { deps.deleteFile(uri); } catch { /* already gone */ } } };
  return Object.freeze({
    canPickFolder: deps.canPickFolder,
    async save(html: string, locatorRecordId: string, mode: OwnerSheetSaveMode): Promise<OwnerSheetSaveResult> {
      const fileName = ownerSheetFileName(locatorRecordId);
      let rendered: string | null = null;
      let shared: string | null = null;
      try {
        rendered = await deps.renderPdf(html);
        if (mode === "folder" && deps.canPickFolder) {
          const folder = await deps.pickFolder();
          if (!folder) return { status: "cancelled" };
          const savedAs = await folder.writeFile(fileName, await deps.readFile(rendered));
          return { status: "saved", fileName: savedAs, folder: folder.name };
        }
        shared = await deps.copyForSharing(rendered, fileName);
        await deps.share(shared);
        return { status: "shared", fileName };
      } catch {
        return { status: "failed" };
      } finally {
        discard(shared);
        discard(rendered);
      }
    },
    async print(html: string): Promise<boolean> {
      try { await deps.print(html); return true; } catch { return false; }
    },
  });
}

export type OwnerSheetExporter = OwnerSheetExportPort;

/** The device implementation: expo-print, expo-file-system and expo-sharing. */
export function deviceOwnerSheetExportDeps(): OwnerSheetExportDeps {
  return Object.freeze({
    canPickFolder: Platform.OS === "android",
    renderPdf: async (html: string) => (await printToFileAsync({ html })).uri,
    readFile: (uri: string) => new File(uri).bytes(),
    async pickFolder() {
      let folder: Directory;
      try { folder = await Directory.pickDirectoryAsync(); } catch { return null; }
      return {
        name: folderName(folder),
        async writeFile(name: string, bytes: Uint8Array) {
          const file = folder.createFile(name, "application/pdf");
          file.write(bytes);
          return file.name || name;
        },
      };
    },
    async copyForSharing(uri: string, fileName: string) {
      const target = new File(Paths.cache, fileName);
      if (target.exists) target.delete();
      new File(uri).copySync(target);
      return target.uri;
    },
    share: (uri: string) => shareAsync(uri, { dialogTitle: "Save your emergency sheet", mimeType: "application/pdf",
      UTI: "com.adobe.pdf" }),
    deleteFile: (uri: string) => { const file = new File(uri); if (file.exists) file.delete(); },
    print: (html: string) => printAsync({ html }),
  });
}

/** A readable name for the picked folder, such as "Download", when the platform gives one. */
function folderName(folder: Directory): string | null {
  try {
    const name = decodeURIComponent(folder.name || "");
    const last = name.split(/[:/]/u).filter(Boolean).pop();
    return last ? last : null;
  } catch { return null; }
}
