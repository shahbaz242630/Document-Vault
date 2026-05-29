import {
  decryptVaultPayload,
  encryptVaultPayload,
  fromBase64,
  toBase64,
} from "./vault-crypto";

const ASSOCIATED_DATA = "vault:mek-wrap";

export type WrappedMEK = {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
};

export async function wrapMEK(
  mek: Uint8Array,
  kek: Uint8Array,
): Promise<WrappedMEK> {
  const encrypted = await encryptVaultPayload({
    associatedData: ASSOCIATED_DATA,
    key: kek,
    plaintext: await toBase64(mek),
  });

  return {
    ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce,
  };
}

export async function unwrapMEK(
  wrapped: WrappedMEK,
  kek: Uint8Array,
): Promise<Uint8Array> {
  const base64 = await decryptVaultPayload({
    associatedData: ASSOCIATED_DATA,
    ciphertext: wrapped.ciphertext,
    key: kek,
    nonce: wrapped.nonce,
  });

  return fromBase64(base64);
}
