declare module "libsodium-wrappers-sumo" {
  const sodium: {
    ready: Promise<void>;
    crypto_pwhash_ALG_ARGON2ID13: number;
    crypto_pwhash: (
      outputLength: number,
      password: string,
      salt: Uint8Array,
      operations: number,
      memory: number,
      algorithm: number,
    ) => Uint8Array;
    crypto_aead_xchacha20poly1305_ietf_decrypt: (
      secretNonce: null,
      ciphertext: Uint8Array,
      associatedData: string,
      publicNonce: Uint8Array,
      key: Uint8Array,
      outputFormat?: "text",
    ) => Uint8Array | string;
    crypto_aead_xchacha20poly1305_ietf_encrypt: (
      message: string,
      associatedData: string,
      secretNonce: null,
      publicNonce: Uint8Array,
      key: Uint8Array,
    ) => Uint8Array;
    from_base64: (value: string) => Uint8Array;
    randombytes_buf: (length: number) => Uint8Array;
    to_base64: (value: Uint8Array) => string;
  };
  export default sodium;
}
