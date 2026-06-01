import sodium from "libsodium-wrappers-sumo";

import { assertVaultCryptoRuntimeSupported } from "./vault-crypto-runtime";

export async function generateRandomBytes(length: number): Promise<Uint8Array> {
  assertVaultCryptoRuntimeSupported();
  await sodium.ready;
  return sodium.randombytes_buf(length);
}
