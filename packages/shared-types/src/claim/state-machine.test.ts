import { describe, expect, it } from "vitest";

import type {
  ClaimTransitionPredicatesV1,
  ClaimTransitionRequestV1,
} from "./contracts";
import { evaluateClaimTransition } from "./state-machine";

const allPredicates: ClaimTransitionPredicatesV1 = {
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

function request(
  overrides: Partial<ClaimTransitionRequestV1>,
): ClaimTransitionRequestV1 {
  return {
    protocol: "sanduqkin:claim:state:v1",
    previous_state: null,
    requested_state: "draft",
    actor_role: "claimant",
    assurance_level: "aal2",
    expected_version: 1,
    server_time: "2026-07-28T08:00:00.000Z",
    predicates: { ...allPredicates },
    ...overrides,
  };
}

describe("claim state machine", () => {
  it("allows the complete protected primary path", () => {
    const path = [
      [null, "draft", "claimant"],
      ["draft", "identity_pending", "claimant"],
      ["identity_pending", "submitted", "processor"],
      ["submitted", "owner_notified", "processor"],
      ["owner_notified", "cooldown", "processor"],
      ["cooldown", "review_pending", "timer_processor"],
      ["review_pending", "approved", "processor"],
      ["approved", "release_ready", "processor"],
      ["release_ready", "released", "claimant"],
      ["released", "closed", "processor"],
    ] as const;

    for (const [previous_state, requested_state, actor_role] of path) {
      expect(
        evaluateClaimTransition(
          request({ previous_state, requested_state, actor_role }),
        ).allowed,
      ).toBe(true);
    }
  });

  it.each([
    "route_profile_valid",
    "notice_verified_delivered",
    "cooldown_expired",
    "no_cancellation_or_hold",
    "two_independent_approvals",
    "release_material_current",
    "package_build_enabled",
    "release_retrieval_enabled",
  ] as const)("cannot complete the release path without %s", (predicate) => {
    const predicates = { ...allPredicates, [predicate]: false };
    const path = [
      request({
        previous_state: null,
        requested_state: "draft",
        actor_role: "claimant",
        predicates,
      }),
      request({
        previous_state: "owner_notified",
        requested_state: "cooldown",
        actor_role: "processor",
        predicates,
      }),
      request({
        previous_state: "cooldown",
        requested_state: "review_pending",
        actor_role: "timer_processor",
        predicates,
      }),
      request({
        previous_state: "review_pending",
        requested_state: "approved",
        actor_role: "processor",
        predicates,
      }),
      request({
        previous_state: "approved",
        requested_state: "release_ready",
        actor_role: "processor",
        predicates,
      }),
      request({
        previous_state: "release_ready",
        requested_state: "released",
        actor_role: "claimant",
        predicates,
      }),
    ];

    expect(path.some((transition) => !evaluateClaimTransition(transition).allowed)).toBe(
      true,
    );
  });

  it("never treats owner non-response as approval", () => {
    const result = evaluateClaimTransition(
      request({
        previous_state: "owner_notified",
        requested_state: "review_pending",
        actor_role: "timer_processor",
        predicates: {
          ...allPredicates,
          notice_verified_delivered: false,
        },
      }),
    );
    expect(result).toEqual({
      allowed: false,
      result_class: "transition_forbidden",
      invalidates: [],
    });
  });
});
