import * as sodium from "react-native-libsodium/src/lib.native";

import { assertVaultCryptoRuntimeSupported } from "./vault-crypto-runtime";

/**
 * BRD 4.2: Argon2id tuned for mobile.
 * Uses libsodium's MODERATE preset for a balance of security and UX:
 * - memory cost: 256 MiB
 * - time cost: 3 iterations
 * - parallelism: 1 (libsodium default)
 */
const OPSLIMIT = 3;
const MEMLIMIT = 256 * 1024 * 1024;
const KEY_LENGTH = 32;

export async function generateSalt(): Promise<Uint8Array> {
  assertVaultCryptoRuntimeSupported({ backend: "native" });
  await sodium.ready;
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
}

export async function deriveKEK(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  assertVaultCryptoRuntimeSupported({ backend: "native" });
  await sodium.ready;

  if (salt.length !== sodium.crypto_pwhash_SALTBYTES) {
    throw new Error(
      `Invalid salt length. Expected ${sodium.crypto_pwhash_SALTBYTES}, got ${salt.length}.`,
    );
  }

  if (password.length === 0) {
    throw new Error("Password cannot be empty.");
  }

  return sodium.crypto_pwhash(
    KEY_LENGTH,
    password,
    salt,
    OPSLIMIT,
    MEMLIMIT,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}
