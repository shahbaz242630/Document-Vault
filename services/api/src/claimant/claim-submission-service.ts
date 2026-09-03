import { claimantChecklistItemKeys, syntheticReviewSubmissionDeclarationKeys } from "@vault/shared-types";
import { z } from "zod";

import type { ClaimSubmissionTransactionClientV1 } from "./claim-submission-transaction-client.js";

export const CLAIMANT_SUBMISSION_APPROVED = false as const;
export class ClaimSubmissionServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_submission") {
    super("Claim submission is unavailable."); this.name = "ClaimSubmissionServiceError";
  }
}

export function createClaimSubmissionServiceV1(input: Readonly<{
  approved?: boolean; serverTime: () => string; transactions: ClaimSubmissionTransactionClientV1;
}>) {
  return { async submit(value: Readonly<{
    caseId: string; claimantUserId: string; envelope: unknown; expectedIntakeVersion: number;
    expectedPreparationVersion: number; idempotencyKey: string; portalSessionId: string;
  }>) {
    if (!(input.approved ?? CLAIMANT_SUBMISSION_APPROVED)) {
      throw new ClaimSubmissionServiceError("disabled");
    }
    const parsed = envelopeSchema.safeParse(value.envelope);
    const serverTime = Date.parse(input.serverTime());
    if (!parsed.success || !Number.isFinite(serverTime)
      || Date.parse(parsed.data.created_at) > serverTime || parsed.data.case_ref !== value.caseId
      || parsed.data.idempotency_key !== value.idempotencyKey
      || new Set(parsed.data.declarations).size !== syntheticReviewSubmissionDeclarationKeys.length
      || syntheticReviewSubmissionDeclarationKeys.some((key) => !parsed.data.declarations.includes(key))) {
      throw new ClaimSubmissionServiceError("invalid_submission");
    }
    const seenItems = new Set<string>(); const seenRefs = new Set<string>();
    for (const item of parsed.data.evidence_manifest) {
      if (seenItems.has(item.item_key) || seenRefs.has(item.placeholder_ref)) {
        throw new ClaimSubmissionServiceError("invalid_submission");
      }
      seenItems.add(item.item_key); seenRefs.add(item.placeholder_ref);
    }
    return input.transactions.submit({ bundleRef: parsed.data.evidence_bundle_ref,
      caseId: value.caseId, claimantUserId: value.claimantUserId,
      createdAt: parsed.data.created_at, declarations: parsed.data.declarations,
      evidenceManifest: parsed.data.evidence_manifest.map((item) => ({ itemKey: item.item_key,
        placeholderRef: item.placeholder_ref })), expectedCaseVersion: parsed.data.expected_case_version,
      expectedIntakeVersion: value.expectedIntakeVersion,
      expectedPreparationVersion: value.expectedPreparationVersion,
      idempotencyKey: value.idempotencyKey, policyPackId: parsed.data.policy_id,
      policyPackVersion: parsed.data.policy_version, portalSessionId: value.portalSessionId,
      submissionRef: parsed.data.submission_ref });
  } };
}

const envelopeSchema = z.strictObject({
  protocol: z.literal("sanduqkin:claim:review-submission-envelope:v1"), synthetic_only: z.literal(true),
  production_approved: z.literal(false), runtime_submission_authorized: z.literal(false),
  release_authorized: z.literal(false), status: z.literal("assembled_for_review_submission"),
  submission_ref: z.string().regex(/^synthetic_submission_[a-z0-9_]{1,100}$/u),
  idempotency_key: z.string().uuid(), case_ref: z.string().uuid(),
  expected_case_version: z.number().int().positive(),
  policy_id: z.string().regex(/^synthetic_policy_[a-z0-9_]{1,100}$/u),
  policy_version: z.number().int().positive(),
  evidence_bundle_ref: z.string().regex(/^synthetic_bundle_[a-z0-9_]{1,100}$/u),
  evidence_manifest: z.array(z.strictObject({ item_key: z.enum(claimantChecklistItemKeys),
    placeholder_ref: z.string().regex(/^synthetic_evidence_[a-z0-9_]{1,100}$/u) })).max(13),
  declarations: z.array(z.enum(syntheticReviewSubmissionDeclarationKeys)).length(
    syntheticReviewSubmissionDeclarationKeys.length),
  created_at: z.string().datetime({ offset: false, precision: 3 }),
});
