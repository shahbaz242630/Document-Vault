import type {
  ClaimantActorRole,
  ClaimantState,
  ClaimTransitionPredicatesV1,
  ClaimTransitionRequestV1,
  ClaimTransitionResultV1,
} from "./contracts";

type TransitionRule = {
  actors: readonly ClaimantActorRole[];
  requiresAal2?: boolean;
  predicates: readonly (keyof ClaimTransitionPredicatesV1)[];
  invalidates?: readonly string[];
};

const transitionRules = {
  "none->draft": {
    actors: ["claimant"],
    requiresAal2: true,
    predicates: [
      "account_active",
      "claimant_binding_valid",
      "intake_enabled",
      "policy_accepted",
      "route_profile_valid",
      "supported_jurisdiction",
    ],
  },
  "draft->identity_pending": {
    actors: ["claimant"],
    requiresAal2: true,
    predicates: ["claimant_binding_valid", "intake_enabled"],
  },
  "identity_pending->submitted": {
    actors: ["processor"],
    predicates: [
      "evidence_policy_satisfied",
      "grant_or_code_current",
      "route_profile_valid",
    ],
    invalidates: ["incomplete_attempts"],
  },
  "submitted->owner_notified": {
    actors: ["processor"],
    predicates: ["notice_enqueued"],
  },
  "owner_notified->cooldown": {
    actors: ["processor"],
    predicates: ["notice_verified_delivered"],
  },
  "cooldown->review_pending": {
    actors: ["timer_processor"],
    predicates: [
      "cooldown_expired",
      "grant_or_code_current",
      "no_cancellation_or_hold",
    ],
  },
  "review_pending->approved": {
    actors: ["processor"],
    predicates: [
      "approvals_current",
      "authorization_rechecked",
      "no_cancellation_or_hold",
      "two_independent_approvals",
    ],
  },
  "approved->release_ready": {
    actors: ["processor"],
    predicates: [
      "authorization_rechecked",
      "no_cancellation_or_hold",
      "package_build_enabled",
      "release_material_current",
      "route_profile_valid",
    ],
    invalidates: ["superseded_package_attempts"],
  },
  "release_ready->released": {
    actors: ["claimant"],
    requiresAal2: true,
    predicates: [
      "account_active",
      "authorization_rechecked",
      "claimant_binding_valid",
      "no_cancellation_or_hold",
      "package_current",
      "release_retrieval_enabled",
      "session_unexpired",
    ],
    invalidates: ["unused_retrieval_tokens"],
  },
  "released->closed": {
    actors: ["processor"],
    predicates: ["retention_scheduled"],
    invalidates: ["active_retrieval_sessions"],
  },
} as const satisfies Record<string, TransitionRule>;

const preReleaseStates = new Set<ClaimantState>([
  "draft",
  "identity_pending",
  "submitted",
  "owner_notified",
  "cooldown",
  "review_pending",
  "approved",
  "release_ready",
  "on_hold",
  "manual_review",
]);

const manualReviewReturnStates = new Set<ClaimantState>([
  "identity_pending",
  "submitted",
  "owner_notified",
  "cooldown",
  "review_pending",
]);

export function evaluateClaimTransition(
  request: ClaimTransitionRequestV1,
): ClaimTransitionResultV1 {
  const special = evaluateSpecialTransition(request);
  if (special) {
    return special;
  }

  const key = `${request.previous_state ?? "none"}->${request.requested_state}`;
  const rule = (transitionRules as Record<string, TransitionRule>)[key];
  if (!rule) {
    return denied("transition_forbidden");
  }

  if (!rule.actors.includes(request.actor_role)) {
    return denied("actor_forbidden");
  }

  if (rule.requiresAal2 && request.assurance_level !== "aal2") {
    return denied("assurance_required");
  }

  if (rule.predicates.some((predicate) => !request.predicates[predicate])) {
    return denied("predicate_failed");
  }

  return {
    allowed: true,
    result_class: "allowed",
    invalidates: [...(rule.invalidates ?? [])],
  };
}

function evaluateSpecialTransition(
  request: ClaimTransitionRequestV1,
): ClaimTransitionResultV1 | null {
  const previous = request.previous_state;
  if (!previous) {
    return null;
  }

  return (
    evaluateCancellation(request, previous) ??
    evaluateWithdrawal(request, previous) ??
    evaluateHold(request, previous) ??
    evaluateManualReview(request, previous) ??
    evaluateRejection(request, previous) ??
    evaluateExpiry(request, previous) ??
    evaluateSuspension(request, previous)
  );
}

