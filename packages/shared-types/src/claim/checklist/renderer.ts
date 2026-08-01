import { claimantChecklistCatalogue } from "./catalogue";
import type {
  ClaimantChecklistItemKey,
  SyntheticChecklistItemAvailability,
  SyntheticChecklistPolicyPackV1,
  SyntheticChecklistRoutingFactsV1,
  SyntheticRenderedChecklistItemV1,
  SyntheticRenderedChecklistV1,
} from "./contracts";
import { selectSyntheticChecklistPolicy } from "./policy-selection";

export function renderSyntheticClaimantChecklist(input: {
  packs: readonly SyntheticChecklistPolicyPackV1[];
  facts: SyntheticChecklistRoutingFactsV1;
  server_time: string;
  availability?: Partial<
    Record<ClaimantChecklistItemKey, SyntheticChecklistItemAvailability>
  >;
}): SyntheticRenderedChecklistV1 {
  const selection = selectSyntheticChecklistPolicy(input);
  if (selection.status === "manual_review") {
    return manualReviewChecklist(selection.reason);
  }

  const commonItems = selection.pack.common_items.map((key) =>
    renderItem(key, "common", input.availability),
  );
  const conditionalItems = selection.pack.conditional_rules
    .filter(({ when }) => input.facts.conditions[when])
    .map(({ item }) => renderItem(item, "conditional", input.availability));
  const items = [...commonItems, ...conditionalItems];

  if (items.some(({ availability }) => availability === "not_available")) {
    return {
      ...selectedChecklist(selection.pack, items),
      status: "manual_review",
      manual_review_reason: "document_unavailable",
    };
  }
  if (items.every(({ availability }) => availability === "available")) {
    return {
      ...selectedChecklist(selection.pack, items),
      status: "ready_for_review",
      manual_review_reason: null,
    };
  }
  return {
    ...selectedChecklist(selection.pack, items),
    status: "documents_needed",
    manual_review_reason: null,
  };
}

function renderItem(
  key: ClaimantChecklistItemKey,
  source: "common" | "conditional",
  availability?: Partial<
    Record<ClaimantChecklistItemKey, SyntheticChecklistItemAvailability>
  >,
): SyntheticRenderedChecklistItemV1 {
  return {
    ...claimantChecklistCatalogue[key],
    availability: availability?.[key] ?? "pending",
    source,
  };
}

function selectedChecklist(
  pack: SyntheticChecklistPolicyPackV1,
  items: readonly SyntheticRenderedChecklistItemV1[],
) {
  return {
    protocol: "sanduqkin:claim:rendered-checklist:v1" as const,
    synthetic_only: true as const,
    release_authorized: false as const,
    policy_id: pack.policy_id,
    policy_version: pack.policy_version,
    items,
  };
}

function manualReviewChecklist(
  reason: "missing_policy" | "conflicting_policy" | "invalid_policy" | "expired_policy",
): SyntheticRenderedChecklistV1 {
  return {
    protocol: "sanduqkin:claim:rendered-checklist:v1",
    synthetic_only: true,
    release_authorized: false,
    status: "manual_review",
    manual_review_reason: reason,
    policy_id: null,
    policy_version: null,
    items: [],
  };
}
