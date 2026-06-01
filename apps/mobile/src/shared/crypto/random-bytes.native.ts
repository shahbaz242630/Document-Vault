import * as sodium from "react-native-libsodium/src/lib.native";

import { assertVaultCryptoRuntimeSupported } from "./vault-crypto-runtime";

export async function generateRandomBytes(length: number): Promise<Uint8Array> {
  assertVaultCryptoRuntimeSupported({ backend: "native" });
  await sodium.ready;
  return sodium.randombytes_buf(length);
}
