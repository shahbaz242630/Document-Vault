import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;
export type RetrievalSessionAuthorizationInputV1 = Readonly<{
  authenticatedAt: string; caseId: string; claimantUserId: string;
  expectedCaseVersion: number; finalizationId: string; grantId: string;
  idempotencyKey: string; packageId: string; portalSessionId: string;
  recipientKeyId: string; retrievalSessionId: string;
}>;
export type RetrievalSessionAuthorizationResultV1 = Readonly<{
  caseId: string; caseState: "release_ready"; caseVersion: number;
  finalizationId: string; grantId: string; packageServed: false;
  packageServingAuthorized: false; portalSessionVersion: number;
  recipientKeyId: string; releasePackageId: string; replayed: boolean;
  retrievalCompleted: false; retrievalSessionExpiresAt: string;
  retrievalSessionId: string; retrievalSessionStatus: "authorized_unserved";
  sessionAuthorized: true;
}>;
export type RetrievalSessionTransactionClientV1 = Readonly<{ authorize(
  input: RetrievalSessionAuthorizationInputV1,
): Promise<RetrievalSessionAuthorizationResultV1> }>;

export class RetrievalSessionTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Claimant retrieval session transaction failed.");
    this.name = "RetrievalSessionTransactionError";
  }
}

export function createRetrievalSessionTransactionClientV1(rpc: Rpc):
RetrievalSessionTransactionClientV1 {
  return { async authorize(value) {
    const response = await rpc("claimant_authorize_release_retrieval_session", {
      p_authenticated_at: value.authenticatedAt, p_case_id: value.caseId,
      p_claimant_user_id: value.claimantUserId,
      p_expected_case_version: value.expectedCaseVersion,
      p_finalization_id: value.finalizationId, p_grant_id: value.grantId,
      p_idempotency_key: value.idempotencyKey, p_package_id: value.packageId,
      p_portal_session_id: value.portalSessionId,
      p_recipient_key_id: value.recipientKeyId,
      p_retrieval_session_id: value.retrievalSessionId,
    });
    if (response.error) throw new RetrievalSessionTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.case_id !== value.caseId
      || parsed.data.case_version !== value.expectedCaseVersion
      || parsed.data.finalization_id !== value.finalizationId
      || parsed.data.release_package_id !== value.packageId
      || parsed.data.grant_id !== value.grantId
      || parsed.data.recipient_key_id !== value.recipientKeyId
      || parsed.data.retrieval_session_id !== value.retrievalSessionId) {
      throw new Error("Retrieval session transaction returned an invalid result.");
    }
    return { caseId: parsed.data.case_id, caseState: parsed.data.case_state,
      caseVersion: parsed.data.case_version, finalizationId: parsed.data.finalization_id,
      grantId: parsed.data.grant_id, packageServed: parsed.data.package_served,
      packageServingAuthorized: parsed.data.package_serving_authorized,
      portalSessionVersion: parsed.data.portal_session_version,
      recipientKeyId: parsed.data.recipient_key_id,
      releasePackageId: parsed.data.release_package_id, replayed: parsed.data.replayed,
      retrievalCompleted: parsed.data.retrieval_completed,
      retrievalSessionExpiresAt: parsed.data.retrieval_session_expires_at,
      retrievalSessionId: parsed.data.retrieval_session_id,
      retrievalSessionStatus: parsed.data.retrieval_session_status,
      sessionAuthorized: parsed.data.session_authorized };
  } };
}

export function createRetrievalSessionSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): RetrievalSessionTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createRetrievalSessionTransactionClientV1((name, values) =>
    supabase.rpc(name, values));
}

const resultSchema = z.strictObject({ case_id: z.string().uuid(),
  case_state: z.literal("release_ready"), case_version: z.number().int().min(4),
  finalization_id: z.string().uuid(), grant_id: z.string().uuid(),
  package_served: z.literal(false), package_serving_authorized: z.literal(false),
  portal_session_version: z.number().int().positive(),
  recipient_key_id: z.string().uuid(), release_package_id: z.string().uuid(),
  replayed: z.boolean(), retrieval_completed: z.literal(false),
  retrieval_session_expires_at: z.string().datetime({ offset: true }),
  retrieval_session_id: z.string().uuid(),
  retrieval_session_status: z.literal("authorized_unserved"),
  session_authorized: z.literal(true) });
