import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;
export type VerifiedSignedManifestV1 = Readonly<{ canonicalManifest: string;
  detachedSignature: string; grantId: string; manifestDigest: string;
  manifestId: string; signatureVerifiedAt: string }>;
export type SignedManifestFinalizationInputV1 = Readonly<{ caseId: string;
  expectedCaseVersion: number; expectedSigningKeyVersion: number; finalizationId: string;
  idempotencyKey: string; manifests: readonly VerifiedSignedManifestV1[]; packageId: string;
  releaseAuthorizationId: string; signingAuthorityId: string; signingKeyRecordId: string;
  verifiedPublicKeyDigest: string }>;
export type SignedManifestFinalizationResultV1 = Readonly<{ caseId: string;
  caseState: "release_ready"; caseVersion: number; finalizationId: string;
  finalizationStatus: "finalized_release_ready"; manifestCount: number;
  manifestSigned: true; releasePackageId: string; replayed: boolean;
  retrievalAuthorized: false }>;
export type SignedManifestTransactionClientV1 = Readonly<{ finalize(
  input: SignedManifestFinalizationInputV1): Promise<SignedManifestFinalizationResultV1> }>;

export class SignedManifestTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Signed manifest finalization failed."); this.name = "SignedManifestTransactionError";
  }
}

export function createSignedManifestTransactionClientV1(rpc: Rpc):
SignedManifestTransactionClientV1 {
  return { async finalize(value) {
    const response = await rpc("claimant_finalize_signed_release_package", {
      p_case_id: value.caseId, p_expected_case_version: value.expectedCaseVersion,
      p_expected_signing_key_version: value.expectedSigningKeyVersion,
      p_verified_public_key_digest: value.verifiedPublicKeyDigest,
      p_finalization_id: value.finalizationId, p_idempotency_key: value.idempotencyKey,
      p_manifests: value.manifests.map((manifest) => ({
        canonical_manifest: manifest.canonicalManifest,
        detached_signature: manifest.detachedSignature, grant_id: manifest.grantId,
        manifest_digest: manifest.manifestDigest, manifest_id: manifest.manifestId,
        signature_verified_at: manifest.signatureVerifiedAt })),
      p_package_id: value.packageId,
      p_release_authorization_id: value.releaseAuthorizationId,
      p_signing_authority_id: value.signingAuthorityId,
      p_signing_key_id: value.signingKeyRecordId });
    if (response.error) throw new SignedManifestTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.case_id !== value.caseId
      || parsed.data.case_version !== value.expectedCaseVersion + 1
      || parsed.data.release_package_id !== value.packageId
      || parsed.data.finalization_id !== value.finalizationId
      || parsed.data.manifest_count !== value.manifests.length) {
      throw new Error("Signed manifest transaction returned an invalid result.");
    }
    return { caseId: parsed.data.case_id, caseState: parsed.data.case_state,
      caseVersion: parsed.data.case_version, finalizationId: parsed.data.finalization_id,
      finalizationStatus: parsed.data.finalization_status,
      manifestCount: parsed.data.manifest_count, manifestSigned: parsed.data.manifest_signed,
      releasePackageId: parsed.data.release_package_id, replayed: parsed.data.replayed,
      retrievalAuthorized: parsed.data.retrieval_authorized };
  } };
}

export function createSignedManifestSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): SignedManifestTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createSignedManifestTransactionClientV1((name, values) => supabase.rpc(name, values));
}

const resultSchema = z.strictObject({ case_id: z.string().uuid(),
  case_state: z.literal("release_ready"), case_version: z.number().int().min(4),
  finalization_id: z.string().uuid(),
  finalization_status: z.literal("finalized_release_ready"),
  manifest_count: z.number().int().min(2).max(10), manifest_signed: z.literal(true),
  release_package_id: z.string().uuid(), replayed: z.boolean(),
  retrieval_authorized: z.literal(false) });
