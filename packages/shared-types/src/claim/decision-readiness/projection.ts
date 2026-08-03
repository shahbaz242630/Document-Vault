import { claimantStates } from "../constants";
import type { ClaimantState } from "../contracts";
import type { ClaimantPublicDecisionReadinessProjectionV1 } from "./contracts";

type SafeDecisionReadinessDefinition = Omit<
  ClaimantPublicDecisionReadinessProjectionV1,
  "protocol" | "runtime_effect" | "release_authorized" | "decryption_authorized"
>;

const decisionReadinessByInternalState = {
  draft: decisionPending(),
  identity_pending: decisionPending(),
  submitted: decisionPending(),
  owner_notified: decisionPending(),
  cooldown: decisionPending(),
  review_pending: decisionPending(),
  on_hold: decisionPending(),
  manual_review: decisionPending(),
  approved: retrievalPreparing(),
  release_ready: retrievalAvailable(),
  released: retrievalAvailable(),
  closed: caseClosed(),
  cancelled_by_owner: retrievalBlocked(),
  withdrawn_by_claimant: retrievalBlocked(),
  rejected: retrievalBlocked(),
  expired: retrievalExpired(),
  release_suspended: retrievalSuspended(),
} as const satisfies Record<ClaimantState, SafeDecisionReadinessDefinition>;

const claimantStateSet = new Set<string>(claimantStates);

export function projectClaimantPublicDecisionReadiness(
  internalState: unknown,
): ClaimantPublicDecisionReadinessProjectionV1 {
  const definition = isClaimantState(internalState)
    ? decisionReadinessByInternalState[internalState]
    : statusUnavailable();

  return {
    protocol: "sanduqkin:claim:decision-readiness:v1",
    ...definition,
    runtime_effect: false,
    release_authorized: false,
    decryption_authorized: false,
  };
}

function isClaimantState(value: unknown): value is ClaimantState {
  return typeof value === "string" && claimantStateSet.has(value);
}

function decisionPending(): SafeDecisionReadinessDefinition {
  return {
    stage: "decision_pending",
    title: "A decision is not available yet",
    summary:
      "Required checks are still pending or safely paused. No retrieval path is available from this status.",
    next_action: "Follow only the next step shown in your secure case view.",
    claimant_action_required: true,
    decision_status: "pending",
    retrieval_status: "not_ready",
  };
}

function retrievalPreparing(): SafeDecisionReadinessDefinition {
  return {
    stage: "retrieval_preparing",
    title: "A decision is recorded; retrieval is not ready",
    summary:
      "The controlled decision stage is complete, but secure retrieval is not currently available.",
    next_action: "Wait for a secure case update before attempting retrieval.",
    claimant_action_required: false,
    decision_status: "recorded",
    retrieval_status: "preparing",
  };
}

function retrievalAvailable(): SafeDecisionReadinessDefinition {
  return {
    stage: "retrieval_available",
    title: "Secure retrieval is available",
    summary:
      "The approved native retrieval path may be started with fresh authentication. Availability does not prove local open, export, reading, or retention.",
    next_action: "Use only the approved native client and its secure retrieval instructions.",
    claimant_action_required: true,
    decision_status: "recorded",
    retrieval_status: "available",
  };
}

function retrievalBlocked(): SafeDecisionReadinessDefinition {
  return {
    stage: "retrieval_blocked",
    title: "Secure retrieval is not available",
    summary:
      "The recorded outcome does not provide a retrieval path. Private decision and control details are not displayed here.",
    next_action: "Open the secure case update for the available next step.",
    claimant_action_required: true,
    decision_status: "recorded",
    retrieval_status: "blocked",
  };
}

function retrievalExpired(): SafeDecisionReadinessDefinition {
  return {
    stage: "retrieval_expired",
    title: "The retrieval window is no longer available",
    summary:
      "Secure retrieval cannot continue from this status. No package or session is available through this projection.",
    next_action: "Open the secure case update for the available next step.",
    claimant_action_required: true,
    decision_status: "recorded",
    retrieval_status: "expired",
  };
}

function retrievalSuspended(): SafeDecisionReadinessDefinition {
  return {
    stage: "retrieval_suspended",
    title: "Secure retrieval is suspended",
    summary:
      "New retrieval cannot continue while this protection is active. Information previously opened on a claimant device cannot be recalled.",
    next_action: "Use the secure case update for further guidance.",
    claimant_action_required: true,
    decision_status: "recorded",
    retrieval_status: "suspended",
  };
}

function caseClosed(): SafeDecisionReadinessDefinition {
  return {
    stage: "case_closed",
    title: "The case is closed",
    summary:
      "No further retrieval is available from this case status. Closure does not claim that a person read, exported, or retained plaintext.",
    next_action: "No further action is currently required.",
    claimant_action_required: false,
    decision_status: "recorded",
    retrieval_status: "closed",
  };
}

function statusUnavailable(): SafeDecisionReadinessDefinition {
  return {
    stage: "status_unavailable",
    title: "Decision and retrieval status are unavailable",
    summary:
      "This input does not provide a trusted public status. No decision or retrieval capability should be inferred.",
    next_action: "Use only the status shown in your secure case view.",
    claimant_action_required: true,
    decision_status: "not_displayed",
    retrieval_status: "status_unavailable",
  };
}
