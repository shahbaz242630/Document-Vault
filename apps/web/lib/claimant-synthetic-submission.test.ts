import { describe, expect, it } from "vitest";

import { claimantSyntheticSubmissionFixtures } from "./claimant-synthetic-submission";

describe("synthetic claimant submission fixtures", () => {
  it("covers assembled, incomplete, stale, and replay outcomes", () => {
    expect(claimantSyntheticSubmissionFixtures.map(({ key }) => key)).toEqual([
      "assembled",
      "incomplete-evidence",
      "stale-version",
      "replay-rejected",
    ]);
    expect(claimantSyntheticSubmissionFixtures.map(({ result }) => result.status)).toEqual([
      "assembled",
      "rejected",
      "rejected",
      "rejected",
    ]);
  });

  it("assembles one local envelope without runtime or release authority", () => {
    const result = claimantSyntheticSubmissionFixtures[0]!.result;

    expect(result.status).toBe("assembled");
    if (result.status !== "assembled") throw new Error("Expected assembled fixture.");
    expect(result.envelope).toMatchObject({
      runtime_submission_authorized: false,
      release_authorized: false,
      status: "assembled_for_review_submission",
    });
    expect(result.envelope.evidence_manifest).toHaveLength(8);
    expect(result.envelope.declarations).toHaveLength(4);
  });

  it("exposes deterministic fail-closed rejection classes", () => {
    expect(claimantSyntheticSubmissionFixtures[1]!.result.issues).toEqual([
      "evidence_not_ready",
    ]);
    expect(claimantSyntheticSubmissionFixtures[2]!.result.issues).toEqual([
      "stale_case_version",
    ]);
    expect(claimantSyntheticSubmissionFixtures[3]!.result.issues).toEqual([
      "replayed_submission_ref",
      "replayed_idempotency_key",
    ]);
    expect(
      claimantSyntheticSubmissionFixtures.slice(1).every(({ result }) => result.envelope === null),
    ).toBe(true);
  });
});
