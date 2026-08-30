import sodium from "libsodium-wrappers-sumo";

import {
  createOfflineCodeV2ClientProofProducer,
  type OfflineCodeV2ProofCrypto,
} from "./offline-code-v2-proof-core";

const crypto: OfflineCodeV2ProofCrypto = {
  ready: async () => { await sodium.ready; },
  argon2id: (input, salt, opslimit, memlimitBytes, outputBytes) => sodium.crypto_pwhash(
    outputBytes, input, salt, opslimit, memlimitBytes, sodium.crypto_pwhash_ALG_ARGON2ID13,
  ),
  sha256: async (input) => sodium.crypto_hash_sha256(input),
  hkdfSha256: (inputKey, salt, info, outputBytes) => {
    const prk = sodium.crypto_auth_hmacsha256(inputKey, salt);
    let previous: Uint8Array<ArrayBufferLike> = new Uint8Array();
    let output: Uint8Array<ArrayBufferLike> = new Uint8Array();
    for (let counter = 1; output.length < outputBytes; counter += 1) {
      previous = Uint8Array.from(sodium.crypto_auth_hmacsha256(
        concat(previous, info, Uint8Array.of(counter)), prk,
      ));
      output = concat(output, previous);
    }
    sodium.memzero(prk); sodium.memzero(previous);
    return output.slice(0, outputBytes);
  },
  seedKeyPair: (seed) => sodium.crypto_sign_seed_keypair(seed),
  sign: (message, privateKey) => sodium.crypto_sign_detached(message, privateKey),
  wipe: (value) => sodium.memzero(value),
};

export function createOfflineCodeV2PlatformProofProducer(approved?: boolean) {
  return createOfflineCodeV2ClientProofProducer({ approved, crypto });
}

function concat(...values: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(values.reduce((length, value) => length + value.length, 0));
  let offset = 0; for (const value of values) { output.set(value, offset); offset += value.length; }
  return output;
}
