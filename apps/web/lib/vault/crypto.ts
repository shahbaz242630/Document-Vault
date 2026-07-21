import sodium from "libsodium-wrappers-sumo";

export const vaultCryptoV1 = {
  algorithm: "xchacha20poly1305_ietf",
  assetAssociatedDataPrefix: "vault-asset:",
  kdfAlgorithm: "argon2id",
  keyLength: 32,
  mekAssociatedData: "vault:mek-wrap",
  memlimit: 256 * 1024 * 1024,
  nonceLength: 24,
  opslimit: 3,
  saltLength: 16,
} as const;

export type WrappedKeyMaterialV1 = {
  kdfAlgorithm: "argon2id";
  kdfParams: { keyLength: 32; memlimit: 268435456; opslimit: 3 };
  kekSalt: string;
  wrappedMekCiphertext: string;
  wrappedMekNonce: string;
};

export type EncryptedAssetV1 = {
  assetType: string;
  ciphertext: string;
  nonce: string;
};

export type VaultAssetPlaintext = {
  assetType: string;
  fields: Record<string, string>;
  notes?: string;
  title: string;
};

export async function unlockMekV1(password: string, material: WrappedKeyMaterialV1) {
  await sodium.ready;
  assertKeyMaterial(material);
  if (!password) throw new Error("Password cannot be empty.");

  const salt = decode(material.kekSalt, vaultCryptoV1.saltLength, "KEK salt");
  const nonce = decode(material.wrappedMekNonce, vaultCryptoV1.nonceLength, "wrapped MEK nonce");
  const ciphertext = decode(material.wrappedMekCiphertext, undefined, "wrapped MEK ciphertext");
  const kek = sodium.crypto_pwhash(
    vaultCryptoV1.keyLength,
    password,
    salt,
    vaultCryptoV1.opslimit,
    vaultCryptoV1.memlimit,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );

  try {
    const encodedMek = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      vaultCryptoV1.mekAssociatedData,
      nonce,
      kek,
      "text",
    );
    if (typeof encodedMek !== "string") throw new Error("Wrapped MEK did not decode to text.");
    return decode(encodedMek, vaultCryptoV1.keyLength, "MEK");
  } catch {
    throw new Error("Vault could not be unlocked.");
  } finally {
    kek.fill(0);
    salt.fill(0);
    nonce.fill(0);
    ciphertext.fill(0);
  }
}

export async function decryptAssetV1(mek: Uint8Array, asset: EncryptedAssetV1) {
  await sodium.ready;
  assertMek(mek);
  const nonce = decode(asset.nonce, vaultCryptoV1.nonceLength, "asset nonce");
  const ciphertext = decode(asset.ciphertext, undefined, "asset ciphertext");
  try {
    const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      `${vaultCryptoV1.assetAssociatedDataPrefix}${asset.assetType}`,
      nonce,
      mek,
      "text",
    );
    if (typeof plaintext !== "string") throw new Error("Asset did not decode to text.");
    return parseAsset(JSON.parse(plaintext), asset.assetType);
  } catch {
    throw new Error("Vault asset could not be decrypted.");
  } finally {
    nonce.fill(0);
    ciphertext.fill(0);
  }
}

export async function encryptAssetV1(mek: Uint8Array, payload: VaultAssetPlaintext) {
  await sodium.ready;
  assertMek(mek);
  const validated = parseAsset(payload, payload.assetType);
  const nonce = sodium.randombytes_buf(vaultCryptoV1.nonceLength);
  try {
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      JSON.stringify(validated),
      `${vaultCryptoV1.assetAssociatedDataPrefix}${validated.assetType}`,
      null,
      nonce,
      mek,
    );
    return {
      assetType: validated.assetType,
      ciphertext: sodium.to_base64(ciphertext),
      nonce: sodium.to_base64(nonce),
    } satisfies EncryptedAssetV1;
  } finally {
    nonce.fill(0);
  }
}

export function clearSecret(value: Uint8Array | null | undefined) {
  value?.fill(0);
}

function assertKeyMaterial(material: WrappedKeyMaterialV1) {
  if (material.kdfAlgorithm !== vaultCryptoV1.kdfAlgorithm ||
      material.kdfParams.keyLength !== vaultCryptoV1.keyLength ||
      material.kdfParams.memlimit !== vaultCryptoV1.memlimit ||
      material.kdfParams.opslimit !== vaultCryptoV1.opslimit) {
    throw new Error("Unsupported vault key-material version.");
  }
}

function assertMek(mek: Uint8Array) {
  if (mek.length !== vaultCryptoV1.keyLength) throw new Error("MEK has an invalid length.");
}

function decode(value: string, length: number | undefined, label: string) {
  let decoded: Uint8Array;
  try {
    decoded = sodium.from_base64(value);
  } catch {
    throw new Error(`${label} is not valid base64.`);
  }
  if (length !== undefined && decoded.length !== length) {
    decoded.fill(0);
    throw new Error(`${label} has an invalid length.`);
  }
  return decoded;
}

function parseAsset(value: unknown, expectedAssetType: string): VaultAssetPlaintext {
  if (!value || typeof value !== "object") throw new Error("Asset payload is invalid.");
  const candidate = value as Partial<VaultAssetPlaintext>;
  if (candidate.assetType !== expectedAssetType || typeof candidate.title !== "string" || !candidate.title ||
      !candidate.fields || typeof candidate.fields !== "object" || Array.isArray(candidate.fields) ||
      Object.values(candidate.fields).some((field) => typeof field !== "string") ||
      (candidate.notes !== undefined && typeof candidate.notes !== "string")) {
    throw new Error("Asset payload is invalid.");
  }
  return candidate as VaultAssetPlaintext;
}
