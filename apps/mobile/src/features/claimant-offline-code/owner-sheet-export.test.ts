import { describe, expect, it, vi } from "vitest";

import { createOwnerSheetExporter, ownerSheetFileName, type OwnerSheetExportDeps } from "./owner-sheet-export";

vi.mock("expo-file-system", () => ({ Directory: class {}, File: class {}, Paths: {} }));
vi.mock("expo-print", () => ({ printAsync: vi.fn(), printToFileAsync: vi.fn() }));
vi.mock("expo-sharing", () => ({ shareAsync: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

const record = "3f9a1c2b-0000-4000-8000-000000000001";
const pdf = new Uint8Array([37, 80, 68, 70]);

function deps(changes: Partial<OwnerSheetExportDeps> = {}) {
  const existing = new Set<string>();
  const written: { name: string; bytes: Uint8Array }[] = [];
  const value = {
    canPickFolder: true,
    renderPdf: vi.fn(async () => { existing.add("cache://print/abc.pdf"); return "cache://print/abc.pdf"; }),
    readFile: vi.fn(async () => pdf),
    pickFolder: vi.fn(async () => ({ name: "Download", writeFile: vi.fn(async (name: string, bytes: Uint8Array) => {
      written.push({ name, bytes }); return name; }) })),
    copyForSharing: vi.fn(async (_uri: string, name: string) => { existing.add(`cache://${name}`); return `cache://${name}`; }),
    share: vi.fn(async () => undefined),
    deleteFile: vi.fn((uri: string) => { existing.delete(uri); }),
    print: vi.fn(async () => undefined),
  };
  return { value: { ...value, ...changes } as typeof value, existing, written };
}

describe("owner sheet PDF export", () => {
  it("names the file after the sheet reference", () => {
    expect(ownerSheetFileName(record)).toBe("Sanduqkin-emergency-sheet-3F9A1C.pdf");
  });

  it("saves into the folder the owner picks, confirms the folder and deletes the temporary PDF", async () => {
    const { value, existing, written } = deps();
    await expect(createOwnerSheetExporter(value).save("<html/>", record, "folder")).resolves.toEqual({
      status: "saved", fileName: "Sanduqkin-emergency-sheet-3F9A1C.pdf", folder: "Download" });
    expect(written).toEqual([{ name: "Sanduqkin-emergency-sheet-3F9A1C.pdf", bytes: pdf }]);
    expect(existing.size).toBe(0);
    expect(value.share).not.toHaveBeenCalled();
  });

  it("reports a closed folder picker as cancelled and a failed write as failed, cleaning up both times", async () => {
    const cancelled = deps({ pickFolder: vi.fn(async () => null) });
    await expect(createOwnerSheetExporter(cancelled.value).save("<html/>", record, "folder"))
      .resolves.toEqual({ status: "cancelled" });
    expect(cancelled.existing.size).toBe(0);
    const failing = deps({ pickFolder: vi.fn(async () => ({ name: "Download",
      writeFile: vi.fn(async () => { throw new Error("no space"); }) })) });
    await expect(createOwnerSheetExporter(failing.value).save("<html/>", record, "folder"))
      .resolves.toEqual({ status: "failed" });
    expect(failing.existing.size).toBe(0);
    const unrendered = deps({ renderPdf: vi.fn(async () => { throw new Error("render"); }) });
    await expect(createOwnerSheetExporter(unrendered.value).save("<html/>", record, "folder"))
      .resolves.toEqual({ status: "failed" });
  });

  it("shares a copy with the sheet's file name, never claims a save, and deletes both temporary files", async () => {
    const { value, existing } = deps();
    await expect(createOwnerSheetExporter(value).save("<html/>", record, "share")).resolves.toEqual({
      status: "shared", fileName: "Sanduqkin-emergency-sheet-3F9A1C.pdf" });
    expect(value.share).toHaveBeenCalledWith("cache://Sanduqkin-emergency-sheet-3F9A1C.pdf");
    expect(existing.size).toBe(0);
    const shareFails = deps({ share: vi.fn(async () => { throw new Error("closed"); }) });
    await expect(createOwnerSheetExporter(shareFails.value).save("<html/>", record, "share"))
      .resolves.toEqual({ status: "failed" });
    expect(shareFails.existing.size).toBe(0);
  });

  it("uses the share sheet where folders can't be picked (iOS)", async () => {
    const { value } = deps({ canPickFolder: false });
    await expect(createOwnerSheetExporter(value).save("<html/>", record, "folder")).resolves
      .toMatchObject({ status: "shared" });
    expect(value.pickFolder).not.toHaveBeenCalled();
  });

  it("prints on request and reports a print failure without throwing", async () => {
    const { value } = deps();
    const exporter = createOwnerSheetExporter(value);
    await expect(exporter.print("<html/>")).resolves.toBe(true);
    value.print.mockRejectedValueOnce(new Error("cancelled"));
    await expect(exporter.print("<html/>")).resolves.toBe(false);
  });
});
