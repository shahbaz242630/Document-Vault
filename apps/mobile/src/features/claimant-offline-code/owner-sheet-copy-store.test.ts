import sodium from "libsodium-wrappers-sumo";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { openOwnerSheetCopy, sealOwnerSheetCopy } from "@/features/vault/owner-sheet-copy-crypto";

import { createOwnerSheetCopyStore, type OwnerSheetCopySealer } from "./owner-sheet-copy-store";

vi.mock("expo-file-system", () => ({ Directory: class {}, File: class {}, Paths: {} }));

const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-0000000000ff";
const record = "20000000-0000-4000-8000-000000000002";
const copy = Object.freeze({ locatorRecordId: record, sheetPayload: "SKQ2.synthetic-payload-for-the-copy-test",
  printedLocator: "SK2-L-ABCD-EFGH", printedSecret: "SK2-S-WXYZ-1234-SECRET", expiresAt: "2027-09-25T09:00:00.000Z" });

let ownerKey: Uint8Array; let otherKey: Uint8Array;
beforeAll(async () => { await sodium.ready; ownerKey = sodium.randombytes_buf(32); otherKey = sodium.randombytes_buf(32); });

/** The vault session's sealer for one vault key; `locked` mimics a locked vault, which has no session. */
function vaultSealer(key: () => Uint8Array, locked = () => false): OwnerSheetCopySealer {
  const session = () => { if (locked()) throw new Error("Vault session is not ready yet."); return key(); };
  return { seal: async (input) => sealOwnerSheetCopy({ ...input, key: session() }),
    open: async (input) => openOwnerSheetCopy({ ...input, key: session() }) };
}

function deviceFiles(disk = new Map<string, string>()) {
  return { disk, files: { read: vi.fn(async (name: string) => disk.get(name) ?? null),
    write: vi.fn(async (name: string, contents: string) => { disk.set(name, contents); }),
    remove: vi.fn(async (name: string) => { disk.delete(name); }) } };
}

describe("owner sheet copy store", () => {
  it("writes only ciphertext and reads back the same sheet after an app restart", async () => {
    const { disk, files } = deviceFiles();
    await createOwnerSheetCopyStore({ files, sealer: vaultSealer(() => ownerKey) }).save(owner, copy);
    const [name, stored] = [...disk.entries()][0]!;
    expect(name).toBe(`${owner}.${record}.sheetcopy`);
    expect(stored).not.toMatch(/SKQ2|SK2-S|SK2-L|WXYZ|synthetic/u);
    expect(Object.keys(JSON.parse(stored)).sort()).toEqual(["ciphertext", "locatorRecordId", "nonce", "ownerId", "version"]);
    // A new store over the same files is what the app has after a restart.
    const restarted = createOwnerSheetCopyStore({ files: deviceFiles(disk).files, sealer: vaultSealer(() => ownerKey) });
    await expect(restarted.load(owner, record)).resolves.toEqual({ status: "available", copy });
  });

  it("keeps owners apart: another vault key or another owner's address opens nothing", async () => {
    const { disk, files } = deviceFiles();
    await createOwnerSheetCopyStore({ files, sealer: vaultSealer(() => ownerKey) }).save(owner, copy);
    const otherVault = createOwnerSheetCopyStore({ files, sealer: vaultSealer(() => otherKey) });
    await expect(otherVault.load(owner, record)).resolves.toEqual({ status: "unreadable" });
    await expect(otherVault.load(other, record)).resolves.toEqual({ status: "missing" });
    // A copy moved under another owner's name is refused by its binding, even with the right key.
    disk.set(`${other}.${record}.sheetcopy`, disk.get(`${owner}.${record}.sheetcopy`)!);
    const ownerVault = createOwnerSheetCopyStore({ files, sealer: vaultSealer(() => ownerKey) });
    await expect(ownerVault.load(other, record)).resolves.toEqual({ status: "unreadable" });
  });

  it("opens nothing while the vault is locked", async () => {
    let locked = false;
    const { files } = deviceFiles();
    const store = createOwnerSheetCopyStore({ files, sealer: vaultSealer(() => ownerKey, () => locked) });
    await store.save(owner, copy);
    locked = true;
    await expect(store.load(owner, record)).resolves.toEqual({ status: "unreadable" });
    await expect(store.save(owner, copy)).rejects.toThrow();
  });

  it("reports a changed file as unreadable, a missing one as missing, and removes copies", async () => {
    const { disk, files } = deviceFiles();
    const store = createOwnerSheetCopyStore({ files, sealer: vaultSealer(() => ownerKey) });
    await store.save(owner, copy);
    const name = `${owner}.${record}.sheetcopy`;
    const stored = JSON.parse(disk.get(name)!) as Record<string, unknown>;
    disk.set(name, JSON.stringify({ ...stored, ciphertext: `A${String(stored.ciphertext).slice(1)}` }));
    await expect(store.load(owner, record)).resolves.toEqual({ status: "unreadable" });
    disk.set(name, "not json");
    await expect(store.load(owner, record)).resolves.toEqual({ status: "unreadable" });
    await store.remove(owner, record);
    await expect(store.load(owner, record)).resolves.toEqual({ status: "missing" });
  });

  it("refuses addresses that are not UUIDs, so no other file can be reached", async () => {
    const store = createOwnerSheetCopyStore({ ...deviceFiles(), sealer: vaultSealer(() => ownerKey) });
    await expect(store.save("../owner", copy)).rejects.toThrow("Invalid sheet copy address.");
    await expect(store.load(owner, "../../vault")).rejects.toThrow("Invalid sheet copy address.");
  });
});
