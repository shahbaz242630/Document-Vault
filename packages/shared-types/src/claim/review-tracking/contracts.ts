export const claimantPublicReviewTrackingStages = [
  "not_started",
  "owner_protection_in_progress",
  "independent_review_in_progress",
  "additional_checks_in_progress",
  "checks_recorded",
  "status_unavailable",
] as const;

export type ClaimantPublicReviewTrackingStage =
  (typeof claimantPublicReviewTrackingStages)[number];

export type ClaimantPublicControlStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "status_unavailable";

export type ClaimantPublicReviewTrackingProjectionV1 = {
  protocol: "sanduqkin:claim:review-tracking:v1";
  stage: ClaimantPublicReviewTrackingStage;
  title: string;
  summary: string;
  next_action: string;
  claimant_action_required: boolean;
  owner_protection_status: ClaimantPublicControlStatus;
  review_status: ClaimantPublicControlStatus;
  release_authorized: false;
};
