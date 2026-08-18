import { z } from "zod";

import type { NativePackageOpenAdapterV1 } from "./native-package-open-coordinator";

export const CLAIMANT_NATIVE_PACKAGE_OPEN_ADAPTER_APPROVED = false as const;

export type ClaimantPackageOpenNativeV1 = Readonly<{
  verifyAndOpenPackageAsync(input: Readonly<{ canonical_manifest: string; delivery_payload: string;
    case_id: string; delivery_id: string; delivery_key: string; detached_signature: string;
    expected_manifest_digest: string; expected_payload_bytes: number;
    expected_payload_digest: string; key_alias_reference: string; signing_key_id: string;
    signing_public_key: string; receipt_ref: string; release_package_id: string;
    retrieval_session_id: string }>): Promise<unknown>;
}>;

export class NativePackageOpenAdapterError extends Error {
  constructor(readonly kind: "disabled" | "failed" | "invalid_response") {
    super("Native package opening is unavailable."); this.name = "NativePackageOpenAdapterError";
  }
}

export function createNativePackageOpenAdapterV1(input: Readonly<{
  approved?: boolean; native: ClaimantPackageOpenNativeV1 | null;
}>): NativePackageOpenAdapterV1 {
  return { async verifyAndOpen(value) {
    if (!(input.approved ?? CLAIMANT_NATIVE_PACKAGE_OPEN_ADAPTER_APPROVED))
      throw new NativePackageOpenAdapterError("disabled");
    if (!input.native) throw new NativePackageOpenAdapterError("failed");
    try {
      const result = await input.native.verifyAndOpenPackageAsync({
        canonical_manifest: value.canonicalManifest, case_id: value.caseId,
        delivery_id: value.deliveryId, delivery_key: value.deliveryKey,
        delivery_payload: value.deliveryPayload,
        detached_signature: value.detachedSignature,
        expected_manifest_digest: value.expectedManifestDigest,
        expected_payload_bytes: value.expectedPayloadBytes,
        expected_payload_digest: value.expectedPayloadDigest,
        key_alias_reference: value.keyAliasReference,
        receipt_ref: value.receiptRef, release_package_id: value.releasePackageId,
        signing_key_id: value.trustedSigningKey.signingKeyId,
        signing_public_key: value.trustedSigningKey.publicKey,
        retrieval_session_id: value.retrievalSessionId,
      });
      const parsed = nativeResultSchema.safeParse(result);
      if (!parsed.success) throw new NativePackageOpenAdapterError("invalid_response");
      return parsed.data;
    } catch (error) {
      if (error instanceof NativePackageOpenAdapterError) throw error;
      throw new NativePackageOpenAdapterError("failed");
    }
  } };
}

const uuid = z.string().uuid(); const digest = z.string().regex(/^[0-9a-f]{64}$/u);
const nativeResultSchema = z.strictObject({ asset_count: z.number().int().min(1).max(100),
  case_id: uuid, delivery_id: uuid, manifest_digest: digest,
  open_session_reference: z.string().regex(/^claimant-package-open\.v1\.[0-9a-f-]{36}$/u),
  opened_at: z.string().datetime({ offset: true }), payload_digest: digest,
  plaintext_exported: z.literal(false), recipient_key_id: uuid, release_package_id: uuid,
  retrieval_session_id: uuid, status: z.literal("opened") });
