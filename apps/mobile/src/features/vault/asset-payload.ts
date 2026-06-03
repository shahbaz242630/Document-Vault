import { z } from "zod";

import { assetTypes } from "@vault/shared-types";

import {
  decryptVaultPayload,
  encryptVaultPayload,
} from "@/shared/crypto/vault-crypto";

const assetTypeSchema = z.enum(assetTypes);

export type AssetType = z.infer<typeof assetTypeSchema>;

const assetPlaintextPayloadSchema = z.object({
  assetType: assetTypeSchema,
  fields: z.record(z.string().min(1), z.string()),
  notes: z.string().optional(),
  title: z.string().min(1),
});

export type AssetPlaintextPayload = {
  assetType: z.infer<typeof assetTypeSchema>;
  fields: Record<string, string>;
  notes?: string;
  title: string;
};

export type EncryptedAssetPayload = {
  assetType: AssetPlaintextPayload["assetType"];
  ciphertext: Uint8Array;
  nonce: Uint8Array;
};

type EncryptAssetPayloadInput = {
  key: Uint8Array;
  payload: unknown;
};

type DecryptAssetPayloadInput = {
  encrypted: EncryptedAssetPayload;
  key: Uint8Array;
};

export async function encryptAssetPayload({
  key,
  payload,
}: EncryptAssetPayloadInput): Promise<EncryptedAssetPayload> {
  const validatedPayload = parseAssetPayload(payload);
  const encrypted = await encryptVaultPayload({
    associatedData: getAssetAssociatedData(validatedPayload.assetType),
    key,
    plaintext: JSON.stringify(validatedPayload),
  });

  return {
    assetType: validatedPayload.assetType,
    ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce,
  };
}

export async function decryptAssetPayload({
  encrypted,
  key,
}: DecryptAssetPayloadInput): Promise<AssetPlaintextPayload> {
  const plaintext = await decryptVaultPayload({
    associatedData: getAssetAssociatedData(encrypted.assetType),
    ciphertext: encrypted.ciphertext,
    key,
    nonce: encrypted.nonce,
  });

  return parseAssetPayload(JSON.parse(plaintext));
}

function parseAssetPayload(payload: unknown): AssetPlaintextPayload {
  const result = assetPlaintextPayloadSchema.safeParse(payload);

  if (!result.success) {
    throw new Error("Asset payload is invalid.");
  }

  return result.data;
}

function getAssetAssociatedData(assetType: AssetPlaintextPayload["assetType"]): string {
  return `vault-asset:${assetType}`;
}
