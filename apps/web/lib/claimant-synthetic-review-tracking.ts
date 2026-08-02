import {
  syntheticClaimantReviewTrackingFixtures,
  type ClaimantPublicReviewTrackingProjectionV1,
} from "@vault/shared-types";

export type ClaimantSyntheticReviewTrackingView = {
  key: `example-${number}`;
  label: string;
  projection: ClaimantPublicReviewTrackingProjectionV1;
};

export const claimantSyntheticReviewTrackingViews =
  syntheticClaimantReviewTrackingFixtures.map(({ projection }, index) => ({
    key: `example-${index + 1}` as const,
    label: labelFor(projection.stage),
    projection,
  })) satisfies readonly ClaimantSyntheticReviewTrackingView[];

function labelFor(stage: ClaimantPublicReviewTrackingProjectionV1["stage"]): string {
  if (stage === "not_started") return "Before protected checks";
  if (stage === "owner_protection_in_progress") return "Protection checks";
  if (stage === "independent_review_in_progress") return "Independent review";
  if (stage === "additional_checks_in_progress") return "Additional checks";
  if (stage === "checks_recorded") return "Checks recorded";
  return "Limited tracking view";
}
