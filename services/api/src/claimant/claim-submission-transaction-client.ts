import { createClient } from "@supabase/supabase-js";
import type { ClaimantChecklistItemKey } from "@vault/shared-types";
import { z } from "zod";

type RpcResult = PromiseLike<Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>>;
type Rpc = (functionName: string, input: Record<string, unknown>) => RpcResult;

export type ClaimSubmissionTransactionResultV1 = Readonly<{
  acknowledgementRef: string; caseId: string; caseVersion: number; intakeVersion: number;
  preparationVersion: number; releaseAuthorized: false; replayed: boolean; reviewStarted: false;
  state: "submitted"; status: "already_received" | "received_for_review";
}>;
export type ClaimSubmissionTransactionClientV1 = Readonly<{
  submit(input: Readonly<{
    bundleRef: string; caseId: string; claimantUserId: string; createdAt: string;
    declarations: readonly string[]; evidenceManifest: readonly Readonly<{
      itemKey: ClaimantChecklistItemKey; placeholderRef: string;
    }>[]; expectedCaseVersion: number; expectedIntakeVersion: number;
    expectedPreparationVersion: number; idempotencyKey: string; policyPackId: string;
    policyPackVersion: number; portalSessionId: string; submissionRef: string;
  }>): Promise<ClaimSubmissionTransactionResultV1>;
}>;
export class ClaimSubmissionTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Claim submission transaction failed."); this.name = "ClaimSubmissionTransactionError";
  }
}

export function createClaimSubmissionTransactionClientV1(rpc: Rpc): ClaimSubmissionTransactionClientV1 {
  return { async submit(input) {
    const result = await rpc("claimant_submit_claim_for_review", {
      p_bundle_ref: input.bundleRef, p_case_id: input.caseId,
      p_claimant_user_id: input.claimantUserId, p_created_at: input.createdAt,
      p_declarations: input.declarations, p_evidence_manifest: input.evidenceManifest.map((item) => ({
        item_key: item.itemKey, placeholder_ref: item.placeholderRef })),
      p_expected_case_version: input.expectedCaseVersion,
      p_expected_intake_version: input.expectedIntakeVersion,
      p_expected_preparation_version: input.expectedPreparationVersion,
      p_idempotency_key: input.idempotencyKey, p_policy_pack_id: input.policyPackId,
      p_policy_pack_version: input.policyPackVersion, p_portal_session_id: input.portalSessionId,
      p_submission_ref: input.submissionRef,
    });
    if (result.error) throw new ClaimSubmissionTransactionError(result.error.code);
    const parsed = resultSchema.safeParse(result.data);
    if (!parsed.success) throw new Error("Claim submission transaction returned an invalid result.");
    return { acknowledgementRef: parsed.data.acknowledgement_ref, caseId: parsed.data.case_id,
      caseVersion: parsed.data.case_version, intakeVersion: parsed.data.intake_version,
      preparationVersion: parsed.data.preparation_version,
      releaseAuthorized: parsed.data.release_authorized, replayed: parsed.data.replayed,
      reviewStarted: parsed.data.review_started, state: parsed.data.state, status: parsed.data.status };
  } };
}

export function createClaimSubmissionSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): ClaimSubmissionTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createClaimSubmissionTransactionClientV1((name, input) => supabase.rpc(name, input));
}

const resultSchema = z.strictObject({ acknowledgement_ref: z.string().regex(
  /^synthetic_acknowledgement_[0-9a-f]{32}$/u), case_id: z.string().uuid(),
case_version: z.number().int().min(2), intake_version: z.number().int().min(2),
preparation_version: z.number().int().min(2), release_authorized: z.literal(false),
replayed: z.boolean(), review_started: z.literal(false), state: z.literal("submitted"),
status: z.enum(["already_received", "received_for_review"]) });