function evaluateCancellation(
  request: ClaimTransitionRequestV1,
  previous: ClaimantState,
): ClaimTransitionResultV1 | null {
  if (
    request.requested_state === "cancelled_by_owner" &&
    preReleaseStates.has(previous)
  ) {
    if (request.actor_role !== "owner") {
      return denied("actor_forbidden");
    }
    if (request.assurance_level !== "aal2") {
      return denied("assurance_required");
    }
    if (!request.predicates.authorization_rechecked) {
      return denied("predicate_failed");
    }
    return allowed(["decisions", "deadline", "package", "sessions"]);
  }
  return null;
}

function evaluateWithdrawal(
  request: ClaimTransitionRequestV1,
  previous: ClaimantState,
): ClaimTransitionResultV1 | null {
  if (
    request.requested_state === "withdrawn_by_claimant" &&
    preReleaseStates.has(previous)
  ) {
    if (request.actor_role !== "claimant") {
      return denied("actor_forbidden");
    }
    if (request.assurance_level !== "aal2") {
      return denied("assurance_required");
    }
    if (!request.predicates.claimant_binding_valid) {
      return denied("predicate_failed");
    }
    return allowed(["decisions", "deadline", "package", "sessions"]);
  }
  return null;
}

function evaluateHold(
  request: ClaimTransitionRequestV1,
  previous: ClaimantState,
): ClaimTransitionResultV1 | null {
  if (
    request.requested_state === "on_hold" &&
    previous !== "on_hold" &&
    !isTerminalState(previous)
  ) {
    if (
      !["processor", "reviewer", "security"].includes(request.actor_role)
    ) {
      return denied("actor_forbidden");
    }
    if (
      ["reviewer", "security"].includes(request.actor_role) &&
      request.assurance_level !== "aal2"
    ) {
      return denied("assurance_required");
    }
    return allowed(["deadlines", "sessions"]);
  }
  return null;
}

function evaluateManualReview(
  request: ClaimTransitionRequestV1,
  previous: ClaimantState,
): ClaimTransitionResultV1 | null {
  if (
    previous === "on_hold" &&
    request.requested_state === "manual_review"
  ) {
    if (request.actor_role !== "case_lead") {
      return denied("actor_forbidden");
    }
    if (request.assurance_level !== "aal2") {
      return denied("assurance_required");
    }
    if (!request.predicates.hold_reviewable) {
      return denied("predicate_failed");
    }
    return allowed([]);
  }

  if (
    previous === "manual_review" &&
    manualReviewReturnStates.has(request.requested_state)
  ) {
    if (request.actor_role !== "processor") {
      return denied("actor_forbidden");
    }
    if (!request.predicates.hold_disposition_recorded) {
      return denied("predicate_failed");
    }
    return allowed(["stale_decisions", "stale_deadlines"]);
  }
  return null;
}

function evaluateRejection(
  request: ClaimTransitionRequestV1,
  previous: ClaimantState,
): ClaimTransitionResultV1 | null {
  if (
    ["review_pending", "manual_review"].includes(previous) &&
    request.requested_state === "rejected"
  ) {
    if (request.actor_role !== "reviewer") {
      return denied("actor_forbidden");
    }
    if (request.assurance_level !== "aal2") {
      return denied("assurance_required");
    }
    if (!request.predicates.review_result_recorded) {
      return denied("predicate_failed");
    }
    return allowed(["packages", "sessions"]);
  }
  return null;
}

function evaluateExpiry(
  request: ClaimTransitionRequestV1,
  previous: ClaimantState,
): ClaimTransitionResultV1 | null {
  if (
    preReleaseStates.has(previous) &&
    request.requested_state === "expired"
  ) {
    if (request.actor_role !== "processor") {
      return denied("actor_forbidden");
    }
    if (!request.predicates.policy_deadline_exceeded) {
      return denied("predicate_failed");
    }
    return allowed(["decisions", "packages", "sessions"]);
  }
  return null;
}

function evaluateSuspension(
  request: ClaimTransitionRequestV1,
  previous: ClaimantState,
): ClaimTransitionResultV1 | null {
  if (
    request.requested_state === "release_suspended" &&
    ["release_ready", "released"].includes(previous)
  ) {
    if (!["processor", "security"].includes(request.actor_role)) {
      return denied("actor_forbidden");
    }
    if (
      request.actor_role === "security" &&
      request.assurance_level !== "aal2"
    ) {
      return denied("assurance_required");
    }
    return allowed(["future_retrieval_sessions"]);
  }
  return null;
}

function isTerminalState(state: ClaimantState): boolean {
  return [
    "cancelled_by_owner",
    "withdrawn_by_claimant",
    "rejected",
    "expired",
    "closed",
    "release_suspended",
  ].includes(state);
}

function allowed(invalidates: string[]): ClaimTransitionResultV1 {
  return { allowed: true, result_class: "allowed", invalidates };
}

function denied(
  result_class:
    | "actor_forbidden"
    | "assurance_required"
    | "predicate_failed"
    | "transition_forbidden",
): ClaimTransitionResultV1 {
  return { allowed: false, result_class, invalidates: [] };
}
