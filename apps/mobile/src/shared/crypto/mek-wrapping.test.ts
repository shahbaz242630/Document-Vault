import { describe, expect, it } from "vitest";

import { deriveKEK, generateSalt } from "./kek-derivation";
import { generateMasterEncryptionKey, toBase64 } from "./vault-crypto";
import { unwrapMEK, wrapMEK } from "./mek-wrapping";

describe("mek-wrapping", () => {
  it("round-trips a MEK through wrap and unwrap", async () => {
    const mek = await generateMasterEncryptionKey();
    const salt = await generateSalt();
    const kek = await deriveKEK("user-password", salt);

    const wrapped = await wrapMEK(mek, kek);
    expect(wrapped.ciphertext).toBeInstanceOf(Uint8Array);
    expect(wrapped.nonce).toBeInstanceOf(Uint8Array);
    expect(wrapped.ciphertext.length).toBeGreaterThan(0);
    expect(wrapped.nonce.length).toBe(24);

    const unwrapped = await unwrapMEK(wrapped, kek);
    expect(unwrapped).toEqual(mek);
  });

  it("unwrap fails with wrong KEK", async () => {
    const mek = await generateMasterEncryptionKey();
    const saltA = await generateSalt();
    const saltB = await generateSalt();
    const kekA = await deriveKEK("password-a", saltA);
    const kekB = await deriveKEK("password-b", saltB);

    const wrapped = await wrapMEK(mek, kekA);

    await expect(unwrapMEK(wrapped, kekB)).rejects.toThrow(
      "Vault payload could not be decrypted.",
    );
  });

  it("unwrap fails when associated data is tampered", async () => {
    const mek = await generateMasterEncryptionKey();
    const salt = await generateSalt();
    const kek = await deriveKEK("user-password", salt);

    const wrapped = await wrapMEK(mek, kek);

    // Create a wrapped object with same ciphertext/nonce but pretend
    // it came from a different associated-data context.
    const { encryptVaultPayload, decryptVaultPayload } = await import(
      "./vault-crypto"
    );
    const tamperedCiphertext = await encryptVaultPayload({
      associatedData: "vault:mek-wrap-tampered",
      key: kek,
      plaintext: await toBase64(mek),
    });

    await expect(
      unwrapMEK(
        { ciphertext: tamperedCiphertext.ciphertext, nonce: tamperedCiphertext.nonce },
        kek,
      ),
    ).rejects.toThrow("Vault payload could not be decrypted.");
  });

  it("produces different ciphertexts for the same MEK and KEK", async () => {
    const mek = await generateMasterEncryptionKey();
    const salt = await generateSalt();
    const kek = await deriveKEK("user-password", salt);

    const a = await wrapMEK(mek, kek);
    const b = await wrapMEK(mek, kek);

    expect(Buffer.from(a.ciphertext).toString("hex")).not.toBe(
      Buffer.from(b.ciphertext).toString("hex"),
    );
    expect(Buffer.from(a.nonce).toString("hex")).not.toBe(
      Buffer.from(b.nonce).toString("hex"),
    );
  });
});
