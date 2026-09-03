import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;

export type RetrievalLifecycleClosureInputV1 = Readonly<{ caseId: string;
  closureId: string; closureReason: "retrieval_lifecycle_complete"; completionId: string;
  deliveryId: string; expectedCaseVersion: number; exportPerformed: boolean;
  exportReceiptDigest: string | null; exportedAt: string | null; idempotencyKey: string;
  releasePackageId: string; retrievalSessionId: string;
  verifiedExportFactDigest: string | null }>;
export type RetrievalLifecycleClosureResultV1 = Readonly<{ caseId: string;
  caseState: "released"; caseVersion: number; closedAt: string; closureId: string;
  closureRecorded: true; completionId: string; deliveryId: string; exportPerformed: boolean;
  historicalCompletionPreserved: true; historicalDeliveryPreserved: true;
  localContentDeleted: false; localContentRecalled: false; releasePackageId: string;
  replayed: boolean; retrievalSessionId: string }>;
export type RetrievalLifecycleClosureTransactionClientV1 = Readonly<{
  close(input: RetrievalLifecycleClosureInputV1): Promise<RetrievalLifecycleClosureResultV1>;
}>;

export class RetrievalLifecycleClosureTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Retrieval lifecycle closure transaction failed.");
    this.name = "RetrievalLifecycleClosureTransactionError";
  }
}

export function createRetrievalLifecycleClosureTransactionClientV1(rpc: Rpc):
RetrievalLifecycleClosureTransactionClientV1 {
  return { async close(value) {
    const response = await rpc("claimant_close_retrieval_lifecycle", {
      p_case_id: value.caseId, p_closure_id: value.closureId,
      p_closure_reason: value.closureReason, p_completion_id: value.completionId,
      p_delivery_id: value.deliveryId, p_expected_case_version: value.expectedCaseVersion,
      p_export_performed: value.exportPerformed,
      p_export_receipt_digest: value.exportReceiptDigest, p_exported_at: value.exportedAt,
      p_idempotency_key: value.idempotencyKey, p_release_package_id: value.releasePackageId,
      p_retrieval_session_id: value.retrievalSessionId,
      p_verified_export_fact_digest: value.verifiedExportFactDigest,
    });
    if (response.error) throw new RetrievalLifecycleClosureTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.closure_id !== value.closureId
      || parsed.data.completion_id !== value.completionId
      || parsed.data.delivery_id !== value.deliveryId || parsed.data.case_id !== value.caseId
      || parsed.data.release_package_id !== value.releasePackageId
      || parsed.data.retrieval_session_id !== value.retrievalSessionId
      || parsed.data.export_performed !== value.exportPerformed)
      throw new Error("Retrieval lifecycle closure returned invalid data.");
    return { caseId: parsed.data.case_id, caseState: parsed.data.case_state,
      caseVersion: parsed.data.case_version, closedAt: parsed.data.closed_at,
      closureId: parsed.data.closure_id, closureRecorded: parsed.data.closure_recorded,
      completionId: parsed.data.completion_id, deliveryId: parsed.data.delivery_id,
      exportPerformed: parsed.data.export_performed,
      historicalCompletionPreserved: parsed.data.historical_completion_preserved,
      historicalDeliveryPreserved: parsed.data.historical_delivery_preserved,
      localContentDeleted: parsed.data.local_content_deleted,
      localContentRecalled: parsed.data.local_content_recalled,
      releasePackageId: parsed.data.release_package_id, replayed: parsed.data.replayed,
      retrievalSessionId: parsed.data.retrieval_session_id };
  } };
}

export function createRetrievalLifecycleClosureSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): RetrievalLifecycleClosureTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createRetrievalLifecycleClosureTransactionClientV1((name, values) =>
    supabase.rpc(name, values));
}

const uuid = z.string().uuid();
const resultSchema = z.strictObject({ case_id: uuid, case_state: z.literal("released"),
  case_version: z.number().int().min(5), closed_at: z.string().datetime({ offset: true }),
  closure_id: uuid, closure_recorded: z.literal(true), completion_id: uuid, delivery_id: uuid,
  export_performed: z.boolean(), historical_completion_preserved: z.literal(true),
  historical_delivery_preserved: z.literal(true), local_content_deleted: z.literal(false),
  local_content_recalled: z.literal(false), release_package_id: uuid, replayed: z.boolean(),
  retrieval_session_id: uuid });
