import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { claimantStates } from "./constants";
import {
  claimantPublicJourneyStages,
  projectClaimantPublicJourney,
} from "./journey";

describe("claimant public journey projection", () => {
  it("maps every internal state to exactly one approved public stage", () => {
    const projections = claimantStates.map(projectClaimantPublicJourney);

    expect(projections).toHaveLength(claimantStates.length);
    for (const projection of projections) {
      expect(claimantPublicJourneyStages).toContain(projection.stage);
      expect(projection.protocol).toBe(
        "sanduqkin:claim:journey-projection:v1",
      );
      expect(projection.milestones).toHaveLength(
        claimantPublicJourneyStages.length,
      );
      expect(
        projection.milestones.filter(({ status }) => status === "current"),
      ).toHaveLength(1);
    }
  });

  it("does not treat encrypted package delivery as confirmed receipt", () => {
    expect(projectClaimantPublicJourney("released").stage).toBe(
      "secure_retrieval_available",
    );
    expect(projectClaimantPublicJourney("closed").stage).toBe(
      "retrieval_confirmed_closed",
    );
  });

  it("maps holds and owner-protection processing to coarse safe states", () => {
    expect(projectClaimantPublicJourney("on_hold").stage).toBe(
      "action_needed_or_on_hold",
    );
    expect(projectClaimantPublicJourney("owner_notified").stage).toBe(
      "owner_protection_in_progress",
    );
    expect(projectClaimantPublicJourney("cooldown").stage).toBe(
      "owner_protection_in_progress",
    );
  });

  it("excludes private control and case-detail fields", () => {
    const output = JSON.stringify(
      claimantStates.map(projectClaimantPublicJourney),
    );

    for (const forbidden of [
      "reviewer_id",
      "owner_response",
      "fraud_signal",
      "risk_score",
      "internal_note",
      "reason_code",
      "deadline",
      "countdown",
      "evidence_object",
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });

  it("remains a pure runtime-disconnected shared model", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./journey.ts", import.meta.url)),
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
