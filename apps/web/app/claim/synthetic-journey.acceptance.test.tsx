import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  applySyntheticClaimScenarioStep,
  applySyntheticSubmissionHandoff,
  createSyntheticSubmissionHandoffInput,
  projectClaimantPublicDecisionReadiness,
  projectClaimantPublicReviewTracking,
  reconcileSyntheticClaimAuditLedger,
  syntheticHandoffPredicates,
  type ClaimantActorRole,
  type ClaimantState,
  type SyntheticClaimAuditEventType,
  type SyntheticClaimScenarioSnapshotV1,
  type SyntheticClaimScenarioStepV1,
} from "@vault/shared-types";
import { claimantPortalCapabilities } from "@/lib/claimant-portal";
import { claimSyntheticReviewRoutes, publicRoutes } from "@/lib/site";

import SyntheticAcknowledgementPage, {
  metadata as acknowledgementMetadata,
} from "./synthetic-acknowledgement/page";
import SyntheticChecklistPage, {
  metadata as checklistMetadata,
} from "./synthetic-checklist/page";
import SyntheticDecisionReadinessPage, {
  metadata as decisionMetadata,
} from "./synthetic-decision-readiness/page";
import SyntheticEvidencePage, {
  metadata as evidenceMetadata,
} from "./synthetic-evidence/page";
import SyntheticDashboardPage, {
  metadata as dashboardMetadata,
} from "./synthetic-preview/page";
import SyntheticReviewTrackingPage, {
  metadata as reviewMetadata,
} from "./synthetic-review-tracking/page";
import SyntheticSubmissionPage, {
  metadata as submissionMetadata,
} from "./synthetic-submission/page";

const syntheticPages = [
  ["dashboard", SyntheticDashboardPage, dashboardMetadata],
  ["checklist", SyntheticChecklistPage, checklistMetadata],
  ["evidence", SyntheticEvidencePage, evidenceMetadata],
  ["submission", SyntheticSubmissionPage, submissionMetadata],
  ["acknowledgement", SyntheticAcknowledgementPage, acknowledgementMetadata],
  ["review tracking", SyntheticReviewTrackingPage, reviewMetadata],
  ["decision readiness", SyntheticDecisionReadinessPage, decisionMetadata],
] as const;

