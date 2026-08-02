export const claimantPublicDecisionReadinessStages = [
  "decision_pending",
  "retrieval_preparing",
  "retrieval_available",
  "retrieval_blocked",
  "retrieval_expired",
  "retrieval_suspended",
  "case_closed",
  "status_unavailable",
] as const;

export type ClaimantPublicDecisionReadinessStage =
  (typeof claimantPublicDecisionReadinessStages)[number];

export type ClaimantPublicDecisionStatus = "pending" | "recorded" | "not_displayed";

export type ClaimantPublicRetrievalStatus =
  | "not_ready"
  | "preparing"
  | "available"
  | "blocked"
  | "expired"
  | "suspended"
  | "closed"
  | "status_unavailable";

export type ClaimantPublicDecisionReadinessProjectionV1 = {
  protocol: "sanduqkin:claim:decision-readiness:v1";
  stage: ClaimantPublicDecisionReadinessStage;
  title: string;
  summary: string;
  next_action: string;
  claimant_action_required: boolean;
  decision_status: ClaimantPublicDecisionStatus;
  retrieval_status: ClaimantPublicRetrievalStatus;
  runtime_effect: false;
  release_authorized: false;
  decryption_authorized: false;
};
