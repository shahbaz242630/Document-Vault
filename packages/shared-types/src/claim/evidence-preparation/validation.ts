import type {
  ClaimantChecklistItemKey,
  SyntheticRenderedChecklistV1,
} from "../checklist/contracts";
import {
  type SyntheticEvidenceBundleV1,
  type SyntheticEvidencePlaceholderV1,
  type SyntheticEvidencePreparationIssueV1,
  type SyntheticEvidenceValidationV1,
} from "./contracts";
import { syntheticEvidenceIssue } from "./issues";
import {
  isClaimantChecklistItemKey,
  validateSyntheticEvidencePlaceholder,
} from "./placeholder-validation";

export function validateSyntheticEvidenceBundle(input: {
  bundle: SyntheticEvidenceBundleV1;
  checklist: SyntheticRenderedChecklistV1;
  server_time: string;
}): SyntheticEvidenceValidationV1 {
  const { bundle, checklist } = input;
  const issues: SyntheticEvidencePreparationIssueV1[] = [];
  const selectedKeys = new Set(checklist.items.map(({ key }) => key));
  const seenItemKeys = new Set<ClaimantChecklistItemKey>();
  const seenPlaceholderRefs = new Set<string>();
  const acceptedPlaceholders: SyntheticEvidencePlaceholderV1[] = [];

  if (
    bundle.protocol !== "sanduqkin:claim:evidence-bundle:v1" ||
    bundle.synthetic_only !== true ||
    bundle.production_approved !== false ||
    !/^synthetic_bundle_[a-z0-9_]+$/u.test(bundle.bundle_ref)
  ) {
    issues.push(syntheticEvidenceIssue("invalid_bundle"));
  }
  if (
    bundle.policy_id !== checklist.policy_id ||
    bundle.policy_version !== checklist.policy_version
  ) {
    issues.push(syntheticEvidenceIssue("policy_binding_mismatch"));
  }

  for (const itemKey of bundle.unavailable_items) {
    const safeItemKey = isClaimantChecklistItemKey(itemKey) ? itemKey : null;
    if (!safeItemKey || !selectedKeys.has(safeItemKey)) {
      issues.push(syntheticEvidenceIssue("unexpected_item", safeItemKey));
      continue;
    }
    if (seenItemKeys.has(safeItemKey)) {
      issues.push(syntheticEvidenceIssue("duplicate_item", safeItemKey));
      continue;
    }
    seenItemKeys.add(safeItemKey);
    issues.push(syntheticEvidenceIssue("document_unavailable", safeItemKey));
  }

  for (const placeholder of bundle.placeholders) {
    const startingIssueCount = issues.length;
    const itemKey = isClaimantChecklistItemKey(placeholder.checklist_item_key)
      ? placeholder.checklist_item_key
      : null;

    if (!itemKey || !selectedKeys.has(itemKey)) {
      issues.push(syntheticEvidenceIssue("unexpected_item", itemKey, placeholder.placeholder_ref));
    } else if (seenItemKeys.has(itemKey)) {
      issues.push(syntheticEvidenceIssue("duplicate_item", itemKey, placeholder.placeholder_ref));
    } else {
      seenItemKeys.add(itemKey);
    }
    if (seenPlaceholderRefs.has(placeholder.placeholder_ref)) {
      issues.push(syntheticEvidenceIssue("duplicate_placeholder_ref", itemKey, placeholder.placeholder_ref));
    } else {
      seenPlaceholderRefs.add(placeholder.placeholder_ref);
    }
    issues.push(
      ...validateSyntheticEvidencePlaceholder({
        placeholder,
        item_key: itemKey,
        server_time: input.server_time,
      }),
    );

    if (issues.length === startingIssueCount) acceptedPlaceholders.push(placeholder);
  }

  return { accepted_placeholders: acceptedPlaceholders, issues };
}
