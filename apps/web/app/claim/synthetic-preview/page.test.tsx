import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { claimantSyntheticDashboardFixtures } from "@/lib/claimant-synthetic-dashboard";

import SyntheticClaimantDashboardPage, { metadata } from "./page";

const markup = renderToStaticMarkup(<SyntheticClaimantDashboardPage />);

describe("synthetic claimant dashboard preview", () => {
  it("renders four deterministic synthetic outcomes", () => {
    expect(claimantSyntheticDashboardFixtures.map(({ key }) => key)).toEqual([
      "completed",
      "on-hold",
      "rejected",
      "case-ended",
    ]);
    expect(markup).toContain("Case closed");
    expect(markup).toContain("More information needed or on hold");
    expect(markup).toContain("Case outcome recorded");
    expect(markup).not.toContain("Owner cancellation recorded");
    expect(markup).toContain("Synthetic only");
  });

  it("renders only coarse public milestones and safe next actions", () => {
    for (const fixture of claimantSyntheticDashboardFixtures) {
      expect(fixture.synthetic_only).toBe(true);
      expect(markup).toContain(fixture.projection.title);
      expect(markup).toContain(fixture.projection.next_action);
      expect(fixture.projection.milestones).toHaveLength(9);
    }
    expect(markup).not.toMatch(
      /reviewer_id|owner_response|fraud_signal|risk_score|internal_note|reason_code|countdown_seconds|evidence_object|synthetic_actor_|synthetic_case_/iu,
    );
  });

  it("has no intake or operational control", () => {
    expect(markup).not.toMatch(/<(form|input|textarea|select|button)\b/iu);

    const sources = [
      "./page.tsx",
      "../../../components/synthetic-claimant-dashboard-preview.tsx",
      "../../../lib/claimant-synthetic-dashboard.ts",
    ]
      .map((path) =>
        readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"),
      )
      .join("\n");

    for (const forbidden of [
      "@supabase/",
      "createClient(",
      "fetch(",
      "process.env",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "mailto:",
    ]) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it("remains outside search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
