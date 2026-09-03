import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;
export type EncryptedDeliveryPrepareInputV1 = Readonly<{ caseId: string;
  deliveryId: string; deliveryKey: string; expectedCaseVersion: number;
  idempotencyKey: string; retrievalSessionId: string }>;
export type EncryptedDeliveryPayloadV1 = z.infer<typeof payloadSchema>;
export type EncryptedDeliveryPreparedV1 = Readonly<{ caseId: string;
  caseState: "release_ready"; caseVersion: number; deliveryId: string;
  deliveryKey: string; deliveryPayload: string; deliveryStatus: "prepared_unserved";
  finalizationId: string; grantId: string; leaseExpiresAt: string; packageServed: false;
  payload: EncryptedDeliveryPayloadV1; payloadBytes: number; payloadDigest: string;
  recipientKeyId: string; releasePackageId: string; replayed: boolean;
  retrievalCompleted: false; retrievalSessionId: string }>;
export type EncryptedDeliveryCommitInputV1 = Readonly<{ completedAt: string;
  deliveryId: string; deliveryKey: string; idempotencyKey: string;
  payloadBytes: number; payloadDigest: string; receiptDigest: string; receiptRef: string }>;
export type EncryptedDeliveryCommittedV1 = Readonly<{ caseId: string;
  caseState: "released"; caseVersion: number; deliveryId: string; deliveryKey: string;
  deliveryStatus: "served"; firstSuccessfulDelivery: boolean; packageServed: true;
  receiptRef: string; releasePackageId: string; replayed: boolean;
  retrievalCompleted: false; retrievalSessionId: string; servedAt: string }>;
export type EncryptedPackageDeliveryTransactionClientV1 = Readonly<{
  commit(input: EncryptedDeliveryCommitInputV1): Promise<EncryptedDeliveryCommittedV1>;
  prepare(input: EncryptedDeliveryPrepareInputV1): Promise<EncryptedDeliveryPreparedV1>;
}>;

export class EncryptedPackageDeliveryTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Encrypted package delivery transaction failed.");
    this.name = "EncryptedPackageDeliveryTransactionError";
  }
}

export function createEncryptedPackageDeliveryTransactionClientV1(rpc: Rpc):
EncryptedPackageDeliveryTransactionClientV1 {
  return {
    async prepare(value) {
      const response = await rpc("claimant_prepare_encrypted_package_delivery", {
        p_case_id: value.caseId, p_delivery_id: value.deliveryId,
        p_delivery_key: value.deliveryKey,
        p_expected_case_version: value.expectedCaseVersion,
        p_idempotency_key: value.idempotencyKey,
        p_retrieval_session_id: value.retrievalSessionId,
      });
      if (response.error) throw new EncryptedPackageDeliveryTransactionError(response.error.code);
      const parsed = preparedSchema.safeParse(response.data);
      if (!parsed.success) throw new Error("Encrypted delivery preparation returned invalid data.");
      let payloadValue: unknown;
      try { payloadValue = JSON.parse(parsed.data.delivery_payload); }
      catch { throw new Error("Encrypted delivery preparation returned invalid data."); }
      const payload = payloadSchema.safeParse(payloadValue);
      const digest = createHash("sha256").update(parsed.data.delivery_payload).digest("hex");
      const bytes = Buffer.byteLength(parsed.data.delivery_payload, "utf8");
      if (!payload.success || digest !== parsed.data.payload_digest
        || bytes !== parsed.data.payload_bytes || parsed.data.case_id !== value.caseId
        || parsed.data.case_version !== value.expectedCaseVersion
        || parsed.data.delivery_id !== value.deliveryId
        || parsed.data.delivery_key !== value.deliveryKey
        || parsed.data.retrieval_session_id !== value.retrievalSessionId
        || payload.data.case_id !== value.caseId
        || payload.data.release_package_id !== parsed.data.release_package_id
        || payload.data.finalization_id !== parsed.data.finalization_id
        || payload.data.retrieval_session_id !== value.retrievalSessionId
        || payload.data.release_material.grant_id !== parsed.data.grant_id
        || payload.data.release_material.recipient_key_id !== parsed.data.recipient_key_id
        || !contiguousAssets(payload.data.assets)) {
        throw new Error("Encrypted delivery preparation returned invalid data.");
      }
      return { caseId: parsed.data.case_id, caseState: parsed.data.case_state,
        caseVersion: parsed.data.case_version, deliveryId: parsed.data.delivery_id,
        deliveryKey: parsed.data.delivery_key, deliveryPayload: parsed.data.delivery_payload,
        deliveryStatus: parsed.data.delivery_status,
        finalizationId: parsed.data.finalization_id, grantId: parsed.data.grant_id,
        leaseExpiresAt: parsed.data.lease_expires_at,
        packageServed: parsed.data.package_served, payload: payload.data,
        payloadBytes: parsed.data.payload_bytes, payloadDigest: parsed.data.payload_digest,
        recipientKeyId: parsed.data.recipient_key_id,
        releasePackageId: parsed.data.release_package_id, replayed: parsed.data.replayed,
        retrievalCompleted: parsed.data.retrieval_completed,
        retrievalSessionId: parsed.data.retrieval_session_id };
    },
    async commit(value) {
      const response = await rpc("claimant_commit_encrypted_package_delivery", {
        p_completed_at: value.completedAt, p_delivery_id: value.deliveryId,
        p_delivery_key: value.deliveryKey, p_idempotency_key: value.idempotencyKey,
        p_payload_bytes: value.payloadBytes, p_payload_digest: value.payloadDigest,
        p_receipt_digest: value.receiptDigest, p_receipt_ref: value.receiptRef,
      });
      if (response.error) throw new EncryptedPackageDeliveryTransactionError(response.error.code);
      const parsed = committedSchema.safeParse(response.data);
      if (!parsed.success || parsed.data.delivery_id !== value.deliveryId
        || parsed.data.delivery_key !== value.deliveryKey
        || parsed.data.receipt_ref !== value.receiptRef) {
        throw new Error("Encrypted delivery commit returned invalid data.");
      }
      return { caseId: parsed.data.case_id, caseState: parsed.data.case_state,
        caseVersion: parsed.data.case_version, deliveryId: parsed.data.delivery_id,
        deliveryKey: parsed.data.delivery_key, deliveryStatus: parsed.data.delivery_status,
        firstSuccessfulDelivery: parsed.data.first_successful_delivery,
        packageServed: parsed.data.package_served, receiptRef: parsed.data.receipt_ref,
        releasePackageId: parsed.data.release_package_id, replayed: parsed.data.replayed,
        retrievalCompleted: parsed.data.retrieval_completed,
        retrievalSessionId: parsed.data.retrieval_session_id,
        servedAt: parsed.data.served_at };
    },
  };
}

export function createEncryptedPackageDeliverySupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): EncryptedPackageDeliveryTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createEncryptedPackageDeliveryTransactionClientV1((name, values) =>
    supabase.rpc(name, values));
}

const uuid = z.string().uuid(); const digest = z.string().regex(/^[0-9a-f]{64}$/u);
const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/u);
const assetSchema = z.strictObject({ asset_type: z.string().min(1).max(100),
  ciphertext: base64url.min(16).max(1_048_576), ciphertext_digest: digest,
  nonce: base64url.min(16).max(256), ordinal: z.number().int().min(1).max(100),
  source_asset_id: uuid });
const payloadSchema = z.strictObject({ assets: z.array(assetSchema).min(1).max(100),
  case_id: uuid, finalization_id: uuid,
  protocol: z.literal("sanduqkin:claim:encrypted-delivery:v1"),
  release_material: z.strictObject({ aead: z.literal("xchacha20poly1305_ietf"),
    ciphertext: base64url.min(64), grant_id: uuid, grant_version: z.number().int().positive(),
    kdf: z.literal("hkdf_sha256"), key_agreement: z.literal("p256_ecdh"),
    nonce: base64url, owner_ephemeral_public_key: base64url,
    profile: z.literal("registered_recipient_v2"),
    protocol: z.literal("sanduqkin:claim:recipient-grant:v2"), recipient_key_id: uuid,
    recipient_key_version: z.number().int().positive() }),
  release_package_id: uuid, retrieval_session_id: uuid,
  signed_manifest: z.strictObject({ canonical_manifest: z.string().min(256).max(65_536),
    detached_signature: base64url.length(86), manifest_digest: digest,
    signature_algorithm: z.literal("ed25519") }) });
const preparedSchema = z.strictObject({ case_id: uuid, case_state: z.literal("release_ready"),
  case_version: z.number().int().min(4), delivery_id: uuid, delivery_key: z.string()
    .regex(/^synthetic_package_delivery_[a-z0-9_]{1,100}$/u),
  delivery_payload: z.string().min(512).max(12_582_912),
  delivery_status: z.literal("prepared_unserved"), finalization_id: uuid, grant_id: uuid,
  lease_expires_at: z.string().datetime({ offset: true }), package_served: z.literal(false),
  payload_bytes: z.number().int().min(512).max(12_582_912), payload_digest: digest,
  recipient_key_id: uuid, release_package_id: uuid, replayed: z.boolean(),
  retrieval_completed: z.literal(false), retrieval_session_id: uuid });
const committedSchema = z.strictObject({ case_id: uuid, case_state: z.literal("released"),
  case_version: z.number().int().min(5), delivery_id: uuid,
  delivery_key: z.string().regex(/^synthetic_package_delivery_[a-z0-9_]{1,100}$/u),
  delivery_status: z.literal("served"), first_successful_delivery: z.boolean(),
  package_served: z.literal(true), receipt_ref: z.string()
    .regex(/^synthetic_delivery_receipt_[a-z0-9_]{1,100}$/u),
  release_package_id: uuid, replayed: z.boolean(), retrieval_completed: z.literal(false),
  retrieval_session_id: uuid, served_at: z.string().datetime({ offset: true }) });
function contiguousAssets(assets: readonly z.infer<typeof assetSchema>[]) {
  return assets.every((asset, index) => asset.ordinal === index + 1)
    && new Set(assets.map(({ source_asset_id }) => source_asset_id)).size === assets.length;
}
