import { z } from "zod";

import type { EncryptedPackageTransactionClientV1 }
  from "./encrypted-package-transaction-client.js";

export const CLAIMANT_ENCRYPTED_PACKAGE_APPROVED = false as const;

export class EncryptedPackageServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input") {
    super("Encrypted package preparation is unavailable.");
    this.name = "EncryptedPackageServiceError";
  }
}

export function createEncryptedPackageServiceV1(input: Readonly<{
  approved?: boolean; transactions: EncryptedPackageTransactionClientV1;
}>) {
  return { async prepare(value: unknown) {
    if (!(input.approved ?? CLAIMANT_ENCRYPTED_PACKAGE_APPROVED)) {
      throw new EncryptedPackageServiceError("disabled");
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success || new Set(parsed.data.assets.map((item) => item.assetId)).size
      !== parsed.data.assets.length
      || new Set(parsed.data.grants.map((item) => item.grantId)).size
      !== parsed.data.grants.length
      || parsed.data.assets.reduce((sum, item) => sum + item.ciphertext.length, 0) > 10_485_760) {
      throw new EncryptedPackageServiceError("invalid_input");
    }
    return input.transactions.prepare(parsed.data);
  } };
}

const uuid = z.string().uuid(); const positive = z.number().int().positive();
const digest = z.string().regex(/^[0-9a-f]{64}$/u);
const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/u);
const schema = z.strictObject({ assets: z.array(z.strictObject({ assetId: uuid,
  assetType: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/u),
  ciphertext: base64url.min(16).max(1_048_576), ciphertextDigest: digest,
  nonce: base64url.min(16).max(256) })).min(1).max(100), caseId: uuid, cycleId: uuid,
  expectedCaseVersion: positive, grants: z.array(z.strictObject({ grantId: uuid,
    grantVersion: positive, recipientKeyId: uuid, recipientKeyVersion: positive,
    sealedGrantDigest: digest })).min(2).max(10), idempotencyKey: uuid,
  ownerUserId: uuid, packageId: uuid,
  packageRef: z.string().regex(/^synthetic_release_package_[a-z0-9_]{1,100}$/u),
  releaseAuthorizationId: uuid, reviewRoundId: uuid });
