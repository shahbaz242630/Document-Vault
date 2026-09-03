import { createClient } from "@supabase/supabase-js";
import type { ClaimantChecklistItemKey, ClaimantChecklistConditionKey } from "@vault/shared-types";
import { z } from "zod";

type RpcResult = PromiseLike<Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>>;
type Rpc = (functionName: string, input: Record<string, unknown>) => RpcResult;

export type ClaimIntakeChecklistItemV1 = Readonly<{
  availability: "pending"; itemKey: ClaimantChecklistItemKey; source: "common" | "conditional";
}>;
export type ClaimIntakeInitializationV1 = Readonly<{
  caseId: string; caseVersion: number; checklistItemCount: number;
  replayed: boolean; state: "identity_pending";
}>;

export type ClaimIntakeTransactionClientV1 = Readonly<{
  initialize(input: Readonly<{
    caseId: string; checklistItems: readonly ClaimIntakeChecklistItemV1[]; claimantUserId: string;
    expectedCaseVersion: number; idempotencyKey: string; jurisdictionKey: string;
    policyPackId: string; policyPackVersion: number; portalSessionId: string;
    routingConditions: Readonly<Record<ClaimantChecklistConditionKey, boolean>>;
  }>): Promise<ClaimIntakeInitializationV1>;
}>;

export class ClaimIntakeTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Claim intake transaction failed."); this.name = "ClaimIntakeTransactionError";
  }
}

export function createClaimIntakeTransactionClientV1(rpc: Rpc): ClaimIntakeTransactionClientV1 {
  return { async initialize(input) {
    const result = await rpc("claimant_initialize_claim_intake", {
      p_case_id: input.caseId,
      p_checklist_items: input.checklistItems.map((item) => ({ availability: item.availability,
        item_key: item.itemKey, source: item.source })),
      p_claimant_user_id: input.claimantUserId,
      p_expected_case_version: input.expectedCaseVersion,
      p_idempotency_key: input.idempotencyKey,
      p_jurisdiction_key: input.jurisdictionKey,
      p_policy_pack_id: input.policyPackId,
      p_policy_pack_version: input.policyPackVersion,
      p_portal_session_id: input.portalSessionId,
      p_routing_conditions: input.routingConditions,
    });
    if (result.error) throw new ClaimIntakeTransactionError(result.error.code);
    const parsed = resultSchema.safeParse(result.data);
    if (!parsed.success) throw new Error("Claim intake transaction returned an invalid result.");
    return { caseId: parsed.data.case_id, caseVersion: parsed.data.case_version,
      checklistItemCount: parsed.data.checklist_item_count, replayed: parsed.data.replayed,
      state: parsed.data.state };
  } };
}

export function createClaimIntakeSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): ClaimIntakeTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createClaimIntakeTransactionClientV1((name, input) => supabase.rpc(name, input));
}

const resultSchema = z.strictObject({ case_id: z.string().uuid(), case_version: z.number().int().positive(),
  checklist_item_count: z.number().int().min(7).max(13), replayed: z.boolean(),
  state: z.literal("identity_pending") });
