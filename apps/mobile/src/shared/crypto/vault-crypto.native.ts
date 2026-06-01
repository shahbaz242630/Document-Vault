import * as sodium from "react-native-libsodium/src/lib.native";

import { assertVaultCryptoRuntimeSupported } from "./vault-crypto-runtime";

export const vaultCryptoConstants = {
  keyBytes: 32,
  nonceBytes: 24,
} as const;

type EncryptVaultPayloadInput = {
  associatedData: string;
  key: Uint8Array;
  plaintext: string;
};

type DecryptVaultPayloadInput = {
  associatedData: string;
  ciphertext: Uint8Array;
  key: Uint8Array;
  nonce: Uint8Array;
};

export async function generateMasterEncryptionKey(): Promise<Uint8Array> {
  assertVaultCryptoRuntimeSupported({ backend: "native" });
  await sodium.ready;

  return sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
}

export async function encryptVaultPayload({
  associatedData,
  key,
  plaintext,
}: EncryptVaultPayloadInput): Promise<{
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}> {
  assertVaultCryptoRuntimeSupported({ backend: "native" });
  await sodium.ready;
  validateKey(key);

  const nonce = sodium.randombytes_buf(vaultCryptoConstants.nonceBytes);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    associatedData,
    null,
    nonce,
    key,
  );

  return {
    ciphertext,
    nonce,
  };
}

export async function decryptVaultPayload({
  associatedData,
  ciphertext,
  key,
  nonce,
}: DecryptVaultPayloadInput): Promise<string> {
  assertVaultCryptoRuntimeSupported({ backend: "native" });
  await sodium.ready;
  validateKey(key);
  validateNonce(nonce);

  try {
    const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      associatedData,
      nonce,
      key,
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("Vault payload could not be decrypted.");
  }
}

function validateKey(key: Uint8Array): void {
  if (key.length !== vaultCryptoConstants.keyBytes) {
    throw new Error("Vault encryption key has an invalid length.");
  }
}

export async function toBase64(data: Uint8Array): Promise<string> {
  assertVaultCryptoRuntimeSupported({ backend: "native" });
  await sodium.ready;
  return sodium.to_base64(data);
}

export async function fromBase64(base64: string): Promise<Uint8Array> {
  assertVaultCryptoRuntimeSupported({ backend: "native" });
  await sodium.ready;
  return sodium.from_base64(base64);
}

function validateNonce(nonce: Uint8Array): void {
  if (nonce.length !== vaultCryptoConstants.nonceBytes) {
    throw new Error("Vault encryption nonce has an invalid length.");
  }
}
