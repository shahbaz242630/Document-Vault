import type { SyntheticReviewSubmissionEnvelopeV1 } from "../review-submission/contracts";
import type { SyntheticClaimScenarioSnapshotV1 } from "../scenario";
import type { SyntheticSubmissionAcknowledgementV1 } from "./contracts";

export function createSyntheticSubmissionAcknowledgement(input: {
  envelope: SyntheticReviewSubmissionEnvelopeV1;
  snapshot: SyntheticClaimScenarioSnapshotV1;
  duplicate: boolean;
}): SyntheticSubmissionAcknowledgementV1 {
  if (!input.snapshot.projection || input.snapshot.current_state !== "submitted") {
    throw new Error("Synthetic submission acknowledgement requires a submitted projection.");
  }
  return {
    protocol: "sanduqkin:claim:submission-acknowledgement:v1",
    synthetic_only: true,
    runtime_effect: false,
    review_started: false,
    release_authorized: false,
    status: input.duplicate ? "already_received" : "received_for_review",
    acknowledgement_ref: input.envelope.submission_ref.replace(
      "synthetic_submission_",
      "synthetic_acknowledgement_",
    ),
    case_version: input.snapshot.version,
    projection: input.snapshot.projection,
  };
}
