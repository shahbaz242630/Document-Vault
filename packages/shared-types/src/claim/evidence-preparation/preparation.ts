import type { SyntheticRenderedChecklistV1 } from "../checklist/contracts";
import type {
  SyntheticEvidenceBundleV1,
  SyntheticEvidencePreparationIssueV1,
  SyntheticEvidencePreparationV1,
  SyntheticPreparedEvidenceItemV1,
} from "./contracts";
import { validateSyntheticEvidenceBundle } from "./validation";

export function prepareSyntheticEvidence(input: {
  bundle: SyntheticEvidenceBundleV1;
  checklist: SyntheticRenderedChecklistV1;
  server_time: string;
}): SyntheticEvidencePreparationV1 {
  if (
    input.checklist.status === "manual_review" ||
    !input.checklist.policy_id ||
    input.checklist.policy_version === null
  ) {
    const issues: SyntheticEvidencePreparationIssueV1[] = [
      { code: "checklist_unavailable", item_key: null, placeholder_ref: null },
    ];
    return result(input.checklist, [], "manual_review", "checklist_unavailable", issues);
  }

  const validation = validateSyntheticEvidenceBundle(input);
  if (validation.issues.length > 0) {
    const reason = manualReviewReason(validation.issues);
    return result(
      input.checklist,
      preparedItems(input.checklist, input.bundle, false),
      "manual_review",
      reason,
      validation.issues,
    );
  }

  const items = preparedItems(input.checklist, input.bundle, true);
  const status = items.every(({ availability }) => availability === "available")
    ? "ready_for_review"
    : "documents_needed";
  return result(input.checklist, items, status, null, []);
}

function preparedItems(
  checklist: SyntheticRenderedChecklistV1,
  bundle: SyntheticEvidenceBundleV1,
  acceptAvailable: boolean,
): SyntheticPreparedEvidenceItemV1[] {
  const refsByItem = new Map(
    bundle.placeholders.map(({ checklist_item_key, placeholder_ref }) => [
      checklist_item_key,
      placeholder_ref,
    ]),
  );
  const unavailable = new Set(bundle.unavailable_items);

  return checklist.items.map(({ availability: _availability, ...item }) => ({
    ...item,
    availability: unavailable.has(item.key)
      ? "not_available"
      : acceptAvailable && refsByItem.has(item.key)
        ? "available"
        : "pending",
    placeholder_ref: acceptAvailable ? (refsByItem.get(item.key) ?? null) : null,
  }));
}

function manualReviewReason(issues: readonly SyntheticEvidencePreparationIssueV1[]) {
  if (issues.some(({ code }) => code === "document_unavailable")) {
    return "document_unavailable" as const;
  }
  if (issues.some(({ code }) => code === "policy_binding_mismatch")) {
    return "binding_mismatch" as const;
  }
  return "invalid_metadata" as const;
}

function result(
  checklist: SyntheticRenderedChecklistV1,
  items: readonly SyntheticPreparedEvidenceItemV1[],
  status: SyntheticEvidencePreparationV1["status"],
  manualReviewReason: SyntheticEvidencePreparationV1["manual_review_reason"],
  issues: readonly SyntheticEvidencePreparationIssueV1[],
): SyntheticEvidencePreparationV1 {
  return {
    protocol: "sanduqkin:claim:evidence-preparation:v1",
    synthetic_only: true,
    release_authorized: false,
    status,
    manual_review_reason: manualReviewReason,
    policy_id: checklist.policy_id,
    policy_version: checklist.policy_version,
    items,
    issues,
  };
}