describe("synthetic claimant end-to-end acceptance", () => {
  it("runs the protected synthetic journey from submission through closure", () => {
    const submission = applySyntheticSubmissionHandoff(
      createSyntheticSubmissionHandoffInput(),
    );
    expect(submission.status).toBe("applied");
    if (submission.status !== "applied") throw new Error("Expected synthetic submission.");
    expect(submission.acknowledgement).toMatchObject({
      runtime_effect: false,
      review_started: false,
      release_authorized: false,
      status: "received_for_review",
    });

    let snapshot = submission.snapshot;
    const path = [
      ["owner_notified", "processor", "owner_notice_attempted", "owner_protection_in_progress", "decision_pending"],
      ["cooldown", "processor", "cooldown_started", "owner_protection_in_progress", "decision_pending"],
      ["review_pending", "timer_processor", "review_assigned", "independent_review_in_progress", "decision_pending"],
      ["approved", "processor", "review_approved", "checks_recorded", "retrieval_preparing"],
      ["release_ready", "processor", "package_created", "checks_recorded", "retrieval_available"],
      ["released", "claimant", "encrypted_package_served", "checks_recorded", "retrieval_available"],
      ["closed", "processor", "case_closed", "checks_recorded", "case_closed"],
    ] as const satisfies readonly (readonly [
      ClaimantState,
      ClaimantActorRole,
      SyntheticClaimAuditEventType,
      ReturnType<typeof projectClaimantPublicReviewTracking>["stage"],
      ReturnType<typeof projectClaimantPublicDecisionReadiness>["stage"],
    ])[];

    let availableBeforeDelivery: ReturnType<
      typeof projectClaimantPublicDecisionReadiness
    > | null = null;

    for (const [requested, actor, eventType, reviewStage, decisionStage] of path) {
      const result = applySyntheticClaimScenarioStep(
        snapshot,
        acceptanceStep(snapshot, requested, actor, eventType),
      );
      expect(result.status).toBe("applied");
      if (result.status !== "applied") throw new Error(`Failed at ${requested}.`);
      snapshot = result.snapshot;

      const review = projectClaimantPublicReviewTracking(snapshot.current_state);
      const decision = projectClaimantPublicDecisionReadiness(snapshot.current_state);
      expect(review.stage).toBe(reviewStage);
      expect(review.release_authorized).toBe(false);
      expect(decision.stage).toBe(decisionStage);
      expect(decision).toMatchObject({
        runtime_effect: false,
        release_authorized: false,
        decryption_authorized: false,
      });

      if (requested === "release_ready") availableBeforeDelivery = decision;
      if (requested === "released") expect(decision).toEqual(availableBeforeDelivery);
    }

    expect(snapshot).toMatchObject({ current_state: "closed", version: 10 });
    expect(snapshot.ledger).toHaveLength(10);
    expect(reconcileSyntheticClaimAuditLedger(snapshot.ledger)).toEqual([]);
    expect(snapshot.projection).toMatchObject({
      stage: "case_closed",
      title: "Case closed",
    });
    expect(snapshot.projection?.summary).toContain("does not prove");
  });

  it("keeps stopped outcomes private and exceptional inputs fail closed", () => {
    const blocked = ["cancelled_by_owner", "withdrawn_by_claimant", "rejected"].map(
      projectClaimantPublicDecisionReadiness,
    );
    expect(new Set(blocked.map((value) => JSON.stringify(value)))).toHaveLength(1);
    expect(blocked[0]?.retrieval_status).toBe("blocked");

    for (const value of [null, "unknown-state", {}, 17]) {
      expect(projectClaimantPublicReviewTracking(value).stage).toBe("status_unavailable");
      expect(projectClaimantPublicDecisionReadiness(value)).toMatchObject({
        stage: "status_unavailable",
        runtime_effect: false,
        release_authorized: false,
        decryption_authorized: false,
      });
    }
  });

  it("renders every synthetic surface as accessible, read-only, and non-indexed", () => {
    for (const [name, Page, metadata] of syntheticPages) {
      const markup = renderToStaticMarkup(<Page />);
      expect(markup, name).toContain("Synthetic only");
      expect(markup, name).toContain('id="main-content"');
      expect(markup, name).not.toMatch(/<(form|input|textarea|select|button)\b/iu);
      expect(markup, name).not.toMatch(
        /reviewer_id|owner_response|fraud_signal|risk_score|internal_note|reason_code|countdown_seconds|package_id|session_id|private_key/iu,
      );
      expect(metadata.robots, name).toEqual({ index: false, follow: false });
    }
  });

  it("keeps all claimant runtime capabilities hard-disabled", () => {
    expect(Object.values(claimantPortalCapabilities)).not.toContain(true);
    expect(claimantPortalCapabilities).toMatchObject({
      authentication: false,
      claimIntake: false,
      emergencyCodeEntry: false,
      evidenceUpload: false,
      localClaimantDecryption: false,
      review: false,
      release: false,
    });
  });

  it("keeps every synthetic route in the review-only registry", () => {
    const expectedRoutes = [
      "/claim/synthetic-preview",
      "/claim/synthetic-checklist",
      "/claim/synthetic-evidence",
      "/claim/synthetic-submission",
      "/claim/synthetic-acknowledgement",
      "/claim/synthetic-review-tracking",
      "/claim/synthetic-decision-readiness",
    ];
    for (const route of expectedRoutes) {
      expect(claimSyntheticReviewRoutes.filter((candidate) => candidate === route), route).toHaveLength(1);
      expect(publicRoutes, route).not.toContain(route);
    }
  });
});

function acceptanceStep(
  snapshot: SyntheticClaimScenarioSnapshotV1,
  requestedState: ClaimantState,
  actor: ClaimantActorRole,
  eventType: SyntheticClaimAuditEventType,
): SyntheticClaimScenarioStepV1 {
  const version = snapshot.version + 1;
  const suffix = String(version).padStart(3, "0");
  const serverTime = `2026-08-02T07:${String(version).padStart(2, "0")}:00.000Z`;
  return {
    transition: {
      protocol: "sanduqkin:claim:state:v1",
      previous_state: snapshot.current_state,
      requested_state: requestedState,
      actor_role: actor,
      assurance_level: "aal2",
      expected_version: version,
      server_time: serverTime,
      predicates: syntheticHandoffPredicates,
    },
    audit_event: {
      protocol: "sanduqkin:claim:audit-event:v1",
      synthetic_only: true,
      server_authored: true,
      tenant_id: snapshot.tenant_id,
      case_id: snapshot.case_id,
      event_id: `synthetic_event_acceptance_${suffix}`,
      event_type: eventType,
      actor_class: actor,
      actor_ref: `synthetic_actor_acceptance_${actor}`,
      server_time: serverTime,
      request_id: `synthetic_request_acceptance_${suffix}`,
      correlation_id: "synthetic_correlation_acceptance_001",
      idempotency_key: `synthetic_idempotency_acceptance_${suffix}`,
      source_state: snapshot.current_state,
      target_state: requestedState,
      reason_class: "not_applicable",
      policy_version: "synthetic_policy_v1",
      schema_version: "synthetic_schema_v1",
      build_version: "synthetic_build_v1",
      object_ref: null,
      event_hash: `synthetic_hash_acceptance_${suffix}`,
    },
  };
}
