import { createHash, createPublicKey, verify } from "node:crypto";

import { assertSignedReleasePackageV1, canonicalJson,
  type SignedReleasePackageV1 } from "@vault/shared-types";
import { z } from "zod";

import type { SignedManifestTransactionClientV1 }
  from "./signed-manifest-transaction-client.js";

export const CLAIMANT_SIGNED_MANIFEST_APPROVED = false as const;
export type ActiveReleaseSigningKeyV1 = Readonly<{ algorithm: "ed25519";
  authorityId: string; keyRecordId: string; keyVersion: number; liveSigningAuthority: false;
  publicKey: string; signingKeyId: string; status: "active"; syntheticOnly: true }>;
export type ReleaseSigningKeyResolverV1 = Readonly<{ getActiveKey(input: Readonly<{
  authorityId: string; keyRecordId: string; keyVersion: number }>):
  Promise<ActiveReleaseSigningKeyV1> }>;

export class SignedManifestServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input" | "verification_failed") {
    super("Signed manifest finalization is unavailable."); this.name = "SignedManifestServiceError";
  }
}

export function createSignedManifestServiceV1(input: Readonly<{ approved?: boolean;
  now?: () => Date; signingKeys: ReleaseSigningKeyResolverV1;
  transactions: SignedManifestTransactionClientV1 }>) {
  return { async finalize(value: unknown) {
    if (!(input.approved ?? CLAIMANT_SIGNED_MANIFEST_APPROVED))
      throw new SignedManifestServiceError("disabled");
    const parsed = requestSchema.safeParse(value);
    if (!parsed.success) throw new SignedManifestServiceError("invalid_input");
    const key = await input.signingKeys.getActiveKey({
      authorityId: parsed.data.signingAuthorityId,
      keyRecordId: parsed.data.signingKeyRecordId,
      keyVersion: parsed.data.expectedSigningKeyVersion });
    requireTrustedKey(key, parsed.data);
    const verifiedAt = (input.now ?? (() => new Date()))().toISOString();
    const seenGrants = new Set<string>(); const seenManifests = new Set<string>();
    const manifests = parsed.data.manifests.map((entry) => {
      let signed: SignedReleasePackageV1;
      try { assertSignedReleasePackageV1(entry.signedPackage);
        signed = entry.signedPackage as SignedReleasePackageV1;
      } catch { throw new SignedManifestServiceError("invalid_input"); }
      const material = signed.manifest.release_material;
      if (signed.manifest.claim_id !== parsed.data.caseId
        || signed.manifest.release_package_id !== parsed.data.packageId
        || signed.manifest.claim_version !== parsed.data.expectedCaseVersion
        || signed.manifest.signing_key_id !== key.signingKeyId
        || material.profile !== "registered_recipient_v1"
        || material.grant_id !== entry.grantId
        || seenGrants.has(entry.grantId) || seenManifests.has(entry.manifestId))
        throw new SignedManifestServiceError("invalid_input");
      seenGrants.add(entry.grantId); seenManifests.add(entry.manifestId);
      const canonicalManifest = canonicalJson(signed.manifest);
      if (!verifyEd25519(canonicalManifest, signed.manifest_signature, key.publicKey))
        throw new SignedManifestServiceError("verification_failed");
      return { canonicalManifest, detachedSignature: signed.manifest_signature,
        grantId: entry.grantId,
        manifestDigest: createHash("sha256").update(canonicalManifest).digest("hex"),
        manifestId: entry.manifestId, signatureVerifiedAt: verifiedAt };
    });
    return input.transactions.finalize({ caseId: parsed.data.caseId,
      expectedCaseVersion: parsed.data.expectedCaseVersion,
      expectedSigningKeyVersion: parsed.data.expectedSigningKeyVersion,
      finalizationId: parsed.data.finalizationId, idempotencyKey: parsed.data.idempotencyKey,
      manifests, packageId: parsed.data.packageId,
      releaseAuthorizationId: parsed.data.releaseAuthorizationId,
      signingAuthorityId: parsed.data.signingAuthorityId,
      signingKeyRecordId: parsed.data.signingKeyRecordId,
      verifiedPublicKeyDigest: createHash("sha256")
        .update(Buffer.from(key.publicKey, "base64url")).digest("hex") });
  } };
}

function requireTrustedKey(key: ActiveReleaseSigningKeyV1, expected: Readonly<{
  expectedSigningKeyVersion: number; signingAuthorityId: string; signingKeyRecordId: string }>) {
  if (key.algorithm !== "ed25519" || key.status !== "active" || !key.syntheticOnly
    || key.liveSigningAuthority || key.authorityId !== expected.signingAuthorityId
    || key.keyRecordId !== expected.signingKeyRecordId
    || key.keyVersion !== expected.expectedSigningKeyVersion
    || !/^claim-release-signing-synthetic-[a-z0-9-]{1,100}$/u.test(key.signingKeyId)
    || !canonicalBase64url(key.publicKey, 32))
    throw new SignedManifestServiceError("verification_failed");
}

function verifyEd25519(message: string, signature: string, publicKey: string) {
  if (!canonicalBase64url(signature, 64)) return false;
  try { const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(publicKey, "base64url")]);
    return verify(null, Buffer.from(message, "utf8"),
      createPublicKey({ format: "der", key: spki, type: "spki" }),
      Buffer.from(signature, "base64url"));
  } catch { return false; }
}

function canonicalBase64url(value: string, bytes: number) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength === bytes && decoded.toString("base64url") === value;
}

const uuid = z.string().uuid();
const requestSchema = z.strictObject({ caseId: uuid,
  expectedCaseVersion: z.number().int().min(3),
  expectedSigningKeyVersion: z.number().int().positive(), finalizationId: uuid,
  idempotencyKey: uuid, manifests: z.array(z.strictObject({ grantId: uuid,
    manifestId: uuid, signedPackage: z.unknown() })).min(2).max(10), packageId: uuid,
  releaseAuthorizationId: uuid, signingAuthorityId: uuid, signingKeyRecordId: uuid });
