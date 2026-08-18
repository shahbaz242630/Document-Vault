import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: Readonly<{ code?: string }> | null;
}>>;

export type ReleaseAuthorizationInputV1 = Readonly<{
  authorityIdentityId: string; caseId: string; cycleId: string;
  expectedBindingVersion: number; expectedCaseVersion: number;
  expectedFinalizationVersion: number; expectedRoundVersion: number;
  idempotencyKey: string; reviewRoundId: string;
}>;
export type ReleaseAuthorizationResultV1 = Readonly<{
  caseId: string; caseState: "approved"; caseVersion: number; cycleId: string;
  packageCreationAuthorized: false; releaseAuthorizationId: string;
  releaseAuthorized: true; releaseStatus: "authorized"; replayed: boolean;
  retrievalAuthorized: false; reviewRoundId: string;
}>;
export type ReleaseAuthorizationTransactionClientV1 = Readonly<{
  authorize(input: ReleaseAuthorizationInputV1): Promise<ReleaseAuthorizationResultV1>;
}>;

export class ReleaseAuthorizationTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Release authorization transaction failed.");
    this.name = "ReleaseAuthorizationTransactionError";
  }
}

export function createReleaseAuthorizationTransactionClientV1(rpc: Rpc):
ReleaseAuthorizationTransactionClientV1 {
  return { async authorize(value) {
    const response = await rpc("claimant_authorize_release", {
      p_authority_identity_id: value.authorityIdentityId, p_case_id: value.caseId,
      p_cycle_id: value.cycleId, p_expected_binding_version: value.expectedBindingVersion,
      p_expected_case_version: value.expectedCaseVersion,
      p_expected_finalization_version: value.expectedFinalizationVersion,
      p_expected_round_version: value.expectedRoundVersion,
      p_idempotency_key: value.idempotencyKey, p_review_round_id: value.reviewRoundId });
    if (response.error) throw new ReleaseAuthorizationTransactionError(response.error.code);
    const parsed = resultSchema.safeParse(response.data);
    if (!parsed.success || parsed.data.case_id !== value.caseId
      || parsed.data.case_version !== value.expectedCaseVersion + 1
      || parsed.data.cycle_id !== value.cycleId
      || parsed.data.review_round_id !== value.reviewRoundId) {
      throw new Error("Release authorization transaction returned an invalid result.");
    }
    return { caseId: parsed.data.case_id, caseState: parsed.data.case_state,
      caseVersion: parsed.data.case_version, cycleId: parsed.data.cycle_id,
      packageCreationAuthorized: parsed.data.package_creation_authorized,
      releaseAuthorizationId: parsed.data.release_authorization_id,
      releaseAuthorized: parsed.data.release_authorized,
      releaseStatus: parsed.data.release_status, replayed: parsed.data.replayed,
      retrievalAuthorized: parsed.data.retrieval_authorized,
      reviewRoundId: parsed.data.review_round_id };
  } };
}

export function createReleaseAuthorizationSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): ReleaseAuthorizationTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  return createReleaseAuthorizationTransactionClientV1((name, values) => supabase.rpc(name, values));
}

const resultSchema = z.strictObject({ case_id: z.string().uuid(),
  case_state: z.literal("approved"), case_version: z.number().int().min(3),
  cycle_id: z.string().uuid(), package_creation_authorized: z.literal(false),
  release_authorization_id: z.string().uuid(), release_authorized: z.literal(true),
  release_status: z.literal("authorized"), replayed: z.boolean(),
  retrieval_authorized: z.literal(false), review_round_id: z.string().uuid() });
