import { describe, expect, it } from "vitest";

import { createEncryptedStoragePreview } from "./encrypted-storage-preview";
import type { VaultEncryptedAssetRecord } from "./vault-store";

describe("createEncryptedStoragePreview", () => {
  it("shows safe encrypted fields without decrypted plaintext", () => {
    const records: VaultEncryptedAssetRecord[] = [
      {
        assetType: "card",
        createdAt: "2026-06-03T10:00:00.000Z",
        deletedAt: null,
        encryptedPayload: {
          assetType: "card",
          ciphertext: new Uint8Array([1, 2, 3, 4, 5, 6]),
          nonce: new Uint8Array([7, 8, 9, 10]),
        },
        id: "record-1",
        updatedAt: "2026-06-03T10:05:00.000Z",
      },
    ];

    const preview = createEncryptedStoragePreview(records);

    expect(preview).toEqual([
      {
        assetType: "card",
        ciphertextPreview: "010203040506",
        noncePreview: "0708090a",
        storedFields: ["asset_type", "ciphertext", "nonce", "created_at", "updated_at"],
        updatedAt: "2026-06-03T10:05:00.000Z",
      },
    ]);
    expect(JSON.stringify(preview)).not.toContain("Travel card");
  });
});
