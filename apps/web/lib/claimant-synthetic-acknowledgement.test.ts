import { describe, expect, it } from "vitest";

import { claimantSyntheticAcknowledgementFixtures } from "./claimant-synthetic-acknowledgement";

describe("synthetic claimant acknowledgement projection", () => {
  it("projects new and idempotent receipt outcomes", () => {
    expect(claimantSyntheticAcknowledgementFixtures.map(({ key }) => key)).toEqual([
      "received",
      "already-received",
    ]);
    for (const fixture of claimantSyntheticAcknowledgementFixtures) {
      expect(fixture).toMatchObject({
        receiptConfirmed: true,
        reviewStarted: false,
        releaseAuthorized: false,
      });
    }
  });

  it("contains only explicitly allowlisted public presentation fields", () => {
    for (const fixture of claimantSyntheticAcknowledgementFixtures) {
      expect(Object.keys(fixture).sort()).toEqual([
        "claimantActionRequired",
        "eyebrow",
        "key",
        "nextAction",
        "receiptConfirmed",
        "releaseAuthorized",
        "reviewStarted",
        "summary",
        "title",
      ]);
    }
  });

  it("does not expose protocol identities, versions, or internal state", () => {
    expect(JSON.stringify(claimantSyntheticAcknowledgementFixtures)).not.toMatch(
      /synthetic_|acknowledgement_ref|case_version|protocol|tenant|reviewer|owner_response|fraud|internal|reason_code/iu,
    );
  });
});
