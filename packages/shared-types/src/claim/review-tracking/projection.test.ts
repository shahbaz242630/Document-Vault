import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { claimantStates } from "../constants";
import { syntheticClaimantReviewTrackingFixtures } from "./fixtures";
import { projectClaimantPublicReviewTracking } from "./projection";

describe("claimant public owner-protection and review tracking", () => {
  it("maps every claimant state to one safe projection with no release authority", () => {
    for (const state of claimantStates) {
      expect(projectClaimantPublicReviewTracking(state)).toMatchObject({
        protocol: "sanduqkin:claim:review-tracking:v1",
        release_authorized: false,
      });
    }
  });

  it("tracks only coarse protection and review progress", () => {
    expect(projectClaimantPublicReviewTracking("cooldown")).toMatchObject({
      stage: "owner_protection_in_progress",
      owner_protection_status: "in_progress",
      review_status: "not_started",
    });
    expect(projectClaimantPublicReviewTracking("review_pending")).toMatchObject({
      stage: "independent_review_in_progress",
      owner_protection_status: "complete",
      review_status: "in_progress",
    });
    expect(projectClaimantPublicReviewTracking("approved")).toMatchObject({
      stage: "checks_recorded",
      owner_protection_status: "complete",
      review_status: "complete",
      release_authorized: false,
    });
  });

  it("collapses holds and every stopped outcome without exposing their cause", () => {
    expect(projectClaimantPublicReviewTracking("on_hold")).toEqual(
      projectClaimantPublicReviewTracking("manual_review"),
    );

    const stoppedStates = [
      "cancelled_by_owner",
      "withdrawn_by_claimant",
      "rejected",
      "expired",
      "release_suspended",
    ] as const;
    const stopped = stoppedStates.map(projectClaimantPublicReviewTracking);
    expect(stopped.every((projection) => projection.stage === "status_unavailable")).toBe(true);
    expect(new Set(stopped.map((projection) => JSON.stringify(projection)))).toHaveLength(1);
  });

  it("fails closed for null, malformed, and unknown inputs", () => {
    for (const input of [null, undefined, 7, {}, "not-a-claimant-state"]) {
      expect(projectClaimantPublicReviewTracking(input)).toMatchObject({
        stage: "status_unavailable",
        owner_protection_status: "status_unavailable",
        review_status: "status_unavailable",
        release_authorized: false,
      });
    }
  });

  it("keeps fixtures synthetic and excludes sensitive or internal details", () => {
    expect(syntheticClaimantReviewTrackingFixtures.every(({ synthetic_only }) => synthetic_only)).toBe(true);
    const output = JSON.stringify(syntheticClaimantReviewTrackingFixtures);
    for (const forbidden of [
      "reviewer_id",
      "reviewer_count",
      "owner_response",
      "owner_contacted",
      "cancelled_by_owner",
      "fraud_signal",
      "risk_score",
      "internal_note",
      "reason_code",
      "deadline",
      "countdown",
      "evidence_object",
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
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
