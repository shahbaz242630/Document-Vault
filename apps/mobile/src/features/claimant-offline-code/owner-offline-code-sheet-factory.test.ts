import { randomUUID } from "node:crypto";

import { parseOfflineCodeSheetV2 } from "@vault/shared-types";
import sodium from "libsodium-wrappers-sumo";
import { describe, expect, it, vi } from "vitest";

import { checkOfflineCodeV2ReleaseWrap } from "./offline-code-v2-proof-core";
import { offlineCodeV2PlatformSheetCrypto } from "./offline-code-v2-proof-producer";
import {
  createOwnerOfflineCodeSheet,
  OWNER_OFFLINE_CODE_SHEET_APPROVED,
} from "./owner-offline-code-sheet-factory";

const ownerId = "10000000-0000-4000-8000-000000000001";
const now = () => new Date("2026-09-25T09:00:00.400Z");
const unavailable = { name: "OwnerOfflineCodeSheetError", message: "The emergency sheet could not be created." };

async function mek() { await sodium.ready; return sodium.randombytes_buf(32); }

describe("owner offline-code sheet factory", () => {
  it("is literal-false and refuses to generate by default", async () => {
    expect(OWNER_OFFLINE_CODE_SHEET_APPROVED).toBe(false);
    const ids = vi.fn(randomUUID);
    await expect(createOwnerOfflineCodeSheet({ ownerId, randomUUID: ids, mek: await mek() }))
      .rejects.toMatchObject(unavailable);
    expect(ids).not.toHaveBeenCalled();
  });

  it("returns a self-checked sheet whose wrap re-opens from the printed material alone", async () => {
    const key = await mek(); const keyCopy = Uint8Array.from(key);
    const sheet = await createOwnerOfflineCodeSheet({ approved: true, ownerId, randomUUID, now, mek: key });
    expect(key).toEqual(keyCopy);
    const parsed = parseOfflineCodeSheetV2(sheet.sheetPayload);
    expect(parsed.recordBinding.owner_id).toBe(ownerId);
    expect(sheet.printedLocator).toBe(parsed.publicLocator.locator);
    expect(sheet.printedSecret).toBe(parsed.clientSecret.secret);
    expect(sheet.registration.issuedAt).toBe("2026-09-25T09:00:00.000Z");
    expect(sheet.expiresAt).toBe("2027-09-25T09:00:00.000Z");
    expect(sheet.registration).not.toHaveProperty("ownerUserId");
    expect(JSON.stringify(sheet)).not.toContain(Buffer.from(key).toString("base64url"));
    const check = (expectedMek: Uint8Array) => checkOfflineCodeV2ReleaseWrap({ approved: true,
      crypto: offlineCodeV2PlatformSheetCrypto, value: { ...parsed, wrapNonce: sheet.registration.wrapNonce,
        wrapCiphertext: sheet.registration.wrapCiphertext, createdAt: sheet.registration.issuedAt,
        wrapAssociatedDataDigest: sheet.registration.wrapAssociatedDataDigest, expectedMek } });
    expect(await check(key)).toBe(true);
    expect(await check(await mek())).toBe(false);
  }, 30_000);

  it("refuses a sheet whose wrap does not re-open to the vault key", async () => {
    const corrupting = { ...offlineCodeV2PlatformSheetCrypto,
      xchacha20poly1305Encrypt: (...args: Parameters<typeof offlineCodeV2PlatformSheetCrypto.xchacha20poly1305Encrypt>) => {
        const output = offlineCodeV2PlatformSheetCrypto.xchacha20poly1305Encrypt(...args);
        output[0] = (output[0] ?? 0) ^ 1; return output;
      } };
    await expect(createOwnerOfflineCodeSheet({ approved: true, crypto: corrupting, ownerId, randomUUID, now,
      mek: await mek() })).rejects.toMatchObject(unavailable);
  }, 30_000);

  it("refuses a sheet whose proof key was not derived from its own secret", async () => {
    let calls = 0;
    const swapped = { ...offlineCodeV2PlatformSheetCrypto,
      seedKeyPair: (seed: Uint8Array) => offlineCodeV2PlatformSheetCrypto.seedKeyPair(
        (calls += 1) === 1 ? Uint8Array.from(seed, (byte) => byte ^ 0xff) : seed) };
    await expect(createOwnerOfflineCodeSheet({ approved: true, crypto: swapped, ownerId, randomUUID, now,
      mek: await mek() })).rejects.toMatchObject(unavailable);
  }, 30_000);

  it("fails generically on a bad vault key or owner ID", async () => {
    await expect(createOwnerOfflineCodeSheet({ approved: true, ownerId, randomUUID, now,
      mek: new Uint8Array(16) })).rejects.toMatchObject(unavailable);
    await expect(createOwnerOfflineCodeSheet({ approved: true, ownerId: "not-a-uuid", randomUUID, now,
      mek: await mek() })).rejects.toMatchObject(unavailable);
  }, 30_000);
});
