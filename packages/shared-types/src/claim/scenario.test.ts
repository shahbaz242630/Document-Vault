import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type {
  SyntheticClaimAuditEventInputV1,
  SyntheticClaimAuditEventType,
} from "./audit";
import type {
  ClaimantActorRole,
  ClaimantState,
  ClaimTransitionPredicatesV1,
  ClaimTransitionRequestV1,
} from "./contracts";
import {
  applySyntheticClaimScenarioStep,
  createSyntheticClaimScenario,
  type SyntheticClaimScenarioSnapshotV1,
  type SyntheticClaimScenarioStepV1,
} from "./scenario";

const predicates: ClaimTransitionPredicatesV1 = {
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

const primaryPath = [
  [null, "draft", "claimant", "route_selected"],
  ["draft", "identity_pending", "claimant", "checklist_selected"],
  ["identity_pending", "submitted", "processor", "upload_received"],
  ["submitted", "owner_notified", "processor", "owner_notice_attempted"],
  ["owner_notified", "cooldown", "processor", "cooldown_started"],
  ["cooldown", "review_pending", "timer_processor", "review_assigned"],
  ["review_pending", "approved", "processor", "review_approved"],
  ["approved", "release_ready", "processor", "package_created"],
  ["release_ready", "released", "claimant", "encrypted_package_served"],
  ["released", "closed", "processor", "case_closed"],
] as const satisfies readonly (readonly [
  ClaimantState | null,
  ClaimantState,
  ClaimantActorRole,
  SyntheticClaimAuditEventType,
])[];

function scenario(): SyntheticClaimScenarioSnapshotV1 {
  return createSyntheticClaimScenario({
    tenant_id: "synthetic_tenant_alpha",
    case_id: "synthetic_case_alpha",
  });
}

function step(input: {
  index: number;
  previous: ClaimantState | null;
  requested: ClaimantState;
  actor: ClaimantActorRole;
  eventType: SyntheticClaimAuditEventType;
  predicateOverrides?: Partial<ClaimTransitionPredicatesV1>;
  assuranceLevel?: "aal1" | "aal2";
}): SyntheticClaimScenarioStepV1 {
  const suffix = String(input.index).padStart(3, "0");
  const serverTime = `2026-08-01T09:${String(input.index).padStart(2, "0")}:00.000Z`;
  const transition: ClaimTransitionRequestV1 = {
    protocol: "sanduqkin:claim:state:v1",
    previous_state: input.previous,
    requested_state: input.requested,
    actor_role: input.actor,
    assurance_level: input.assuranceLevel ?? "aal2",
    expected_version: input.index,
    server_time: serverTime,
    predicates: { ...predicates, ...input.predicateOverrides },
  };
  const auditEvent: SyntheticClaimAuditEventInputV1 = {
    protocol: "sanduqkin:claim:audit-event:v1",
    synthetic_only: true,
    server_authored: true,
    tenant_id: "synthetic_tenant_alpha",
    case_id: "synthetic_case_alpha",
    event_id: `synthetic_event_${suffix}`,
    event_type: input.eventType,
    actor_class: input.actor,
    actor_ref: `synthetic_actor_${input.actor}_001`,
    server_time: serverTime,
    request_id: `synthetic_request_${suffix}`,
    correlation_id: "synthetic_correlation_primary",
    idempotency_key: `synthetic_idempotency_${suffix}`,
    source_state: input.previous,
    target_state: input.requested,
    reason_class: "not_applicable",
    policy_version: "synthetic_policy_v1",
    schema_version: "synthetic_schema_v1",
    build_version: "synthetic_build_v1",
    object_ref: null,
    event_hash: `synthetic_hash_${suffix}`,
  };
  return { transition, audit_event: auditEvent };
}

function runPrimaryPath(steps: number = primaryPath.length) {
  let snapshot = scenario();
  for (const [offset, [previous, requested, actor, eventType]] of primaryPath
    .slice(0, steps)
    .entries()) {
    const result = applySyntheticClaimScenarioStep(
      snapshot,
      step({ index: offset + 1, previous, requested, actor, eventType }),
    );
    expect(result.status).toBe("applied");
    snapshot = result.snapshot;
  }
  return snapshot;
}

describe("synthetic claimant journey scenarios", () => {
  it("runs the complete protected path and closes only after confirmation policy", () => {
    const snapshot = runPrimaryPath();

    expect(snapshot.current_state).toBe("closed");
    expect(snapshot.version).toBe(10);
    expect(snapshot.ledger).toHaveLength(10);
    expect(snapshot.projection?.stage).toBe("retrieval_confirmed_closed");
  });

  it("moves a submitted case to a safe hold without advancing release", () => {
    const submitted = runPrimaryPath(3);
    const result = applySyntheticClaimScenarioStep(
      submitted,
      step({
        index: 4,
        previous: "submitted",
        requested: "on_hold",
        actor: "security",
        eventType: "claim_held",
      }),
    );

    expect(result.status).toBe("applied");
    expect(result.snapshot.current_state).toBe("on_hold");
    expect(result.snapshot.projection?.stage).toBe("action_needed_or_on_hold");
  });

  it("records rejection as a decision without creating retrieval", () => {
    const reviewPending = runPrimaryPath(6);
    const result = applySyntheticClaimScenarioStep(
      reviewPending,
      step({
        index: 7,
        previous: "review_pending",
        requested: "rejected",
        actor: "reviewer",
        eventType: "review_rejected",
      }),
    );

    expect(result.status).toBe("applied");
    expect(result.snapshot.projection?.stage).toBe("decision_recorded");
    expect(result.snapshot.ledger.some(({ event_type }) => event_type === "package_created")).toBe(false);
  });

  it("lets the owner cancel during protection and invalidates downstream work", () => {
    const cooldown = runPrimaryPath(5);
    const result = applySyntheticClaimScenarioStep(
      cooldown,
      step({
        index: 6,
        previous: "cooldown",
        requested: "cancelled_by_owner",
        actor: "owner",
        eventType: "claim_cancelled",
      }),
    );

    expect(result.status).toBe("applied");
    expect(result.invalidates).toEqual([
      "decisions",
      "deadline",
      "package",
      "sessions",
    ]);
    expect(result.snapshot.projection?.stage).toBe("decision_recorded");
  });

  it("denies an unauthorized jump to release without changing state or audit", () => {
    const draft = runPrimaryPath(1);
    const result = applySyntheticClaimScenarioStep(
      draft,
      step({
        index: 2,
        previous: "draft",
        requested: "released",
        actor: "claimant",
        eventType: "encrypted_package_served",
      }),
    );

    expect(result).toMatchObject({
      status: "denied",
      reason: "transition_forbidden",
    });
    expect(result.snapshot).toBe(draft);
    expect(result.snapshot.ledger).toHaveLength(1);
  });

  it("returns an exact retry as a duplicate without advancing twice", () => {
    const initial = scenario();
    const firstStep = step({
      index: 1,
      previous: null,
      requested: "draft",
      actor: "claimant",
      eventType: "route_selected",
    });
    const applied = applySyntheticClaimScenarioStep(initial, firstStep);
    const replay = applySyntheticClaimScenarioStep(applied.snapshot, firstStep);

    expect(replay.status).toBe("duplicate");
    expect(replay.snapshot.version).toBe(1);
    expect(replay.snapshot.ledger).toHaveLength(1);
  });

  it("denies stale versions, mismatched state, and mismatched audit bindings", () => {
    const draft = runPrimaryPath(1);
    const validNext = step({
      index: 2,
      previous: "draft",
      requested: "identity_pending",
      actor: "claimant",
      eventType: "checklist_selected",
    });

    expect(
      applySyntheticClaimScenarioStep(draft, {
        ...validNext,
        transition: { ...validNext.transition, expected_version: 1 },
      }),
    ).toMatchObject({ status: "denied", reason: "version_conflict" });
    expect(
      applySyntheticClaimScenarioStep(draft, {
        ...validNext,
        transition: { ...validNext.transition, previous_state: "submitted" },
      }),
    ).toMatchObject({ status: "denied", reason: "previous_state_mismatch" });
    expect(
      applySyntheticClaimScenarioStep(draft, {
        ...validNext,
        audit_event: { ...validNext.audit_event, case_id: "synthetic_case_other" },
      }),
    ).toMatchObject({ status: "denied", reason: "audit_transition_mismatch" });
  });

  it("remains runtime-disconnected", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./scenario.ts", import.meta.url)),
      "utf8",
    );
    for (const forbidden of [
      "@supabase/",
      "fetch(",
      "process.env",
      "localStorage",
      "sessionStorage",
      "document.cookie",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
