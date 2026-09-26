import { describe, expect, it } from "vitest";

import type { ClaimFlowStatus } from "./claim-flow";
import { claimFlowView } from "./claim-flow-view-model";

const statuses: ClaimFlowStatus[] = ["unavailable", "ready", "checking", "claim_started",
  "sheet_not_recognised", "could_not_start", "closed"];

describe("claim flow view model", () => {
  it("offers the camera only while a claim can be submitted", () => {
    expect(statuses.filter((status) => claimFlowView(status).scanLabel !== null))
      .toEqual(["ready", "sheet_not_recognised"]);
    expect(claimFlowView("ready").scanLabel).toBe("Scan the QR code");
    expect(claimFlowView("sheet_not_recognised").scanLabel).toBe("Scan again");
  });

  it("offers no way to type or paste a sheet", () => {
    for (const status of statuses) expect(Object.keys(claimFlowView(status)).sort())
      .toEqual(["body", "notice", "scanLabel", "title"]);
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
