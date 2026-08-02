import { claimantStates } from "../constants";
import type { ClaimantState } from "../contracts";
import type {
  ClaimantPublicControlStatus,
  ClaimantPublicReviewTrackingProjectionV1,
  ClaimantPublicReviewTrackingStage,
} from "./contracts";

type SafeTrackingDefinition = {
  stage: ClaimantPublicReviewTrackingStage;
  title: string;
  summary: string;
  next_action: string;
  claimant_action_required: boolean;
  owner_protection_status: ClaimantPublicControlStatus;
  review_status: ClaimantPublicControlStatus;
};

const trackingByInternalState = {
  draft: notStarted(),
  identity_pending: notStarted(),
  submitted: notStarted(),
  owner_notified: ownerProtectionInProgress(),
  cooldown: ownerProtectionInProgress(),
  review_pending: independentReviewInProgress(),
  approved: checksRecorded(),
  release_ready: checksRecorded(),
  released: checksRecorded(),
  closed: checksRecorded(),
  on_hold: additionalChecksInProgress(),
  manual_review: additionalChecksInProgress(),
  cancelled_by_owner: statusUnavailable(),
  withdrawn_by_claimant: statusUnavailable(),
  rejected: statusUnavailable(),
  expired: statusUnavailable(),
  release_suspended: statusUnavailable(),
} as const satisfies Record<ClaimantState, SafeTrackingDefinition>;

const claimantStateSet = new Set<string>(claimantStates);

export function projectClaimantPublicReviewTracking(
  internalState: unknown,
): ClaimantPublicReviewTrackingProjectionV1 {
  const definition = isClaimantState(internalState)
    ? trackingByInternalState[internalState]
    : statusUnavailable();

  return {
    protocol: "sanduqkin:claim:review-tracking:v1",
    ...definition,
    release_authorized: false,
  };
}

function isClaimantState(value: unknown): value is ClaimantState {
  return typeof value === "string" && claimantStateSet.has(value);
}

function notStarted(): SafeTrackingDefinition {
  return {
    stage: "not_started",
    title: "Protection and review have not started",
    summary:
      "The case has not reached the protected review stage. Earlier requirements may still be in progress.",
    next_action: "Follow only the next step shown in your secure case view.",
    claimant_action_required: true,
    owner_protection_status: "not_started",
    review_status: "not_started",
  };
}

function ownerProtectionInProgress(): SafeTrackingDefinition {
  return {
    stage: "owner_protection_in_progress",
    title: "Protection checks are in progress",
    summary:
      "Required protection checks are continuing. Private communications and control details are not displayed.",
    next_action: "No action is needed unless a secure case update asks for it.",
    claimant_action_required: false,
    owner_protection_status: "in_progress",
    review_status: "not_started",
  };
}

function independentReviewInProgress(): SafeTrackingDefinition {
  return {
    stage: "independent_review_in_progress",
    title: "Independent review is in progress",
    summary:
      "Required protection checks completed and the controlled review is continuing. Private review details are not displayed.",
    next_action: "Wait for a secure case update.",
    claimant_action_required: false,
    owner_protection_status: "complete",
    review_status: "in_progress",
  };
}

function additionalChecksInProgress(): SafeTrackingDefinition {
  return {
    stage: "additional_checks_in_progress",
    title: "Additional checks are in progress",
    summary:
      "The case is safely paused or needs controlled follow-up. Completed and pending private controls are not identified.",
    next_action: "Open the secure case update and follow only its stated next step.",
    claimant_action_required: true,
    owner_protection_status: "status_unavailable",
    review_status: "status_unavailable",
  };
}

function checksRecorded(): SafeTrackingDefinition {
  return {
    stage: "checks_recorded",
    title: "Required checks are recorded",
    summary:
      "The protection and review stages have recorded outcomes. This status does not disclose the decision or provide vault access.",
    next_action: "Open the secure case update to review the available next step.",
    claimant_action_required: true,
    owner_protection_status: "complete",
    review_status: "complete",
  };
}

function statusUnavailable(): SafeTrackingDefinition {
  return {
    stage: "status_unavailable",
    title: "Detailed tracking is unavailable",
    summary:
      "This case does not expose protection or review progress. Use only the safe outcome shown in the secure case view.",
    next_action: "Open the secure case update for the available next step.",
    claimant_action_required: true,
    owner_protection_status: "status_unavailable",
    review_status: "status_unavailable",
  };
}
