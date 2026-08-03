import {
  claimantChecklistConditionKeys,
  claimantChecklistItemKeys,
  type SyntheticChecklistPolicyPackV1,
  type SyntheticChecklistPolicySelectionResult,
  type SyntheticChecklistRoutingFactsV1,
} from "./contracts";
import { hasValidSyntheticChecklistChecksum } from "./synthetic-integrity";

export function selectSyntheticChecklistPolicy(input: {
  packs: readonly SyntheticChecklistPolicyPackV1[];
  facts: SyntheticChecklistRoutingFactsV1;
  server_time: string;
}): SyntheticChecklistPolicySelectionResult {
  if (!hasValidRoutingFacts(input.facts)) {
    return { status: "manual_review", reason: "invalid_policy" };
  }

  const matches = input.packs.filter(
    (pack) =>
      pack.jurisdiction_key === input.facts.jurisdiction_key &&
      pack.trigger_type === input.facts.trigger_type,
  );
  if (matches.length === 0) {
    return { status: "manual_review", reason: "missing_policy" };
  }
  if (matches.length !== 1) {
    return { status: "manual_review", reason: "conflicting_policy" };
  }

  const pack = matches[0]!;
  if (!isStructurallyValidPack(pack) || !hasValidSyntheticChecklistChecksum(pack)) {
    return { status: "manual_review", reason: "invalid_policy" };
  }

  const now = Date.parse(input.server_time);
  if (
    !Number.isFinite(now) ||
    now < Date.parse(pack.effective_at) ||
    now >= Date.parse(pack.expires_at)
  ) {
    return { status: "manual_review", reason: "expired_policy" };
  }
  return { status: "selected", pack };
}

function hasValidRoutingFacts(facts: SyntheticChecklistRoutingFactsV1): boolean {
  return (
    facts.protocol === "sanduqkin:claim:checklist-routing:v1" &&
    facts.synthetic_only === true &&
    facts.jurisdiction_key.startsWith("synthetic_jurisdiction_") &&
    facts.trigger_type === "death" &&
    claimantChecklistConditionKeys.every(
      (key) => typeof facts.conditions[key] === "boolean",
    )
  );
}

function isStructurallyValidPack(pack: SyntheticChecklistPolicyPackV1): boolean {
  const itemKeys = [...pack.common_items, ...pack.conditional_rules.map(({ item }) => item)];
  return (
    pack.protocol === "sanduqkin:claim:checklist-policy:v1" &&
    pack.synthetic_only === true &&
    pack.production_approved === false &&
    pack.policy_id.startsWith("synthetic_policy_") &&
    Number.isSafeInteger(pack.policy_version) &&
    pack.policy_version > 0 &&
    pack.jurisdiction_key.startsWith("synthetic_jurisdiction_") &&
    pack.accountable_approver_ref.startsWith("synthetic_approver_") &&
    pack.counsel_source_ref.startsWith("synthetic_source_") &&
    pack.integrity !== undefined &&
    pack.integrity.algorithm === "synthetic_fnv1a32_not_cryptographic" &&
    pack.integrity.key_id.startsWith("synthetic_key_") &&
    itemKeys.every((key) => claimantChecklistItemKeys.includes(key)) &&
    new Set(itemKeys).size === itemKeys.length &&
    pack.conditional_rules.every(({ when }) =>
      claimantChecklistConditionKeys.includes(when),
    ) &&
    validDateOrder(pack)
  );
}

function validDateOrder(pack: SyntheticChecklistPolicyPackV1): boolean {
  const effective = Date.parse(pack.effective_at);
  const review = Date.parse(pack.review_at);
  const expires = Date.parse(pack.expires_at);
  return (
    Number.isFinite(effective) &&
    Number.isFinite(review) &&
    Number.isFinite(expires) &&
    effective < review &&
    review < expires
  );
}
