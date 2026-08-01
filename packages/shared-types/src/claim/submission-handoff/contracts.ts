import type { ClaimantPublicJourneyProjectionV1 } from "../journey";
import type { SyntheticReviewSubmissionEnvelopeV1 } from "../review-submission/contracts";
import type {
  SyntheticClaimScenarioDenialReason,
  SyntheticClaimScenarioSnapshotV1,
  SyntheticClaimScenarioStepV1,
} from "../scenario";

export type SyntheticSubmissionHandoffInputV1 = {
  envelope: SyntheticReviewSubmissionEnvelopeV1;
  snapshot: SyntheticClaimScenarioSnapshotV1;
  step: SyntheticClaimScenarioStepV1;
};

export type SyntheticSubmissionAcknowledgementV1 = {
  protocol: "sanduqkin:claim:submission-acknowledgement:v1";
  synthetic_only: true;
  runtime_effect: false;
  review_started: false;
  release_authorized: false;
  status: "received_for_review" | "already_received";
  acknowledgement_ref: string;
  case_version: number;
  projection: ClaimantPublicJourneyProjectionV1;
};

export type SyntheticSubmissionHandoffDenialReason =
  | "invalid_envelope"
  | "case_binding_mismatch"
  | "state_not_handoff_ready"
  | "version_conflict"
  | "step_binding_mismatch"
  | "invalid_step"
  | SyntheticClaimScenarioDenialReason;

export type SyntheticSubmissionHandoffResultV1 =
  | {
      status: "applied" | "duplicate";
      acknowledgement: SyntheticSubmissionAcknowledgementV1;
      snapshot: SyntheticClaimScenarioSnapshotV1;
      invalidates: readonly string[];
    }
  | {
      status: "denied";
      reason: SyntheticSubmissionHandoffDenialReason;
      acknowledgement: null;
      snapshot: SyntheticClaimScenarioSnapshotV1;
      invalidates: readonly [];
    };
