import {
  syntheticClaimantDecisionReadinessFixtures,
  type ClaimantPublicDecisionReadinessProjectionV1,
} from "@vault/shared-types";

export type ClaimantSyntheticDecisionReadinessView = {
  key: `example-${number}`;
  label: string;
  projection: ClaimantPublicDecisionReadinessProjectionV1;
};

export const claimantSyntheticDecisionReadinessViews =
  syntheticClaimantDecisionReadinessFixtures.map(({ projection }, index) => ({
    key: `example-${index + 1}` as const,
    label: labelFor(projection.stage),
    projection,
  })) satisfies readonly ClaimantSyntheticDecisionReadinessView[];

function labelFor(stage: ClaimantPublicDecisionReadinessProjectionV1["stage"]): string {
  if (stage === "decision_pending") return "Decision pending";
  if (stage === "retrieval_preparing") return "Retrieval preparation";
  if (stage === "retrieval_available") return "Retrieval available";
  if (stage === "retrieval_blocked") return "Retrieval unavailable";
  if (stage === "retrieval_expired") return "Retrieval expired";
  if (stage === "retrieval_suspended") return "Retrieval suspended";
  if (stage === "case_closed") return "Case closed";
  return "Limited status view";
}
