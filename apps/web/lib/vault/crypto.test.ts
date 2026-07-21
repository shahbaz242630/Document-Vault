import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { clearSecret, decryptAssetV1, encryptAssetV1, unlockMekV1 } from "./crypto";

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "../../test-fixtures/mobile-web-crypto-v1.json"), "utf8"));

describe("mobile/web crypto compatibility v1", () => {
  it("unlocks and decrypts a deterministic mobile-format fixture", async () => {
    const mek = await unlockMekV1(fixture.password, fixture.keyMaterial);
    try {
      await expect(decryptAssetV1(mek, fixture.asset)).resolves.toEqual(fixture.plaintext);
    } finally {
      clearSecret(mek);
    }
  });

  it("round-trips a web update through the mobile-compatible envelope", async () => {
    const mek = await unlockMekV1(fixture.password, fixture.keyMaterial);
    try {
      const updated = { ...fixture.plaintext, title: "Updated on web" };
      const encrypted = await encryptAssetV1(mek, updated);
      await expect(decryptAssetV1(mek, encrypted)).resolves.toEqual(updated);
      expect(JSON.stringify(encrypted)).not.toContain("Updated on web");
    } finally {
      clearSecret(mek);
    }
  });

  it("rejects the wrong password and associated-data substitution", async () => {
    await expect(unlockMekV1("wrong-password", fixture.keyMaterial)).rejects.toThrow("could not be unlocked");
    const mek = await unlockMekV1(fixture.password, fixture.keyMaterial);
    try {
      await expect(decryptAssetV1(mek, { ...fixture.asset, assetType: "investment" })).rejects.toThrow("could not be decrypted");
    } finally {
      clearSecret(mek);
    }
  }, 15_000);

  it("zeroes secret byte arrays on lock", () => {
    const secret = new Uint8Array([1, 2, 3]);
    clearSecret(secret);
    expect(secret).toEqual(new Uint8Array([0, 0, 0]));
  });
});
