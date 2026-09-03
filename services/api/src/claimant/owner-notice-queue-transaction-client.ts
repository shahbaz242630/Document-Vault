import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { OwnerNoticeWorkQueueV1 } from "./owner-notice-delivery-coordinator.js";

type RpcResult = PromiseLike<Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>>;
type Rpc = (functionName: string, input: Record<string, unknown>) => RpcResult;

export class OwnerNoticeQueueTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Owner notice queue transaction failed."); this.name = "OwnerNoticeQueueTransactionError";
  }
}

export function createOwnerNoticeQueueTransactionClientV1(input: Readonly<{
  leaseSeconds: number; rpc: Rpc;
}>): OwnerNoticeWorkQueueV1 {
  if (!Number.isInteger(input.leaseSeconds) || input.leaseSeconds < 30 || input.leaseSeconds > 300) {
    throw new Error("Owner notice queue lease configuration is invalid.");
  }
  return {
    async claim() {
      const response = await input.rpc("claimant_claim_owner_notice_delivery",
        { p_lease_seconds: input.leaseSeconds });
      if (response.error) throw new OwnerNoticeQueueTransactionError(response.error.code);
      const parsed = claimSchema.safeParse(response.data);
      if (!parsed.success) throw new Error("Owner notice queue returned invalid claim authority.");
      if (parsed.data === null) return null;
      const value = parsed.data;
      if (!coherentClaim(value)) {
        throw new Error("Owner notice queue returned invalid claim authority.");
      }
      return { aggregateId: value.aggregate_id, aggregateType: value.aggregate_type,
        attemptNumber: value.attempt_number, caseId: value.case_id,
        caseVersion: value.case_version, cycleId: value.cycle_id,
        cycleNumber: value.cycle_number, dedupeKey: value.dedupe_key,
        deliveryIdempotencyKey: value.delivery_idempotency_key,
        dispatchKey: value.dispatch_key, leaseToken: value.lease_token,
        noticeRef: value.notice_ref, noticeRequestId: value.notice_request_id,
        outboxId: value.outbox_id, payload: value.payload, topic: value.topic };
    },
    async complete(value) {
      const response = await input.rpc("claimant_complete_owner_notice_delivery", {
        p_case_id: value.caseId, p_case_version: value.caseVersion,
        p_cycle_id: value.cycleId, p_delivery_idempotency_key: value.deliveryIdempotencyKey,
        p_lease_token: value.leaseToken, p_outbox_id: value.outboxId, p_outcome: value.outcome });
      if (response.error) throw new OwnerNoticeQueueTransactionError(response.error.code);
      const parsed = completionSchema.safeParse(response.data);
      if (!parsed.success || parsed.data.outbox_id !== value.outboxId
        || parsed.data.status !== (value.outcome === "verified" ? "delivered" : "failed")) {
        throw new Error("Owner notice queue returned invalid completion authority.");
      }
      return { outboxId: parsed.data.outbox_id, status: parsed.data.status };
    },
  };
}

export function createOwnerNoticeQueueSupabaseTransactionClientV1(config: Readonly<{
  leaseSeconds: number; serviceRoleKey: string; supabaseUrl: string;
}>): OwnerNoticeWorkQueueV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createOwnerNoticeQueueTransactionClientV1({ leaseSeconds: config.leaseSeconds,
    rpc: (name, values) => supabase.rpc(name, values) });
}

const uuid = z.string().uuid();
const claimSchema = z.strictObject({ aggregate_id: uuid, aggregate_type: z.literal("case"),
  attempt_number: z.number().int().positive(), case_id: uuid,
  case_version: z.number().int().min(2), cycle_id: uuid,
  cycle_number: z.number().int().positive(), dedupe_key: z.string(),
  delivery_idempotency_key: uuid, dispatch_key: z.string(), lease_token: uuid,
  notice_ref: z.string().regex(/^synthetic_owner_notice_[a-z0-9_]{1,100}$/u),
  notice_request_id: uuid, outbox_id: uuid,
  payload: z.strictObject({ case_version: z.number().int().min(2),
    cycle_number: z.number().int().positive(), event: z.literal("owner_notice_requested") }),
  topic: z.literal("owner_notice_requested") }).nullable();
const completionSchema = z.strictObject({ outbox_id: uuid,
  status: z.enum(["delivered", "failed"]) });
function coherentClaim(value: Exclude<z.infer<typeof claimSchema>, null>) {
  return value.aggregate_id === value.case_id
    && value.dedupe_key === `owner_notice_requested:${value.notice_request_id}`
    && value.dispatch_key === `owner-notice:${value.outbox_id}:${value.delivery_idempotency_key}`
    && value.payload.case_version === value.case_version
    && value.payload.cycle_number === value.cycle_number;
}
