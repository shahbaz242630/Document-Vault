import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type RpcResult = PromiseLike<Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>>;
type Rpc = (functionName: string, input: Record<string, unknown>) => RpcResult;

export type OwnerProtectionResultV1 = Readonly<{
  caseId: string; caseVersion: number; cooldownActive: boolean; cooldownExpiresAt: string | null;
  cycleId: string; cycleNumber: number; releaseAuthorized: false; replayed: boolean;
  reviewStarted: false; state: "cancelled_by_owner" | "cooldown" | "on_hold" | "owner_notified";
  status: "cancelled" | "delivery_ambiguous" | "delivery_failed" | "delivery_verified" |
    "disputed" | "invalidated" | "pending_delivery";
}>;

export type OwnerProtectionTransactionClientV1 = Readonly<{
  begin(input: Readonly<{ caseId: string; cooldownSeconds: number; expectedCaseVersion: number;
    idempotencyKey: string; noticeRef: string }>): Promise<OwnerProtectionResultV1>;
  recordDelivery(input: Readonly<{ caseId: string; cycleId: string; deliveryEvidenceDigest: string | null;
    expectedCaseVersion: number; idempotencyKey: string; noticeRef: string;
    outcome: "ambiguous" | "failed" | "verified" }>): Promise<OwnerProtectionResultV1>;
  stop(input: Readonly<{ actorUserId: string | null; caseId: string; cycleId: string;
    expectedCaseVersion: number; idempotencyKey: string;
    reason: "claimant_dispute" | "conflicting_authority" | "material_change" |
      "owner_cancelled" }>): Promise<OwnerProtectionResultV1>;
}>;

export class OwnerProtectionTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Owner protection transaction failed."); this.name = "OwnerProtectionTransactionError";
  }
}

export function createOwnerProtectionTransactionClientV1(rpc: Rpc): OwnerProtectionTransactionClientV1 {
  const call = async (name: string, values: Record<string, unknown>, expected: Readonly<{
    caseId: string; caseVersion: number; cycleId?: string; state: OwnerProtectionResultV1["state"];
    status: OwnerProtectionResultV1["status"];
  }>) => {
    const result = await rpc(name, values);
    if (result.error) throw new OwnerProtectionTransactionError(result.error.code);
    const parsed = resultSchema.safeParse(result.data);
    if (!parsed.success || !coherent(parsed.data) || parsed.data.case_id !== expected.caseId
      || parsed.data.case_version !== expected.caseVersion
      || expected.cycleId !== undefined && parsed.data.cycle_id !== expected.cycleId
      || parsed.data.state !== expected.state || parsed.data.status !== expected.status) {
      throw new Error("Owner protection transaction returned an invalid result.");
    }
    return { caseId: parsed.data.case_id, caseVersion: parsed.data.case_version,
      cooldownActive: parsed.data.cooldown_active,
      cooldownExpiresAt: parsed.data.cooldown_expires_at, cycleId: parsed.data.cycle_id,
      cycleNumber: parsed.data.cycle_number, releaseAuthorized: parsed.data.release_authorized,
      replayed: parsed.data.replayed, reviewStarted: parsed.data.review_started,
      state: parsed.data.state, status: parsed.data.status };
  };
  return {
    begin: (value) => call("claimant_begin_owner_notice", {
      p_case_id: value.caseId, p_cooldown_seconds: value.cooldownSeconds,
      p_expected_case_version: value.expectedCaseVersion,
      p_idempotency_key: value.idempotencyKey, p_notice_ref: value.noticeRef }, {
      caseId: value.caseId, caseVersion: value.expectedCaseVersion + 1,
      state: "owner_notified", status: "pending_delivery" }),
    recordDelivery: (value) => call("claimant_record_owner_notice_delivery", {
      p_case_id: value.caseId, p_cycle_id: value.cycleId,
      p_delivery_evidence_digest: value.deliveryEvidenceDigest,
      p_expected_case_version: value.expectedCaseVersion,
      p_idempotency_key: value.idempotencyKey, p_notice_ref: value.noticeRef,
      p_outcome: value.outcome }, { caseId: value.caseId,
      caseVersion: value.expectedCaseVersion + 1, cycleId: value.cycleId,
      state: value.outcome === "verified" ? "cooldown" : "on_hold",
      status: value.outcome === "verified" ? "delivery_verified" : `delivery_${value.outcome}` }),
    stop: (value) => call("claimant_stop_owner_protection", {
      p_actor_user_id: value.actorUserId, p_case_id: value.caseId, p_cycle_id: value.cycleId,
      p_expected_case_version: value.expectedCaseVersion,
      p_idempotency_key: value.idempotencyKey, p_reason: value.reason }, {
      caseId: value.caseId, caseVersion: value.expectedCaseVersion + 1, cycleId: value.cycleId,
      state: value.reason === "owner_cancelled" ? "cancelled_by_owner" : "on_hold",
      status: value.reason === "owner_cancelled" ? "cancelled"
        : value.reason === "claimant_dispute" ? "disputed" : "invalidated" }),
  };
}

export function createOwnerProtectionSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): OwnerProtectionTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createOwnerProtectionTransactionClientV1((name, input) => supabase.rpc(name, input));
}

const resultSchema = z.strictObject({ case_id: z.string().uuid(), case_version: z.number().int().min(2),
  cooldown_active: z.boolean(), cooldown_expires_at: z.string().datetime({ offset: true }).nullable(),
  cycle_id: z.string().uuid(), cycle_number: z.number().int().positive(),
  release_authorized: z.literal(false), replayed: z.boolean(), review_started: z.literal(false),
  state: z.enum(["cancelled_by_owner", "cooldown", "on_hold", "owner_notified"]),
  status: z.enum(["cancelled", "delivery_ambiguous", "delivery_failed", "delivery_verified",
    "disputed", "invalidated", "pending_delivery"]) });
function coherent(value: z.infer<typeof resultSchema>) {
  return value.cooldown_active
    ? value.state === "cooldown" && value.status === "delivery_verified"
      && value.cooldown_expires_at !== null
    : value.state !== "cooldown" && value.status !== "delivery_verified"
      && value.cooldown_expires_at === null;
}
