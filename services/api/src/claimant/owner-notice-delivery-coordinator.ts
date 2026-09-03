import { createHash } from "node:crypto";
import { z } from "zod";

import type { OwnerProtectionResultV1,
  OwnerProtectionTransactionClientV1 } from "./owner-protection-transaction-client.js";

export const CLAIMANT_OWNER_NOTICE_DELIVERY_APPROVED = false as const;
export const OWNER_NOTICE_PROVIDER_TIMEOUT_MS = 10_000;

export type OwnerNoticeProviderV1 = Readonly<{
  dispatch(input: Readonly<{ dispatchKey: string; noticeRef: string; signal: AbortSignal }> ):
    Promise<unknown>;
  lookup(input: Readonly<{ dispatchKey: string; signal: AbortSignal }> ): Promise<unknown>;
}>;

export type OwnerNoticeWorkQueueV1 = Readonly<{
  claim(): Promise<unknown>;
  complete(input: Readonly<{ caseId: string; caseVersion: number; cycleId: string;
    deliveryIdempotencyKey: string; leaseToken: string; outboxId: string; outcome: "ambiguous" | "failed" |
      "verified" }> ): Promise<unknown>;
}>;

export class OwnerNoticeDeliveryError extends Error {
  constructor(readonly kind: "disabled" | "invalid_authority" | "reconciliation_required") {
    super("Owner notice delivery is unavailable."); this.name = "OwnerNoticeDeliveryError";
  }
}

type Dependencies = Readonly<{ approved?: boolean; provider: OwnerNoticeProviderV1;
  queue: OwnerNoticeWorkQueueV1; transactions: OwnerProtectionTransactionClientV1 }>;

export function createOwnerNoticeDeliveryCoordinatorV1(dependencies: Dependencies) {
  let running = false;
  return { async runOne(): Promise<Readonly<{ outcome: "ambiguous" | "failed" | "verified";
    result: OwnerProtectionResultV1 }> | null> {
    if (!(dependencies.approved ?? CLAIMANT_OWNER_NOTICE_DELIVERY_APPROVED)) {
      throw new OwnerNoticeDeliveryError("disabled");
    }
    if (running) throw new OwnerNoticeDeliveryError("reconciliation_required");
    running = true;
    try {
      const claimed = workSchema.safeParse(await dependencies.queue.claim());
      if (!claimed.success) throw new OwnerNoticeDeliveryError("invalid_authority");
      if (claimed.data === null) return null;
      const work = claimed.data;
      const expectedDispatchKey = `owner-notice:${work.outboxId}:${work.deliveryIdempotencyKey}`;
      if (work.dispatchKey !== expectedDispatchKey || work.aggregateId !== work.caseId
        || work.dedupeKey !== `owner_notice_requested:${work.noticeRequestId}`
        || work.payload.case_version !== work.caseVersion
        || work.payload.cycle_number !== work.cycleNumber) {
        throw new OwnerNoticeDeliveryError("invalid_authority");
      }
      if (work.attemptNumber === 1) {
        try {
          const acknowledgement = dispatchSchema.safeParse(await boundedProviderCall((signal) =>
            dependencies.provider.dispatch({ dispatchKey: work.dispatchKey,
              noticeRef: work.noticeRef, signal })));
          if (!acknowledgement.success || acknowledgement.data.dispatchKey !== work.dispatchKey) {
            throw new Error("invalid provider acknowledgement");
          }
        } catch { /* lookup is the only delivery authority */ }
      }
      let observed: z.infer<typeof lookupSchema> = { dispatchKey: work.dispatchKey,
        status: "unknown" };
      try {
        const lookup = lookupSchema.safeParse(await boundedProviderCall((signal) =>
          dependencies.provider.lookup({ dispatchKey: work.dispatchKey, signal })));
        if (lookup.success && lookup.data.dispatchKey === work.dispatchKey) observed = lookup.data;
      } catch { /* timeout or provider failure remains unknown */ }
      const outcome = observed.status === "verified" ? "verified"
        : observed.status === "failed" ? "failed" : "ambiguous";
      const deliveryEvidenceDigest = observed.status === "verified"
        ? verifiedEvidenceDigest(observed) : null;
      let result: OwnerProtectionResultV1;
      try {
        result = await dependencies.transactions.recordDelivery({ caseId: work.caseId,
          cycleId: work.cycleId, deliveryEvidenceDigest,
          expectedCaseVersion: work.caseVersion,
          idempotencyKey: work.deliveryIdempotencyKey, noticeRef: work.noticeRef, outcome });
      } catch {
        throw new OwnerNoticeDeliveryError("reconciliation_required");
      }
      const completion = completionSchema.safeParse(await dependencies.queue.complete({
        caseId: work.caseId, caseVersion: result.caseVersion, cycleId: work.cycleId,
        deliveryIdempotencyKey: work.deliveryIdempotencyKey, leaseToken: work.leaseToken,
        outboxId: work.outboxId, outcome })
        .catch(() => null));
      const expectedStatus = outcome === "verified" ? "delivered" : "failed";
      if (!completion.success || completion.data.outboxId !== work.outboxId
        || completion.data.status !== expectedStatus) {
        throw new OwnerNoticeDeliveryError("reconciliation_required");
      }
      return { outcome, result };
    } finally { running = false; }
  } };
}

async function boundedProviderCall<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation(controller.signal), new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => { controller.abort(); reject(new Error("provider timeout")); },
        OWNER_NOTICE_PROVIDER_TIMEOUT_MS);
    })]);
  } finally { if (timeout !== undefined) clearTimeout(timeout); }
}

function verifiedEvidenceDigest(value: z.infer<typeof verifiedLookupSchema>) {
  return createHash("sha256").update(JSON.stringify({ deliveredAt: value.deliveredAt,
    dispatchKey: value.dispatchKey, providerMessageDigest: value.providerMessageDigest,
    receiptRef: value.receiptRef, status: value.status })).digest("hex");
}

const uuid = z.string().uuid();
const workSchema = z.strictObject({ aggregateId: uuid, aggregateType: z.literal("case"),
  attemptNumber: z.number().int().positive(), caseId: uuid, caseVersion: z.number().int().min(2),
  cycleId: uuid, cycleNumber: z.number().int().positive(), dedupeKey: z.string(),
  deliveryIdempotencyKey: uuid, dispatchKey: z.string(), noticeRef: z.string()
    .regex(/^synthetic_owner_notice_[a-z0-9_]{1,100}$/u), leaseToken: uuid, noticeRequestId: uuid,
  outboxId: uuid, payload: z.strictObject({ case_version: z.number().int().min(2),
    cycle_number: z.number().int().positive(), event: z.literal("owner_notice_requested") }),
  topic: z.literal("owner_notice_requested") }).nullable();
const dispatchSchema = z.strictObject({ accepted: z.boolean(), dispatchKey: z.string() });
const verifiedLookupSchema = z.strictObject({ deliveredAt: z.string().datetime({ offset: true }),
  dispatchKey: z.string(), providerMessageDigest: z.string().regex(/^[0-9a-f]{64}$/u),
  receiptRef: z.string().regex(/^opaque_receipt_[a-z0-9_]{1,100}$/u),
  status: z.literal("verified") });
const lookupSchema = z.discriminatedUnion("status", [verifiedLookupSchema,
  z.strictObject({ dispatchKey: z.string(), status: z.literal("failed") }),
  z.strictObject({ dispatchKey: z.string(), status: z.literal("unknown") })]);
const completionSchema = z.strictObject({ outboxId: uuid,
  status: z.enum(["delivered", "failed"]) });
