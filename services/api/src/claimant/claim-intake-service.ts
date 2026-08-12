import { renderSyntheticClaimantChecklist, type SyntheticChecklistPolicyPackV1,
  type SyntheticChecklistRoutingFactsV1 } from "@vault/shared-types";

import type { ClaimIntakeTransactionClientV1 } from "./claim-intake-transaction-client.js";

export const CLAIMANT_INTAKE_INITIALIZATION_APPROVED = false as const;

export class ClaimIntakeServiceError extends Error {
  constructor(readonly kind: "disabled" | "policy_unavailable") {
    super("Claim intake is unavailable."); this.name = "ClaimIntakeServiceError";
  }
}

export function createClaimIntakeServiceV1(input: Readonly<{
  approved?: boolean;
  packs: readonly SyntheticChecklistPolicyPackV1[];
  serverTime: () => string;
  transactions: ClaimIntakeTransactionClientV1;
}>) {
  return { async initialize(value: Readonly<{
    caseId: string; claimantUserId: string; expectedCaseVersion: number; facts: SyntheticChecklistRoutingFactsV1;
    idempotencyKey: string; portalSessionId: string;
  }>) {
    if (!(input.approved ?? CLAIMANT_INTAKE_INITIALIZATION_APPROVED)) throw new ClaimIntakeServiceError("disabled");
    const checklist = renderSyntheticClaimantChecklist({ facts: value.facts, packs: input.packs,
      server_time: input.serverTime() });
    if (checklist.status !== "documents_needed" || !checklist.policy_id || !checklist.policy_version) {
      throw new ClaimIntakeServiceError("policy_unavailable");
    }
    return input.transactions.initialize({ caseId: value.caseId,
      checklistItems: checklist.items.map((item) => ({ availability: "pending" as const,
        itemKey: item.key, source: item.source })),
      claimantUserId: value.claimantUserId, expectedCaseVersion: value.expectedCaseVersion,
      idempotencyKey: value.idempotencyKey, jurisdictionKey: value.facts.jurisdiction_key,
      policyPackId: checklist.policy_id, policyPackVersion: checklist.policy_version,
      portalSessionId: value.portalSessionId, routingConditions: value.facts.conditions });
  } };
}
