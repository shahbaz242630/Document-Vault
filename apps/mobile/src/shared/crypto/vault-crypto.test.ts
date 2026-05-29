import { describe, expect, it } from "vitest";

import {
  decryptVaultPayload,
  encryptVaultPayload,
  fromBase64,
  generateMasterEncryptionKey,
  toBase64,
  vaultCryptoConstants,
} from "./vault-crypto";

describe("vault crypto", () => {
  it("generates a 256-bit master encryption key", async () => {
    const key = await generateMasterEncryptionKey();

    expect(key).toBeInstanceOf(Uint8Array);
    expect(key).toHaveLength(32);
  });

  it("encrypts and decrypts a UTF-8 payload with XChaCha20-Poly1305", async () => {
    const key = await generateMasterEncryptionKey();
    const encrypted = await encryptVaultPayload({
      associatedData: "asset:bank_account",
      key,
      plaintext: "Primary bank reference",
    });

    expect(encrypted.nonce).toHaveLength(vaultCryptoConstants.nonceBytes);
    expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(encrypted.ciphertext)).not.toContain(
      "Primary bank reference",
    );

    const plaintext = await decryptVaultPayload({
      associatedData: "asset:bank_account",
      ciphertext: encrypted.ciphertext,
      key,
      nonce: encrypted.nonce,
    });

    expect(plaintext).toBe("Primary bank reference");
  });

  it("refuses decryption when associated data changes", async () => {
    const key = await generateMasterEncryptionKey();
    const encrypted = await encryptVaultPayload({
      associatedData: "asset:bank_account",
      key,
      plaintext: "Primary bank reference",
    });

    await expect(
      decryptVaultPayload({
        associatedData: "asset:investment",
        ciphertext: encrypted.ciphertext,
        key,
        nonce: encrypted.nonce,
      }),
    ).rejects.toThrow("Vault payload could not be decrypted.");
  });

  it("refuses encryption with an invalid key length", async () => {
    await expect(
      encryptVaultPayload({
        associatedData: "asset:bank_account",
        key: new Uint8Array(16),
        plaintext: "Primary bank reference",
      }),
    ).rejects.toThrow("Vault encryption key has an invalid length.");
  });

  it("refuses decryption with an invalid nonce length", async () => {
    const key = await generateMasterEncryptionKey();

    await expect(
      decryptVaultPayload({
        associatedData: "asset:bank_account",
        ciphertext: new Uint8Array(32),
        key,
        nonce: new Uint8Array(12),
      }),
    ).rejects.toThrow("Vault encryption nonce has an invalid length.");
  });

  it("round-trips data through base64 encoding", async () => {
    const data = new Uint8Array([1, 2, 3, 255, 0, 128]);
    const encoded = await toBase64(data);
    const decoded = await fromBase64(encoded);

    expect(typeof encoded).toBe("string");
    expect(decoded).toEqual(data);
  });
});
