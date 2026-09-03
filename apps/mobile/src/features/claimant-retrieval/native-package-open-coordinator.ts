import { assertReleaseManifestV1, canonicalJson, type ReleaseManifestV1 } from "@vault/shared-types";
import { z } from "zod";

export const CLAIMANT_NATIVE_PACKAGE_OPEN_APPROVED = false as const;

export type TrustedReleaseSigningKeyV1 = Readonly<{ algorithm: "ed25519";
  publicKey: string; signingKeyId: string; status: "active"; syntheticOnly: true }>;
export type ReleaseSigningKeyResolverV1 = Readonly<{
  resolve(signingKeyId: string): Promise<unknown>;
}>;
export type NativePackageOpenAdapterV1 = Readonly<{
  verifyAndOpen(input: Readonly<{ canonicalManifest: string; caseId: string; deliveryId: string;
    deliveryKey: string; deliveryPayload: string; detachedSignature: string;
    expectedManifestDigest: string; expectedPayloadBytes: number; expectedPayloadDigest: string;
    keyAliasReference: string; receiptRef: string; releasePackageId: string;
    retrievalSessionId: string; signal?: AbortSignal;
    trustedSigningKey: TrustedReleaseSigningKeyV1 }>): Promise<unknown>;
}>;

export class NativePackageOpenError extends Error {
  constructor(readonly kind: "aborted" | "disabled" | "invalid_input" | "verification_failed") {
    super("Encrypted package could not be opened."); this.name = "NativePackageOpenError";
  }
}

export function createNativePackageOpenCoordinatorV1(input: Readonly<{
  approved?: boolean; native: NativePackageOpenAdapterV1; now?: () => Date;
  signingKeys: ReleaseSigningKeyResolverV1;
}>) {
  let running = false;
  return { async open(value: unknown, signal?: AbortSignal) {
    if (!(input.approved ?? CLAIMANT_NATIVE_PACKAGE_OPEN_APPROVED))
      throw new NativePackageOpenError("disabled");
    const request = requestSchema.safeParse(value);
    if (!request.success) throw new NativePackageOpenError("invalid_input");
    if (running) throw new NativePackageOpenError("verification_failed");
    running = true;
    try {
      active(signal);
      const payload = payloadSchema.safeParse(parseJson(request.data.deliveryPayload));
      if (!payload.success) invalid();
      const manifest = parseManifest(payload.data.signed_manifest.canonical_manifest);
      requireBindings(request.data, payload.data, manifest, input.now?.() ?? new Date());
      active(signal);
      const key = trustedKeySchema.safeParse(await input.signingKeys.resolve(manifest.signing_key_id));
      if (!key.success || key.data.signingKeyId !== manifest.signing_key_id) verificationFailed();
      const opened = openedSchema.safeParse(await input.native.verifyAndOpen({
        canonicalManifest: payload.data.signed_manifest.canonical_manifest,
        caseId: request.data.caseId, deliveryId: request.data.deliveryId,
        deliveryKey: request.data.deliveryKey,
        deliveryPayload: request.data.deliveryPayload,
        detachedSignature: payload.data.signed_manifest.detached_signature,
        expectedManifestDigest: payload.data.signed_manifest.manifest_digest,
        expectedPayloadBytes: request.data.payloadBytes,
        expectedPayloadDigest: request.data.payloadDigest,
        keyAliasReference: request.data.keyAliasReference, receiptRef: request.data.receiptRef,
        releasePackageId: request.data.releasePackageId,
        retrievalSessionId: request.data.retrievalSessionId, signal,
        trustedSigningKey: key.data,
      }));
      active(signal);
      if (!opened.success || opened.data.case_id !== request.data.caseId
        || opened.data.delivery_id !== request.data.deliveryId
        || opened.data.release_package_id !== payload.data.release_package_id
        || opened.data.retrieval_session_id !== payload.data.retrieval_session_id
        || opened.data.recipient_key_id !== payload.data.release_material.recipient_key_id
        || opened.data.payload_digest !== request.data.payloadDigest
        || opened.data.manifest_digest !== payload.data.signed_manifest.manifest_digest
        || opened.data.asset_count !== payload.data.assets.length
        || !validOpenedTime(opened.data.opened_at, request.data.servedAt, manifest.expires_at,
          input.now?.() ?? new Date())) verificationFailed();
      return { assetCount: opened.data.asset_count, caseId: opened.data.case_id,
        deliveryId: opened.data.delivery_id, expiresAt: manifest.expires_at,
        openSessionReference: opened.data.open_session_reference,
        openedAt: opened.data.opened_at, plaintextExported: opened.data.plaintext_exported,
        releasePackageId: opened.data.release_package_id,
        retrievalCompleted: false as const, status: opened.data.status };
    } catch (error) {
      if (error instanceof NativePackageOpenError) throw error;
      if (signal?.aborted) throw new NativePackageOpenError("aborted");
      throw new NativePackageOpenError("verification_failed");
    } finally { running = false; }
  } };
}

