import type { ClaimantChecklistItemKey } from "../checklist/contracts";
import type { SyntheticEvidencePreparationIssueV1 } from "./contracts";

export function syntheticEvidenceIssue(
  code: SyntheticEvidencePreparationIssueV1["code"],
  itemKey: ClaimantChecklistItemKey | null = null,
  placeholderRef: string | null = null,
): SyntheticEvidencePreparationIssueV1 {
  return { code, item_key: itemKey, placeholder_ref: placeholderRef };
}
