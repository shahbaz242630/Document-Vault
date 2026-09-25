import { describe, expect, it } from "vitest";

import type { ClaimFlowStatus } from "./claim-flow";
import { claimFlowView } from "./claim-flow-view-model";

const statuses: ClaimFlowStatus[] = ["unavailable", "ready", "checking", "claim_started",
  "sheet_not_recognised", "could_not_start", "closed"];

describe("claim flow view model", () => {
  it("offers sheet entry only while a claim can be submitted", () => {
    expect(statuses.filter((status) => claimFlowView(status).showSheetField))
      .toEqual(["ready", "sheet_not_recognised"]);
    expect(statuses.filter((status) => claimFlowView(status).submitLabel !== null))
      .toEqual(["ready", "sheet_not_recognised"]);
  });

  it("shows the unavailable message in the normal app state", () => {
    expect(claimFlowView("unavailable").body).toBe("Claiming with an emergency sheet isn't available yet.");
  });

  it("never implies release or shares failure detail", () => {
    for (const status of statuses) {
      const text = JSON.stringify(claimFlowView(status)).toLowerCase();
      expect(text).not.toMatch(/released to you|access granted|decrypt|error code|stack/u);
    }
    expect(claimFlowView("claim_started").notice?.message).toContain("Nothing has been released");
  });
});
