import {
  claimantChecklistItemKeys,
  syntheticEvidenceDisplayLabel,
  syntheticEvidenceMediaTypes,
  syntheticEvidencePlaceholderSizeLimitBytes,
} from "@vault/shared-types";
import { z } from "zod";

import type { EvidencePreparationTransactionClientV1 } from
  "./claim-evidence-preparation-transaction-client.js";

export const CLAIMANT_EVIDENCE_PREPARATION_APPROVED = false as const;

export class EvidencePreparationServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_bundle") {
    super("Evidence preparation is unavailable.");
    this.name = "EvidencePreparationServiceError";
  }
}

export function createEvidencePreparationServiceV1(input: Readonly<{
  approved?: boolean;
  serverTime: () => string;
  transactions: EvidencePreparationTransactionClientV1;
}>) {
  return { async record(value: Readonly<{
    bundle: unknown;
    caseId: string;
    claimantUserId: string;
    expectedCaseVersion: number;
    expectedIntakeVersion: number;
    idempotencyKey: string;
    portalSessionId: string;
  }>) {
    if (!(input.approved ?? CLAIMANT_EVIDENCE_PREPARATION_APPROVED)) {
      throw new EvidencePreparationServiceError("disabled");
    }
    const parsed = bundleSchema.safeParse(value.bundle);
    const serverTime = Date.parse(input.serverTime());
    if (!parsed.success || !Number.isFinite(serverTime)) {
      throw new EvidencePreparationServiceError("invalid_bundle");
    }
    const bundle = parsed.data;
    const seen = new Set<string>();
    const seenPlaceholderRefs = new Set<string>();
    for (const item of [...bundle.placeholders, ...bundle.unavailable_items]) {
      const itemKey = typeof item === "string" ? item : item.checklist_item_key;
      if (seen.has(itemKey)) throw new EvidencePreparationServiceError("invalid_bundle");
      seen.add(itemKey);
      if (typeof item !== "string") {
        if (seenPlaceholderRefs.has(item.placeholder_ref)) {
          throw new EvidencePreparationServiceError("invalid_bundle");
        }
        seenPlaceholderRefs.add(item.placeholder_ref);
      }
    }
    if (seen.size < 1 || seen.size > 13 || bundle.placeholders.some((item) =>
      item.display_label !== syntheticEvidenceDisplayLabel(item.checklist_item_key)
      || Date.parse(item.prepared_at) > serverTime)) {
      throw new EvidencePreparationServiceError("invalid_bundle");
    }
    return input.transactions.record({
      bundleRef: bundle.bundle_ref,
      caseId: value.caseId,
      claimantUserId: value.claimantUserId,
      expectedCaseVersion: value.expectedCaseVersion,
      expectedIntakeVersion: value.expectedIntakeVersion,
      idempotencyKey: value.idempotencyKey,
      policyPackId: bundle.policy_id,
      policyPackVersion: bundle.policy_version,
      portalSessionId: value.portalSessionId,
      preparedItems: bundle.placeholders.map((item) => ({
        itemKey: item.checklist_item_key,
        mediaType: item.media_type,
        placeholderRef: item.placeholder_ref,
        preparedAt: item.prepared_at,
        sizeBytes: item.size_bytes,
      })),
      unavailableItems: bundle.unavailable_items,
    });
  } };
}

const itemKeySchema = z.enum(claimantChecklistItemKeys);
const placeholderSchema = z.strictObject({
  protocol: z.literal("sanduqkin:claim:evidence-placeholder:v1"),
  synthetic_only: z.literal(true),
  placeholder_ref: z.string().regex(/^synthetic_evidence_[a-z0-9_]{1,100}$/u),
  checklist_item_key: itemKeySchema,
  display_label: z.string().min(1).max(160),
  media_type: z.enum(syntheticEvidenceMediaTypes),
  size_bytes: z.number().int().min(1).max(syntheticEvidencePlaceholderSizeLimitBytes),
  prepared_at: z.string().datetime({ offset: false, precision: 3 }),
});
const bundleSchema = z.strictObject({
  protocol: z.literal("sanduqkin:claim:evidence-bundle:v1"),
  synthetic_only: z.literal(true),
  production_approved: z.literal(false),
  bundle_ref: z.string().regex(/^synthetic_bundle_[a-z0-9_]{1,100}$/u),
  policy_id: z.string().regex(/^synthetic_policy_[a-z0-9_]{1,100}$/u),
  policy_version: z.number().int().positive(),
  placeholders: z.array(placeholderSchema).max(13),
  unavailable_items: z.array(itemKeySchema).max(13),
});
