import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { claimantStates } from "../constants";
import { syntheticClaimantDecisionReadinessFixtures } from "./fixtures";
import { projectClaimantPublicDecisionReadiness } from "./projection";

describe("claimant public decision and retrieval readiness", () => {
  it("maps every claimant state without runtime, release, or decryption authority", () => {
    for (const state of claimantStates) {
      expect(projectClaimantPublicDecisionReadiness(state)).toMatchObject({
        protocol: "sanduqkin:claim:decision-readiness:v1",
        runtime_effect: false,
        release_authorized: false,
        decryption_authorized: false,
      });
    }
  });

  it("models pending, preparing, and available states without creating capability", () => {
    expect(projectClaimantPublicDecisionReadiness("review_pending")).toMatchObject({
      stage: "decision_pending",
      decision_status: "pending",
      retrieval_status: "not_ready",
    });
    expect(projectClaimantPublicDecisionReadiness("approved")).toMatchObject({
      stage: "retrieval_preparing",
      decision_status: "recorded",
      retrieval_status: "preparing",
    });
    expect(projectClaimantPublicDecisionReadiness("release_ready")).toMatchObject({
      stage: "retrieval_available",
      decision_status: "recorded",
      retrieval_status: "available",
      runtime_effect: false,
      decryption_authorized: false,
    });
  });

  it("does not treat encrypted delivery as proof of local open or receipt", () => {
    expect(projectClaimantPublicDecisionReadiness("release_ready")).toEqual(
      projectClaimantPublicDecisionReadiness("released"),
    );
    const closed = projectClaimantPublicDecisionReadiness("closed");
    expect(closed.stage).toBe("case_closed");
    expect(closed.summary).toContain("does not claim");
  });

  it("collapses blocked outcomes while keeping expiry and suspension truthful", () => {
    const blockedStates = [
      "cancelled_by_owner",
      "withdrawn_by_claimant",
      "rejected",
    ] as const;
    const blocked = blockedStates.map(projectClaimantPublicDecisionReadiness);
    expect(blocked.every(({ stage }) => stage === "retrieval_blocked")).toBe(true);
    expect(new Set(blocked.map((projection) => JSON.stringify(projection)))).toHaveLength(1);

    expect(projectClaimantPublicDecisionReadiness("expired").retrieval_status).toBe("expired");
    expect(projectClaimantPublicDecisionReadiness("release_suspended").retrieval_status).toBe(
      "suspended",
    );
  });

  it("fails closed for null, malformed, and unknown inputs", () => {
    for (const input of [null, undefined, 7, {}, "not-a-claimant-state"]) {
      expect(projectClaimantPublicDecisionReadiness(input)).toMatchObject({
        stage: "status_unavailable",
        decision_status: "not_displayed",
        retrieval_status: "status_unavailable",
        runtime_effect: false,
        release_authorized: false,
        decryption_authorized: false,
      });
    }
  });

  it("keeps fixtures synthetic and excludes sensitive or operational details", () => {
    expect(syntheticClaimantDecisionReadinessFixtures.every(({ synthetic_only }) => synthetic_only)).toBe(true);
    const output = JSON.stringify(syntheticClaimantDecisionReadinessFixtures);
    for (const forbidden of [
      "reviewer_id",
      "owner_response",
      "cancelled_by_owner",
      "fraud_signal",
      "risk_score",
      "internal_note",
      "reason_code",
      "deadline",
      "countdown",
      "package_id",
      "session_id",
      "ciphertext",
      "private_key",
      "two_independent_approvals",
      "authorization_rechecked",
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });

  it("remains a pure runtime-disconnected model", () => {
    const source = ["./contracts.ts", "./projection.ts", "./fixtures.ts"]
      .map((path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"))
      .join("\n");

    for (const forbidden of [
      "@supabase/",
      "fetch(",
      "process.env",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "crypto.subtle",
      "libsodium",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
