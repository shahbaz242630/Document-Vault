import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import * as sodium from "react-native-libsodium/src/lib.native";

import {
  createOfflineCodeV2ClientProofProducer,
  type OfflineCodeV2ProofCrypto,
  type OfflineCodeV2WrapCrypto,
} from "./offline-code-v2-proof-core";

const crypto: OfflineCodeV2ProofCrypto & OfflineCodeV2WrapCrypto = {
  ready: async () => { await sodium.ready; },
  argon2id: (input, salt, opslimit, memlimitBytes, outputBytes) => sodium.crypto_pwhash(
    outputBytes, input, salt, opslimit, memlimitBytes, sodium.crypto_pwhash_ALG_ARGON2ID13,
  ),
  sha256: async (input) => new Uint8Array(await digest(
    CryptoDigestAlgorithm.SHA256, Uint8Array.from(input),
  )),
  hkdfSha256: (inputKey, salt, info, outputBytes) => {
    const prk = sodium._unstable_crypto_kdf_hkdf_sha256_extract(inputKey, salt);
    const output = sodium._unstable_crypto_kdf_hkdf_sha256_expand(
      prk, new TextDecoder().decode(info), outputBytes,
    );
    prk.fill(0); return output;
  },
  seedKeyPair: (seed) => sodium.crypto_sign_seed_keypair(seed),
  sign: (message, privateKey) => sodium.crypto_sign_detached(message, privateKey),
  wipe: (value) => value.fill(0),
  randomBytes: (length) => sodium.randombytes_buf(length),
  // The native binding takes associated data only as a string; the canonical JSON here is always ASCII.
  xchacha20poly1305Encrypt: (message, associatedData, nonce, key) =>
    sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(message, asciiText(associatedData), null, nonce, key),
  xchacha20poly1305Decrypt: (ciphertext, associatedData, nonce, key) =>
    sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, asciiText(associatedData), nonce, key),
};

/** The platform crypto for the owner's emergency sheet: the proof primitives plus randomness and the wrap. */
export const offlineCodeV2PlatformSheetCrypto: OfflineCodeV2ProofCrypto & OfflineCodeV2WrapCrypto = crypto;

function asciiText(value: Uint8Array): string {
  if (value.some((byte) => byte > 0x7f)) throw new Error("Associated data must be ASCII.");
  return String.fromCharCode(...value);
}

export function createOfflineCodeV2PlatformProofProducer(approved?: boolean) {
  return createOfflineCodeV2ClientProofProducer({ approved, crypto });
}
