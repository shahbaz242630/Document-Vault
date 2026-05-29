import { describe, expect, it } from "vitest";

import { generateSalt } from "@/shared/crypto/kek-derivation";
import { wrapMEK } from "@/shared/crypto/mek-wrapping";
import {
  generateMasterEncryptionKey,
  toBase64,
} from "@/shared/crypto/vault-crypto";

import { createVaultStore } from "./vault-store";
import {
  deserializeVaultAssetRow,
  deserializeVaultKeyMaterial,
  serializeVaultAssetRecord,
  serializeVaultKeyMaterial,
  type SupabaseVaultAssetRow,
  type VaultKeyMaterial,
} from "./supabase-vault-codec";

describe("supabase vault codec", () => {
  it("serializes encrypted asset records without plaintext fields or owner ids", async () => {
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore({ now: () => new Date("2026-05-29T10:00:00.000Z") });
    const record = await store.addAsset({
      key,
      payload: {
        assetType: "bank_account",
        fields: {
          institutionName: "Example Bank",
          lastFourDigits: "1234",
        },
        notes: "Private note",
        title: "Primary account",
      },
    });

    const row = await serializeVaultAssetRecord(record);

    expect(row).toEqual({
      asset_type: "bank_account",
      ciphertext: await toBase64(record.encryptedPayload.ciphertext),
      created_at: "2026-05-29T10:00:00.000Z",
      deleted_at: null,
      id: record.id,
      nonce: await toBase64(record.encryptedPayload.nonce),
      updated_at: "2026-05-29T10:00:00.000Z",
    });
    expect(Object.keys(row)).not.toContain("title");
    expect(Object.keys(row)).not.toContain("fields");
    expect(Object.keys(row)).not.toContain("notes");
    expect(Object.keys(row)).not.toContain("user_id");
    expect(JSON.stringify(row)).not.toContain("Primary account");
    expect(JSON.stringify(row)).not.toContain("Example Bank");
    expect(JSON.stringify(row)).not.toContain("Private note");
  });

  it("deserializes Supabase asset rows back to encrypted vault records", async () => {
    const ciphertext = new TextEncoder().encode("ciphertext");
    const nonce = new TextEncoder().encode("nonce-for-tests");
    const row: SupabaseVaultAssetRow = {
      asset_type: "contact",
      ciphertext: await toBase64(ciphertext),
      created_at: "2026-05-29T10:00:00.000Z",
      deleted_at: "2026-05-29T11:00:00.000Z",
      id: "8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f",
      nonce: await toBase64(nonce),
      updated_at: "2026-05-29T11:00:00.000Z",
    };

    const record = await deserializeVaultAssetRow(row);

    expect(record).toEqual({
      assetType: "contact",
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      encryptedPayload: {
        assetType: "contact",
        ciphertext,
        nonce,
      },
      id: row.id,
      updatedAt: row.updated_at,
    });
  });

  it("round-trips wrapped MEK key material through Supabase-safe fields", async () => {
    const mek = await generateMasterEncryptionKey();
    const kek = await generateMasterEncryptionKey();
    const salt = await generateSalt();
    const wrappedMek = await wrapMEK(mek, kek);
    const keyMaterial: VaultKeyMaterial = {
      kdfAlgorithm: "argon2id",
      kdfParams: {
        keyLength: 32,
        memlimit: 268435456,
        opslimit: 3,
      },
      kekSalt: salt,
      recoveryVersion: 1,
      wrappedMek,
    };

    const row = await serializeVaultKeyMaterial(keyMaterial);
    const parsed = await deserializeVaultKeyMaterial(row);

    expect(row).toEqual({
      kdf_algorithm: "argon2id",
      kdf_params: {
        keyLength: 32,
        memlimit: 268435456,
        opslimit: 3,
      },
      kek_salt: await toBase64(salt),
      recovery_version: 1,
      wrapped_mek_ciphertext: await toBase64(wrappedMek.ciphertext),
      wrapped_mek_nonce: await toBase64(wrappedMek.nonce),
    });
    expect(parsed).toEqual(keyMaterial);
  });
});
