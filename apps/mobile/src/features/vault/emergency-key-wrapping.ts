import { deriveKEK, generateSalt } from "@/shared/crypto/kek-derivation";
import {
  decryptVaultPayload,
  encryptVaultPayload,
  fromBase64,
  toBase64,
  vaultCryptoConstants,
} from "@/shared/crypto/vault-crypto";

import { normalizeEmergencyAccessCode } from "./emergency-access-code";

const sealedCodeAssociatedData = "vault:emergency-access:sealed-code-mek";
const kinGrantAssociatedData = "vault:emergency-access:kin-grant-mek";

export type EmergencyAccessGrantType =
  | "pre_authorized_kin"
  | "sealed_emergency_code";

export type EmergencyAccessKdfMetadata = {
  algorithm: "argon2id";
  params: {
    keyLength: 32;
    memlimit: 268435456;
    opslimit: 3;
  };
  salt: Uint8Array;
};

export type EmergencyWrappedMEKPackage = {
  ciphertext: Uint8Array;
  grantType: EmergencyAccessGrantType;
  kdf: EmergencyAccessKdfMetadata | null;
  nonce: Uint8Array;
  wrappingAlgorithm: "xchacha20poly1305_ietf";
};

export async function wrapMEKWithEmergencyCode({
  emergencyCode,
  mek,
}: {
  emergencyCode: string;
  mek: Uint8Array;
}): Promise<{ sealedPackage: EmergencyWrappedMEKPackage }> {
  validateMEK(mek);
  const salt = await generateSalt();
  const wrappingKey = await deriveEmergencyCodeWrappingKey(emergencyCode, salt);
  const encrypted = await encryptVaultPayload({
    associatedData: sealedCodeAssociatedData,
    key: wrappingKey,
    plaintext: await toBase64(mek),
  });

  return {
    sealedPackage: {
      ciphertext: encrypted.ciphertext,
      grantType: "sealed_emergency_code",
      kdf: {
        algorithm: "argon2id",
        params: {
          keyLength: 32,
          memlimit: 268435456,
          opslimit: 3,
        },
        salt,
      },
      nonce: encrypted.nonce,
      wrappingAlgorithm: "xchacha20poly1305_ietf",
    },
  };
}

export async function unwrapSealedEmergencyMEK({
  emergencyCode,
  sealedPackage,
}: {
  emergencyCode: string;
  sealedPackage: EmergencyWrappedMEKPackage;
}): Promise<Uint8Array> {
  if (sealedPackage.grantType !== "sealed_emergency_code" || !sealedPackage.kdf) {
    throw new Error("Emergency access package is invalid.");
  }

  const wrappingKey = await deriveEmergencyCodeWrappingKey(
    emergencyCode,
    sealedPackage.kdf.salt,
  );

  return decryptWrappedMEK({
    associatedData: sealedCodeAssociatedData,
    nonce: sealedPackage.nonce,
    ciphertext: sealedPackage.ciphertext,
    wrappingKey,
  });
}

export async function wrapMEKForKinGrant({
  kinWrappingKey,
  mek,
}: {
  kinWrappingKey: Uint8Array;
  mek: Uint8Array;
}): Promise<EmergencyWrappedMEKPackage> {
  validateMEK(mek);
  validateWrappingKey(kinWrappingKey);
  const encrypted = await encryptVaultPayload({
    associatedData: kinGrantAssociatedData,
    key: kinWrappingKey,
    plaintext: await toBase64(mek),
  });

  return {
    ciphertext: encrypted.ciphertext,
    grantType: "pre_authorized_kin",
    kdf: null,
    nonce: encrypted.nonce,
    wrappingAlgorithm: "xchacha20poly1305_ietf",
  };
}

export async function unwrapKinGrantMEK({
  grant,
  kinWrappingKey,
}: {
  grant: EmergencyWrappedMEKPackage;
  kinWrappingKey: Uint8Array;
}): Promise<Uint8Array> {
  if (grant.grantType !== "pre_authorized_kin" || grant.kdf !== null) {
    throw new Error("Emergency access package is invalid.");
  }

  validateWrappingKey(kinWrappingKey);

  return decryptWrappedMEK({
    associatedData: kinGrantAssociatedData,
    nonce: grant.nonce,
    ciphertext: grant.ciphertext,
    wrappingKey: kinWrappingKey,
  });
}

async function deriveEmergencyCodeWrappingKey(
  emergencyCode: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  return deriveKEK(normalizeEmergencyAccessCode(emergencyCode), salt);
}

async function decryptWrappedMEK({
  associatedData,
  ciphertext,
  nonce,
  wrappingKey,
}: {
  associatedData: string;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  wrappingKey: Uint8Array;
}): Promise<Uint8Array> {
  const base64 = await decryptVaultPayload({
    associatedData,
    ciphertext,
    key: wrappingKey,
    nonce,
  });

  return fromBase64(base64);
}

function validateMEK(mek: Uint8Array): void {
  if (mek.length !== vaultCryptoConstants.keyBytes) {
    throw new Error("MEK has an invalid length.");
  }
}

function validateWrappingKey(key: Uint8Array): void {
  if (key.length !== vaultCryptoConstants.keyBytes) {
    throw new Error("Emergency wrapping key has an invalid length.");
  }
}