function requireBindings(request: z.infer<typeof requestSchema>, payload: z.infer<typeof payloadSchema>,
  manifest: ReleaseManifestV1, now: Date): void {
  const material = manifest.release_material;
  if (canonicalJson(manifest as never) !== payload.signed_manifest.canonical_manifest
    || request.releasedCaseVersion !== request.authorizedCaseVersion + 1
    || request.caseId !== payload.case_id || request.releasePackageId !== payload.release_package_id
    || request.retrievalSessionId !== payload.retrieval_session_id
    || manifest.claim_id !== payload.case_id || manifest.release_package_id !== payload.release_package_id
    || manifest.claim_version + 1 !== request.authorizedCaseVersion
    || Date.parse(manifest.expires_at) <= now.getTime()
    || material.profile !== "registered_recipient_v1"
    || material.recipient_id !== manifest.claimant_id
    || material.grant_id !== payload.release_material.grant_id
    || material.grant_version !== payload.release_material.grant_version
    || material.recipient_key_id !== payload.release_material.recipient_key_id
    || material.recipient_key_version !== payload.release_material.recipient_key_version
    || request.recipientKeyId !== payload.release_material.recipient_key_id
    || !contiguousAssets(payload.assets)
    || !sameDigests(manifest.asset_ciphertext_digests,
      payload.assets.map(({ ciphertext_digest }) => hexDigestToBase64url(ciphertext_digest)))) invalid();
}
function parseManifest(value: string): ReleaseManifestV1 {
  const parsed = parseJson(value); try { assertReleaseManifestV1(parsed); return parsed; } catch { invalid(); }
}
function parseJson(value: string): unknown { try { return JSON.parse(value); } catch { invalid(); } }
function sameDigests(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function validOpenedTime(openedAt: string, servedAt: string, expiresAt: string, now: Date) {
  const opened = Date.parse(openedAt);
  return opened >= Date.parse(servedAt) - 1_000 && opened <= Date.parse(expiresAt)
    && opened <= now.getTime() + 60_000;
}
function contiguousAssets(assets: readonly z.infer<typeof assetSchema>[]) {
  return assets.every((asset, index) => asset.ordinal === index + 1)
    && new Set(assets.map(({ source_asset_id }) => source_asset_id)).size === assets.length;
}
function hexDigestToBase64url(value: string): string {
  const bytes = Array.from({ length: value.length / 2 }, (_entry, index) =>
    Number.parseInt(value.slice(index * 2, index * 2 + 2), 16));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"; let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const block = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    output += alphabet[(block >>> 18) & 63] + alphabet[(block >>> 12) & 63];
    if (index + 1 < bytes.length) output += alphabet[(block >>> 6) & 63];
    if (index + 2 < bytes.length) output += alphabet[block & 63];
  }
  return output;
}
function active(signal?: AbortSignal): void { if (signal?.aborted) throw new NativePackageOpenError("aborted"); }
function invalid(): never { throw new NativePackageOpenError("invalid_input"); }
function verificationFailed(): never { throw new NativePackageOpenError("verification_failed"); }

const uuid = z.string().uuid(); const digest = z.string().regex(/^[0-9a-f]{64}$/u);
const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/u);
const requestSchema = z.strictObject({ authorizedCaseVersion: z.number().int().min(4), caseId: uuid,
  deliveryId: uuid, deliveryKey: z.string().regex(/^synthetic_package_delivery_[a-z0-9_]{1,100}$/u),
  deliveryPayload: z.string().min(512).max(12_582_912), deliveryStatus: z.literal("served"),
  keyAliasReference: z.string().regex(/^claimant-enrollment\.v1\.[0-9a-f-]{36}$/u),
  packageServed: z.literal(true), payloadBytes: z.number().int().min(512).max(12_582_912),
  payloadDigest: digest, receiptRef: z.string().regex(/^synthetic_delivery_receipt_[a-z0-9_]{1,100}$/u),
  recipientKeyId: uuid, releasePackageId: uuid, releasedCaseVersion: z.number().int().min(5),
  retrievalCompleted: z.literal(false), retrievalSessionId: uuid,
  servedAt: z.string().datetime({ offset: true }) });
const assetSchema = z.strictObject({ asset_type: z.string().min(1).max(100),
  ciphertext: base64url.min(16).max(1_048_576), ciphertext_digest: digest,
  nonce: base64url.min(16).max(256), ordinal: z.number().int().min(1).max(100), source_asset_id: uuid });
const payloadSchema = z.strictObject({ assets: z.array(assetSchema).min(1).max(100), case_id: uuid,
  finalization_id: uuid, protocol: z.literal("sanduqkin:claim:encrypted-delivery:v1"),
  release_material: z.strictObject({ aead: z.literal("xchacha20poly1305_ietf"),
    ciphertext: base64url.min(64), grant_id: uuid, grant_version: z.number().int().positive(),
    kdf: z.literal("hkdf_sha256"), key_agreement: z.literal("p256_ecdh"), nonce: base64url,
    owner_ephemeral_public_key: base64url, profile: z.literal("registered_recipient_v2"),
    protocol: z.literal("sanduqkin:claim:recipient-grant:v2"), recipient_key_id: uuid,
    recipient_key_version: z.number().int().positive() }), release_package_id: uuid,
  retrieval_session_id: uuid, signed_manifest: z.strictObject({ canonical_manifest: z.string().min(256).max(65_536),
    detached_signature: base64url.length(86), manifest_digest: digest,
    signature_algorithm: z.literal("ed25519") }) });
const trustedKeySchema = z.strictObject({ algorithm: z.literal("ed25519"), publicKey: base64url.length(43),
  signingKeyId: z.string().regex(/^claim-release-signing-synthetic-[a-z0-9-]{1,100}$/u),
  status: z.literal("active"), syntheticOnly: z.literal(true) });
const openedSchema = z.strictObject({ asset_count: z.number().int().min(1).max(100), case_id: uuid,
  delivery_id: uuid, manifest_digest: digest, open_session_reference: z.string()
    .regex(/^claimant-package-open\.v1\.[0-9a-f-]{36}$/u), opened_at: z.string().datetime({ offset: true }),
  payload_digest: digest, plaintext_exported: z.literal(false), recipient_key_id: uuid,
  release_package_id: uuid, retrieval_session_id: uuid, status: z.literal("opened") });
