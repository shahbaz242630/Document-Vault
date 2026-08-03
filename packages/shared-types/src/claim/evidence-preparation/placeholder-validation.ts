import {
  claimantChecklistItemKeys,
  type ClaimantChecklistItemKey,
} from "../checklist/contracts";
import {
  syntheticEvidenceDisplayLabel,
  syntheticEvidencePlaceholderSizeLimitBytes,
} from "./constants";
import {
  syntheticEvidenceMediaTypes,
  type SyntheticEvidencePlaceholderV1,
  type SyntheticEvidencePreparationIssueV1,
} from "./contracts";
import { syntheticEvidenceIssue } from "./issues";

export function validateSyntheticEvidencePlaceholder(input: {
  placeholder: SyntheticEvidencePlaceholderV1;
  item_key: ClaimantChecklistItemKey | null;
  server_time: string;
}): SyntheticEvidencePreparationIssueV1[] {
  const { placeholder, item_key: itemKey } = input;
  const issues: SyntheticEvidencePreparationIssueV1[] = [];

  if (
    placeholder.protocol !== "sanduqkin:claim:evidence-placeholder:v1" ||
    placeholder.synthetic_only !== true ||
    !/^synthetic_evidence_[a-z0-9_]+$/u.test(placeholder.placeholder_ref)
  ) {
    issues.push(syntheticEvidenceIssue("invalid_placeholder", itemKey, placeholder.placeholder_ref));
  }
  if (!itemKey || placeholder.display_label !== syntheticEvidenceDisplayLabel(itemKey)) {
    issues.push(syntheticEvidenceIssue("invalid_display_label", itemKey, placeholder.placeholder_ref));
  }
  if (!syntheticEvidenceMediaTypes.includes(placeholder.media_type)) {
    issues.push(syntheticEvidenceIssue("unsupported_media_type", itemKey, placeholder.placeholder_ref));
  }
  if (
    !Number.isSafeInteger(placeholder.size_bytes) ||
    placeholder.size_bytes <= 0 ||
    placeholder.size_bytes > syntheticEvidencePlaceholderSizeLimitBytes
  ) {
    issues.push(syntheticEvidenceIssue("invalid_size", itemKey, placeholder.placeholder_ref));
  }

  const preparedAt = Date.parse(placeholder.prepared_at);
  const now = Date.parse(input.server_time);
  if (!Number.isFinite(preparedAt) || new Date(preparedAt).toISOString() !== placeholder.prepared_at) {
    issues.push(syntheticEvidenceIssue("invalid_prepared_at", itemKey, placeholder.placeholder_ref));
  } else if (!Number.isFinite(now) || preparedAt > now) {
    issues.push(syntheticEvidenceIssue("prepared_in_future", itemKey, placeholder.placeholder_ref));
  }

  return issues;
}

export function isClaimantChecklistItemKey(value: unknown): value is ClaimantChecklistItemKey {
  return claimantChecklistItemKeys.includes(value as ClaimantChecklistItemKey);
}
