import {
  createSyntheticChecklistRoutingFacts,
  renderSyntheticClaimantChecklist,
  syntheticChecklistPolicyPack,
} from "../checklist";
import type { ClaimantChecklistItemKey } from "../checklist/contracts";
import { syntheticEvidenceDisplayLabel } from "./constants";
import type {
  SyntheticEvidenceBundleV1,
  SyntheticEvidencePlaceholderV1,
} from "./contracts";

export const syntheticEvidenceServerTime = "2026-08-01T00:00:00.000Z";

export const syntheticEvidenceChecklist = renderSyntheticClaimantChecklist({
  packs: [syntheticChecklistPolicyPack],
  facts: createSyntheticChecklistRoutingFacts({ probate_required: true }),
  server_time: syntheticEvidenceServerTime,
});

export function createSyntheticEvidencePlaceholder(
  itemKey: ClaimantChecklistItemKey,
  sequence: number,
): SyntheticEvidencePlaceholderV1 {
  return {
    protocol: "sanduqkin:claim:evidence-placeholder:v1",
    synthetic_only: true,
    placeholder_ref: `synthetic_evidence_${String(sequence).padStart(3, "0")}`,
    checklist_item_key: itemKey,
    display_label: syntheticEvidenceDisplayLabel(itemKey),
    media_type: "application/pdf",
    size_bytes: 1024 + sequence,
    prepared_at: "2026-07-31T12:00:00.000Z",
  };
}

export function createSyntheticEvidenceBundle(input: {
  placeholders?: readonly SyntheticEvidencePlaceholderV1[];
  unavailable_items?: readonly ClaimantChecklistItemKey[];
} = {}): SyntheticEvidenceBundleV1 {
  return {
    protocol: "sanduqkin:claim:evidence-bundle:v1",
    synthetic_only: true,
    production_approved: false,
    bundle_ref: "synthetic_bundle_alpha_001",
    policy_id: syntheticEvidenceChecklist.policy_id!,
    policy_version: syntheticEvidenceChecklist.policy_version!,
    placeholders: input.placeholders ?? [],
    unavailable_items: input.unavailable_items ?? [],
  };
}
