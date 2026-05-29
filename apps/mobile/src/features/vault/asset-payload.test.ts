import { describe, expect, it } from "vitest";

import { generateMasterEncryptionKey } from "@/shared/crypto/vault-crypto";

import {
  decryptAssetPayload,
  encryptAssetPayload,
  type AssetPlaintextPayload,
} from "./asset-payload";

describe("asset payload encryption", () => {
  it("encrypts and decrypts a validated asset payload", async () => {
    const key = await generateMasterEncryptionKey();
    const payload: AssetPlaintextPayload = {
      assetType: "bank_account",
      fields: {
        country: "UAE",
        institutionName: "Example Bank",
        lastFourDigits: "1234",
      },
      notes: "Call the relationship manager first.",
      title: "Primary bank reference",
    };

    const encrypted = await encryptAssetPayload({ key, payload });

    expect(encrypted.assetType).toBe("bank_account");
    expect(new TextDecoder().decode(encrypted.ciphertext)).not.toContain(
      "Primary bank reference",
    );

    await expect(decryptAssetPayload({ encrypted, key })).resolves.toEqual(payload);
  });

  it("refuses invalid asset types before encryption", async () => {
    const key = await generateMasterEncryptionKey();

    await expect(
      encryptAssetPayload({
        key,
        payload: {
          assetType: "unsupported",
          fields: {},
          title: "Unsupported asset",
        },
      }),
    ).rejects.toThrow("Asset payload is invalid.");
  });

  it("binds ciphertext to asset type metadata", async () => {
    const key = await generateMasterEncryptionKey();
    const encrypted = await encryptAssetPayload({
      key,
      payload: {
        assetType: "bank_account",
        fields: {
          institutionName: "Example Bank",
          lastFourDigits: "1234",
        },
        title: "Primary bank reference",
      },
    });

    await expect(
      decryptAssetPayload({
        encrypted: {
          ...encrypted,
          assetType: "investment",
        },
        key,
      }),
    ).rejects.toThrow("Vault payload could not be decrypted.");
  });
});
