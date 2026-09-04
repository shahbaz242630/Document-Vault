import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import * as sodium from "react-native-libsodium/src/lib.native";

import {
  createOfflineCodeV2ClientProofProducer,
  type OfflineCodeV2ProofCrypto,
} from "./offline-code-v2-proof-core";

const crypto: OfflineCodeV2ProofCrypto = {
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
};

export function createOfflineCodeV2PlatformProofProducer(approved?: boolean) {
  return createOfflineCodeV2ClientProofProducer({ approved, crypto });
}
