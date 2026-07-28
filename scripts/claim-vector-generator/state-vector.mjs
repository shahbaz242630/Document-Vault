const states = [
  "draft",
  "identity_pending",
  "submitted",
  "owner_notified",
  "cooldown",
  "review_pending",
  "approved",
  "release_ready",
  "released",
  "closed",
  "cancelled_by_owner",
  "withdrawn_by_claimant",
  "rejected",
  "expired",
  "on_hold",
  "manual_review",
  "release_suspended",
];

const primaryTransitions = new Map([
  ["none->draft", "claimant"],
  ["draft->identity_pending", "claimant"],
  ["identity_pending->submitted", "processor"],
  ["submitted->owner_notified", "processor"],
  ["owner_notified->cooldown", "processor"],
  ["cooldown->review_pending", "timer_processor"],
  ["review_pending->approved", "processor"],
  ["approved->release_ready", "processor"],
  ["release_ready->released", "claimant"],
  ["released->closed", "processor"],
]);

const preReleaseStates = new Set([
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

const terminalStates = new Set([
  "cancelled_by_owner",
  "withdrawn_by_claimant",
  "rejected",
  "expired",
  "closed",
  "release_suspended",
]);

const allTruePredicates = {
  account_active: true,
  approvals_current: true,
  authorization_rechecked: true,
  claimant_binding_valid: true,
  cooldown_expired: true,
  evidence_policy_satisfied: true,
  grant_or_code_current: true,
  hold_disposition_recorded: true,
  hold_reviewable: true,
  intake_enabled: true,
  no_cancellation_or_hold: true,
  notice_enqueued: true,
  notice_verified_delivered: true,
  package_build_enabled: true,
  package_current: true,
  policy_accepted: true,
  policy_deadline_exceeded: true,
  review_result_recorded: true,
  release_material_current: true,
  release_retrieval_enabled: true,
  retention_scheduled: true,
  route_profile_valid: true,
  session_unexpired: true,
  supported_jurisdiction: true,
  two_independent_approvals: true,
};

export function createClaimStateVector({
  meta,
  protocol,
  serverTime,
}) {
  const transitionMatrix = [];
  for (const previous of [null, ...states]) {
    for (const requested of states) {
      const expected = expectedTransition(previous, requested);
      transitionMatrix.push({
        previous_state: previous,
        requested_state: requested,
        actor_role: expected.actor,
        assurance_level: "aal2",
        expected_version: 7,
        server_time: serverTime,
        predicates: allTruePredicates,
        expected_allowed: expected.allowed,
      });
    }
  }

  return {
    meta,
    protocol,
    transition_matrix: transitionMatrix,
    control_denials: [
      {
        name: "draft_requires_aal2",
        previous_state: null,
        requested_state: "draft",
        actor_role: "claimant",
        assurance_level: "aal1",
        predicates: allTruePredicates,
        expected_result_class: "assurance_required",
      },
      {
        name: "release_requires_aal2",
        previous_state: "release_ready",
        requested_state: "released",
        actor_role: "claimant",
        assurance_level: "aal1",
        predicates: allTruePredicates,
        expected_result_class: "assurance_required",
      },
      ...[
        "route_profile_valid",
        "notice_verified_delivered",
        "cooldown_expired",
        "no_cancellation_or_hold",
        "two_independent_approvals",
        "release_material_current",
        "package_build_enabled",
        "release_retrieval_enabled",
      ].map((predicate) => ({
        name: `release_path_requires_${predicate}`,
        predicate,
        expected_result_class: "predicate_failed",
      })),
    ],
  };
}

function expectedTransition(previous, requested) {
  const key = `${previous ?? "none"}->${requested}`;
  if (primaryTransitions.has(key)) {
    return { allowed: true, actor: primaryTransitions.get(key) };
  }
  if (
    previous &&
    preReleaseStates.has(previous) &&
    requested === "cancelled_by_owner"
  ) {
    return { allowed: true, actor: "owner" };
  }
  if (
    previous &&
    preReleaseStates.has(previous) &&
    requested === "withdrawn_by_claimant"
  ) {
    return { allowed: true, actor: "claimant" };
  }
  if (previous && !terminalStates.has(previous) && requested === "on_hold") {
    return previous === "on_hold"
      ? { allowed: false, actor: "claimant" }
      : { allowed: true, actor: "processor" };
  }
  if (previous === "on_hold" && requested === "manual_review") {
    return { allowed: true, actor: "case_lead" };
  }
  if (
    previous === "manual_review" &&
    ["identity_pending", "submitted", "owner_notified", "cooldown", "review_pending"].includes(
      requested,
    )
  ) {
    return { allowed: true, actor: "processor" };
  }
  if (
    ["review_pending", "manual_review"].includes(previous) &&
    requested === "rejected"
  ) {
    return { allowed: true, actor: "reviewer" };
  }
  if (previous && preReleaseStates.has(previous) && requested === "expired") {
    return { allowed: true, actor: "processor" };
  }
  if (
    previous &&
    ["release_ready", "released"].includes(previous) &&
    requested === "release_suspended"
  ) {
    return { allowed: true, actor: "security" };
  }
  return { allowed: false, actor: "claimant" };
}
