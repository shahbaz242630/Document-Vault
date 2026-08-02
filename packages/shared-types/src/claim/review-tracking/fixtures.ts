import type { ClaimantState } from "../contracts";
import type { ClaimantPublicReviewTrackingProjectionV1 } from "./contracts";
import { projectClaimantPublicReviewTracking } from "./projection";

export type SyntheticClaimantReviewTrackingFixtureV1 = {
  key:
    | "not-started"
    | "protection-in-progress"
    | "review-in-progress"
    | "additional-checks"
    | "checks-recorded"
    | "stopped-outcome"
    | "invalid-input";
  synthetic_only: true;
  projection: ClaimantPublicReviewTrackingProjectionV1;
};

const fixtureStates = [
  ["not-started", "submitted"],
  ["protection-in-progress", "cooldown"],
  ["review-in-progress", "review_pending"],
  ["additional-checks", "on_hold"],
  ["checks-recorded", "approved"],
  ["stopped-outcome", "cancelled_by_owner"],
] as const satisfies readonly (readonly [
  SyntheticClaimantReviewTrackingFixtureV1["key"],
  ClaimantState,
])[];

export const syntheticClaimantReviewTrackingFixtures = [
  ...fixtureStates.map(([key, state]) => ({
    key,
    synthetic_only: true as const,
    projection: projectClaimantPublicReviewTracking(state),
  })),
  {
    key: "invalid-input",
    synthetic_only: true as const,
    projection: projectClaimantPublicReviewTracking("not-a-claimant-state"),
  },
] as const satisfies readonly SyntheticClaimantReviewTrackingFixtureV1[];
