import { z } from "zod";

import type { OwnerProtectionTransactionClientV1 } from "./owner-protection-transaction-client.js";

export const CLAIMANT_OWNER_PROTECTION_APPROVED = false as const;
export class OwnerProtectionServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input") {
    super("Owner protection is unavailable."); this.name = "OwnerProtectionServiceError";
  }
}

export function createOwnerProtectionServiceV1(input: Readonly<{
  approved?: boolean; transactions: OwnerProtectionTransactionClientV1;
}>) {
  const approved = () => {
    if (!(input.approved ?? CLAIMANT_OWNER_PROTECTION_APPROVED)) {
      throw new OwnerProtectionServiceError("disabled");
    }
  };
  return {
    async begin(value: unknown) { approved(); const parsed = beginSchema.safeParse(value);
      if (!parsed.success) invalid(); return input.transactions.begin(parsed.data); },
    async recordDelivery(value: unknown) { approved(); const parsed = deliverySchema.safeParse(value);
      if (!parsed.success || (parsed.data.outcome === "verified") !==
        (parsed.data.deliveryEvidenceDigest !== null)) invalid();
      return input.transactions.recordDelivery(parsed.data); },
    async stop(value: unknown) { approved(); const parsed = stopSchema.safeParse(value);
      if (!parsed.success || (["owner_cancelled", "claimant_dispute"].includes(parsed.data.reason))
        !== (parsed.data.actorUserId !== null)) invalid();
      return input.transactions.stop(parsed.data); },
  };
}

const uuid = z.string().uuid(); const positive = z.number().int().positive();
const beginSchema = z.strictObject({ caseId: uuid, cooldownSeconds: z.number().int().min(86400).max(7776000),
  expectedCaseVersion: positive, idempotencyKey: uuid,
  noticeRef: z.string().regex(/^synthetic_owner_notice_[a-z0-9_]{1,100}$/u) });
const deliverySchema = z.strictObject({ caseId: uuid, cycleId: uuid,
  deliveryEvidenceDigest: z.string().regex(/^[0-9a-f]{64}$/u).nullable(),
  expectedCaseVersion: positive, idempotencyKey: uuid,
  noticeRef: z.string().regex(/^synthetic_owner_notice_[a-z0-9_]{1,100}$/u),
  outcome: z.enum(["ambiguous", "failed", "verified"]) });
const stopSchema = z.strictObject({ actorUserId: uuid.nullable(), caseId: uuid, cycleId: uuid,
  expectedCaseVersion: positive, idempotencyKey: uuid,
  reason: z.enum(["claimant_dispute", "conflicting_authority", "material_change", "owner_cancelled"]) });
function invalid(): never { throw new OwnerProtectionServiceError("invalid_input"); }
