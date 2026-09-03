import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;

export type RetrievalAccessControlInputV1 = Readonly<{ caseId: string;
  controlId: string; controlState: "suspended" | "expired";
  expectedCaseVersion: number; finalizationId: string; idempotencyKey: string;
  reason: "synthetic_security_hold" | "package_expired" }>;
export type RetrievalAccessControlResultV1 = Readonly<{ caseId: string;
  caseState: "release_ready" | "released"; caseVersion: number; controlId: string;
  controlState: "suspended" | "expired"; effectiveAt: string; finalizationId: string;
  futureRetrievalAuthorized: false; futureServingAuthorized: false;
  localContentDeleted: false; localContentRecalled: false; packageWasServed: boolean;
  replayed: boolean; retrievalWasCompleted: boolean }>;
export type RetrievalAccessControlTransactionClientV1 = Readonly<{
  endAccess(input: RetrievalAccessControlInputV1): Promise<RetrievalAccessControlResultV1>;
}>;

export class RetrievalAccessControlTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Retrieval access control transaction failed.");
    this.name = "RetrievalAccessControlTransactionError";
  }
}

export function createRetrievalAccessControlTransactionClientV1(rpc: Rpc):
RetrievalAccessControlTransactionClientV1 {
  return { async endAccess(value) {
    const response = await rpc("claimant_end_release_retrieval_access", {
      p_case_id: value.caseId, p_control_id: value.controlId,
      p_control_state: value.controlState, p_expected_case_version: value.expectedCaseVersion,
      p_finalization_id: value.finalizationId, p_idempotency_key: value.idempotencyKey,
      p_reason: value.reason,
    });
    if (response.error) throw new RetrievalAccessControlTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.case_id !== value.caseId
      || parsed.data.control_id !== value.controlId
      || parsed.data.control_state !== value.controlState
      || parsed.data.finalization_id !== value.finalizationId) {
      throw new Error("Retrieval access control returned invalid data.");
    }
    return { caseId: parsed.data.case_id, caseState: parsed.data.case_state,
      caseVersion: parsed.data.case_version, controlId: parsed.data.control_id,
      controlState: parsed.data.control_state, effectiveAt: parsed.data.effective_at,
      finalizationId: parsed.data.finalization_id,
      futureRetrievalAuthorized: parsed.data.future_retrieval_authorized,
      futureServingAuthorized: parsed.data.future_serving_authorized,
      localContentDeleted: parsed.data.local_content_deleted,
      localContentRecalled: parsed.data.local_content_recalled,
      packageWasServed: parsed.data.package_was_served, replayed: parsed.data.replayed,
      retrievalWasCompleted: parsed.data.retrieval_was_completed };
  } };
}

export function createRetrievalAccessControlSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): RetrievalAccessControlTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createRetrievalAccessControlTransactionClientV1((name, values) =>
    supabase.rpc(name, values));
}

const uuid = z.string().uuid();
const resultSchema = z.strictObject({ case_id: uuid,
  case_state: z.union([z.literal("release_ready"), z.literal("released")]),
  case_version: z.number().int().min(4), control_id: uuid,
  control_state: z.union([z.literal("suspended"), z.literal("expired")]),
  effective_at: z.string().datetime({ offset: true }), finalization_id: uuid,
  future_retrieval_authorized: z.literal(false), future_serving_authorized: z.literal(false),
  local_content_deleted: z.literal(false), local_content_recalled: z.literal(false),
  package_was_served: z.boolean(), replayed: z.boolean(), retrieval_was_completed: z.boolean(),
}).superRefine((value, context) => {
  if (value.retrieval_was_completed && !value.package_was_served) context.addIssue({
    code: "custom", message: "completion requires prior serving" });
});
