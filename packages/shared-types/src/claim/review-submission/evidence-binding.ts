import type { SyntheticEvidencePreparationV1 } from "../evidence-preparation/contracts";
import { prepareSyntheticEvidence } from "../evidence-preparation/preparation";
import type {
  SyntheticReviewSubmissionAssemblyInputV1,
  SyntheticReviewSubmissionIssueCode,
} from "./contracts";
import { addSyntheticSubmissionIssue } from "./issues";

export function validateSyntheticSubmissionEvidence(
  input: SyntheticReviewSubmissionAssemblyInputV1,
): SyntheticReviewSubmissionIssueCode[] {
  const issues: SyntheticReviewSubmissionIssueCode[] = [];
  const recomputed = prepareSyntheticEvidence({
    bundle: input.bundle,
    checklist: input.checklist,
    server_time: input.server_time,
  });

  if (recomputed.status !== "ready_for_review" || recomputed.issues.length > 0) {
    addSyntheticSubmissionIssue(issues, "evidence_not_ready");
  }
  if (!preparationsMatch(input.preparation, recomputed)) {
    addSyntheticSubmissionIssue(issues, "evidence_binding_mismatch");
  }
  return issues;
}

function preparationsMatch(
  supplied: SyntheticEvidencePreparationV1,
  recomputed: SyntheticEvidencePreparationV1,
): boolean {
  return (
    supplied.protocol === "sanduqkin:claim:evidence-preparation:v1" &&
    supplied.synthetic_only === true &&
    supplied.release_authorized === false &&
    supplied.status === recomputed.status &&
    supplied.manual_review_reason === recomputed.manual_review_reason &&
    supplied.policy_id === recomputed.policy_id &&
    supplied.policy_version === recomputed.policy_version &&
    supplied.issues.length === recomputed.issues.length &&
    supplied.issues.every((issue, index) => {
      const expected = recomputed.issues[index];
      return (
        issue.code === expected?.code &&
        issue.item_key === expected.item_key &&
        issue.placeholder_ref === expected.placeholder_ref
      );
    }) &&
    supplied.items.length === recomputed.items.length &&
    supplied.items.every((item, index) => {
      const expected = recomputed.items[index];
      return (
        item.key === expected?.key &&
        item.label === expected.label &&
        item.explanation === expected.explanation &&
        item.category === expected.category &&
        item.source === expected.source &&
        item.availability === expected.availability &&
        item.placeholder_ref === expected.placeholder_ref
      );
    })
  );
}
