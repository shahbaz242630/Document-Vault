import { createClient } from "@supabase/supabase-js";
import type { ClaimantChecklistItemKey, SyntheticEvidenceMediaType } from "@vault/shared-types";
import { z } from "zod";

type RpcResult = PromiseLike<Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>>;
type Rpc = (functionName: string, input: Record<string, unknown>) => RpcResult;

export type PreparedEvidenceMetadataV1 = Readonly<{
  itemKey: ClaimantChecklistItemKey;
  mediaType: SyntheticEvidenceMediaType;
  placeholderRef: string;
  preparedAt: string;
  sizeBytes: number;
}>;

export type EvidencePreparationResultV1 = Readonly<{
  caseId: string;
  caseVersion: number;
  intakeVersion: number;
  preparedItemCount: number;
  replayed: boolean;
  status: "documents_needed" | "manual_review";
  unavailableItemCount: number;
}>;

export type EvidencePreparationTransactionClientV1 = Readonly<{
  record(input: Readonly<{
    bundleRef: string;
    caseId: string;
    claimantUserId: string;
    expectedCaseVersion: number;
    expectedIntakeVersion: number;
    idempotencyKey: string;
    policyPackId: string;
    policyPackVersion: number;
    portalSessionId: string;
    preparedItems: readonly PreparedEvidenceMetadataV1[];
    unavailableItems: readonly ClaimantChecklistItemKey[];
  }>): Promise<EvidencePreparationResultV1>;
}>;

export class EvidencePreparationTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Evidence preparation transaction failed.");
    this.name = "EvidencePreparationTransactionError";
  }
}

export function createEvidencePreparationTransactionClientV1(
  rpc: Rpc,
): EvidencePreparationTransactionClientV1 {
  return { async record(input) {
    const result = await rpc("claimant_record_evidence_preparation", {
      p_bundle_ref: input.bundleRef,
      p_case_id: input.caseId,
      p_claimant_user_id: input.claimantUserId,
      p_expected_case_version: input.expectedCaseVersion,
      p_expected_intake_version: input.expectedIntakeVersion,
      p_idempotency_key: input.idempotencyKey,
      p_policy_pack_id: input.policyPackId,
      p_policy_pack_version: input.policyPackVersion,
      p_portal_session_id: input.portalSessionId,
      p_prepared_items: input.preparedItems.map((item) => ({
        item_key: item.itemKey,
        media_type: item.mediaType,
        placeholder_ref: item.placeholderRef,
        prepared_at: item.preparedAt,
        size_bytes: item.sizeBytes,
      })),
      p_unavailable_items: input.unavailableItems,
    });
    if (result.error) throw new EvidencePreparationTransactionError(result.error.code);
    const parsed = resultSchema.safeParse(result.data);
    if (!parsed.success) throw new Error("Evidence preparation transaction returned an invalid result.");
    return {
      caseId: parsed.data.case_id,
      caseVersion: parsed.data.case_version,
      intakeVersion: parsed.data.intake_version,
      preparedItemCount: parsed.data.prepared_item_count,
      replayed: parsed.data.replayed,
      status: parsed.data.status,
      unavailableItemCount: parsed.data.unavailable_item_count,
    };
  } };
}

export function createEvidencePreparationSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string;
  supabaseUrl: string;
}>): EvidencePreparationTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createEvidencePreparationTransactionClientV1((name, input) => supabase.rpc(name, input));
}

const resultSchema = z.strictObject({
  case_id: z.string().uuid(),
  case_version: z.number().int().positive(),
  intake_version: z.number().int().min(2),
  prepared_item_count: z.number().int().min(0).max(13),
  replayed: z.boolean(),
  status: z.enum(["documents_needed", "manual_review"]),
  unavailable_item_count: z.number().int().min(0).max(13),
}).refine((value) => value.prepared_item_count + value.unavailable_item_count >= 1
  && value.prepared_item_count + value.unavailable_item_count <= 13
  && (value.unavailable_item_count > 0) === (value.status === "manual_review"));
