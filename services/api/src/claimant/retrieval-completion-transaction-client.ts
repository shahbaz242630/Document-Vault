import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;

export type RetrievalCompletionInputV1 = Readonly<{ appAttestKeyIdDigest: string;
  bundleVersion: string; caseId: string; claimantKeyId: string; completionId: string;
  deliveryId: string; deliveryKey: string; expectedPreviousCounter: number;
  idempotencyKey: string; manifestDigest: string; nativeOpenSessionDigest: string;
  openedAt: string; payloadDigest: string; portalSessionId: string;
  releasePackageId: string; retrievalSessionId: string; validationCategory: 2 | 3 | 4;
  verifiedCounter: number; verifiedProofDigest: string }>;
export type RetrievalCompletionResultV1 = Readonly<{ caseId: string;
  caseState: "released"; caseVersion: number; closureRecorded: false;
  completedAt: string; completionId: string; deliveryId: string;
  exportPerformed: false; packageServed: true; releasePackageId: string;
  replayed: boolean; retrievalCompleted: true; retrievalSessionId: string }>;
export type RetrievalCompletionTransactionClientV1 = Readonly<{
  complete(input: RetrievalCompletionInputV1): Promise<RetrievalCompletionResultV1>;
}>;

export class RetrievalCompletionTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Retrieval completion transaction failed.");
    this.name = "RetrievalCompletionTransactionError";
  }
}

export function createRetrievalCompletionTransactionClientV1(rpc: Rpc):
RetrievalCompletionTransactionClientV1 {
  return { async complete(value) {
    const response = await rpc("claimant_complete_verified_native_open", {
      p_app_attest_key_id_digest: value.appAttestKeyIdDigest,
      p_bundle_version: value.bundleVersion, p_case_id: value.caseId,
      p_claimant_key_id: value.claimantKeyId, p_completion_id: value.completionId,
      p_delivery_id: value.deliveryId, p_delivery_key: value.deliveryKey,
      p_expected_previous_counter: value.expectedPreviousCounter,
      p_idempotency_key: value.idempotencyKey, p_manifest_digest: value.manifestDigest,
      p_native_open_session_digest: value.nativeOpenSessionDigest,
      p_opened_at: value.openedAt, p_payload_digest: value.payloadDigest,
      p_portal_session_id: value.portalSessionId,
      p_release_package_id: value.releasePackageId,
      p_retrieval_session_id: value.retrievalSessionId,
      p_validation_category: value.validationCategory,
      p_verified_counter: value.verifiedCounter,
      p_verified_proof_digest: value.verifiedProofDigest,
    });
    if (response.error) throw new RetrievalCompletionTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.completion_id !== value.completionId
      || parsed.data.delivery_id !== value.deliveryId
      || parsed.data.case_id !== value.caseId
      || parsed.data.release_package_id !== value.releasePackageId
      || parsed.data.retrieval_session_id !== value.retrievalSessionId) {
      throw new Error("Retrieval completion returned invalid data.");
    }
    return { caseId: parsed.data.case_id, caseState: parsed.data.case_state,
      caseVersion: parsed.data.case_version, closureRecorded: parsed.data.closure_recorded,
      completedAt: parsed.data.completed_at, completionId: parsed.data.completion_id,
      deliveryId: parsed.data.delivery_id, exportPerformed: parsed.data.export_performed,
      packageServed: parsed.data.package_served,
      releasePackageId: parsed.data.release_package_id, replayed: parsed.data.replayed,
      retrievalCompleted: parsed.data.retrieval_completed,
      retrievalSessionId: parsed.data.retrieval_session_id };
  } };
}

export function createRetrievalCompletionSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): RetrievalCompletionTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createRetrievalCompletionTransactionClientV1((name, values) =>
    supabase.rpc(name, values));
}

const uuid = z.string().uuid();
const resultSchema = z.strictObject({ case_id: uuid, case_state: z.literal("released"),
  case_version: z.number().int().min(5), closure_recorded: z.literal(false),
  completed_at: z.string().datetime({ offset: true }), completion_id: uuid, delivery_id: uuid,
  export_performed: z.literal(false), package_served: z.literal(true), release_package_id: uuid,
  replayed: z.boolean(), retrieval_completed: z.literal(true), retrieval_session_id: uuid });
