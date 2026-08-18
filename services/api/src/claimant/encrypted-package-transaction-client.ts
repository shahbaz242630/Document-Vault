import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;
export type EncryptedPackageAssetV1 = Readonly<{ assetId: string; assetType: string;
  ciphertext: string; ciphertextDigest: string; nonce: string }>;
export type EncryptedPackageGrantV1 = Readonly<{ grantId: string; grantVersion: number;
  recipientKeyId: string; recipientKeyVersion: number; sealedGrantDigest: string }>;
export type EncryptedPackageInputV1 = Readonly<{
  assets: readonly EncryptedPackageAssetV1[]; caseId: string; cycleId: string;
  expectedCaseVersion: number; grants: readonly EncryptedPackageGrantV1[];
  idempotencyKey: string; ownerUserId: string; packageId: string; packageRef: string;
  releaseAuthorizationId: string; reviewRoundId: string;
}>;
export type EncryptedPackageResultV1 = Readonly<{
  assetCount: number; caseId: string; caseState: "approved"; caseVersion: number;
  grantCount: number; manifestSigned: false; packageStatus: "prepared_unsigned";
  releaseAuthorizationId: string; releasePackageId: string; replayed: boolean;
  retrievalAuthorized: false;
}>;
export type EncryptedPackageTransactionClientV1 = Readonly<{
  prepare(input: EncryptedPackageInputV1): Promise<EncryptedPackageResultV1>;
}>;

export class EncryptedPackageTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Encrypted package transaction failed.");
    this.name = "EncryptedPackageTransactionError";
  }
}

export function createEncryptedPackageTransactionClientV1(rpc: Rpc):
EncryptedPackageTransactionClientV1 {
  return { async prepare(value) {
    const response = await rpc("claimant_prepare_encrypted_release_package", {
      p_assets: value.assets.map((asset) => ({ asset_id: asset.assetId,
        asset_type: asset.assetType, ciphertext: asset.ciphertext,
        ciphertext_digest: asset.ciphertextDigest, nonce: asset.nonce })),
      p_case_id: value.caseId, p_cycle_id: value.cycleId,
      p_expected_case_version: value.expectedCaseVersion,
      p_grants: value.grants.map((grant) => ({ grant_id: grant.grantId,
        grant_version: grant.grantVersion, recipient_key_id: grant.recipientKeyId,
        recipient_key_version: grant.recipientKeyVersion,
        sealed_grant_digest: grant.sealedGrantDigest })),
      p_idempotency_key: value.idempotencyKey, p_owner_user_id: value.ownerUserId,
      p_package_id: value.packageId, p_package_ref: value.packageRef,
      p_release_authorization_id: value.releaseAuthorizationId,
      p_review_round_id: value.reviewRoundId });
    if (response.error) throw new EncryptedPackageTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.case_id !== value.caseId
      || parsed.data.case_version !== value.expectedCaseVersion
      || parsed.data.release_authorization_id !== value.releaseAuthorizationId
      || parsed.data.release_package_id !== value.packageId
      || parsed.data.asset_count !== value.assets.length
      || parsed.data.grant_count !== value.grants.length) {
      throw new Error("Encrypted package transaction returned an invalid result.");
    }
    return { assetCount: parsed.data.asset_count, caseId: parsed.data.case_id,
      caseState: parsed.data.case_state, caseVersion: parsed.data.case_version,
      grantCount: parsed.data.grant_count, manifestSigned: parsed.data.manifest_signed,
      packageStatus: parsed.data.package_status,
      releaseAuthorizationId: parsed.data.release_authorization_id,
      releasePackageId: parsed.data.release_package_id, replayed: parsed.data.replayed,
      retrievalAuthorized: parsed.data.retrieval_authorized };
  } };
}

export function createEncryptedPackageSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): EncryptedPackageTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createEncryptedPackageTransactionClientV1((name, values) => supabase.rpc(name, values));
}

const resultSchema = z.strictObject({ asset_count: z.number().int().min(1).max(100),
  case_id: z.string().uuid(), case_state: z.literal("approved"),
  case_version: z.number().int().min(3), grant_count: z.number().int().min(2).max(10),
  manifest_signed: z.literal(false), package_status: z.literal("prepared_unsigned"),
  release_authorization_id: z.string().uuid(), release_package_id: z.string().uuid(),
  replayed: z.boolean(), retrieval_authorized: z.literal(false) });
