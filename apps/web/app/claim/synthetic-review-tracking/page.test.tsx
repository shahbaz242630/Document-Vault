import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { claimantSyntheticReviewTrackingViews } from "@/lib/claimant-synthetic-review-tracking";

import SyntheticClaimantReviewTrackingPage, { metadata } from "./page";

const markup = renderToStaticMarkup(<SyntheticClaimantReviewTrackingPage />);

describe("synthetic claimant review-tracking preview", () => {
  it("renders every safe public progress example", () => {
    expect(markup).toContain("Safe synthetic protection and review tracking");
    expect(markup).toContain("Protection checks are in progress");
    expect(markup).toContain("Independent review is in progress");
    expect(markup).toContain("Additional checks are in progress");
    expect(markup).toContain("Required checks are recorded");
    expect(markup).toContain("Detailed tracking is unavailable");
    expect(markup.match(/Synthetic tracking example/gu)).toHaveLength(
      claimantSyntheticReviewTrackingViews.length,
    );
  });

  it("renders accessible labelled sections and plain-language control states", () => {
    for (const view of claimantSyntheticReviewTrackingViews) {
      expect(markup).toContain(`aria-labelledby="review-tracking-${view.key}"`);
      expect(markup).toContain(`id="review-tracking-${view.key}"`);
    }
    expect(markup).toContain("Owner-protection checks</dt>");
    expect(markup).toContain("Independent review</dt>");
    expect(markup).toContain("Not displayed</dd>");
  });

  it("does not reveal fixture identities, raw states, or sensitive details", () => {
    expect(markup).not.toMatch(
      /stopped-outcome|invalid-input|owner_notified|cancelled_by_owner|review_pending|manual_review|reviewer_id|reviewer_count|owner_response|owner_contacted|fraud_signal|risk_score|internal_note|reason_code|deadline|countdown|evidence_object|two_independent_approvals/iu,
    );
  });

  it("never presents tracking as a decision or release authority", () => {
    expect(markup.match(/Decision displayed<\/dt><dd>No/gu)).toHaveLength(
      claimantSyntheticReviewTrackingViews.length,
    );
    expect(markup.match(/Release authorized<\/dt><dd>No/gu)).toHaveLength(
      claimantSyntheticReviewTrackingViews.length,
    );
    expect(markup).toContain("Progress does not reveal control details");
  });

  it("has no controls or runtime integration", () => {
    expect(markup).not.toMatch(/<(form|input|textarea|select|button)\b/iu);

    const sources = [
      "./page.tsx",
      "../../../lib/claimant-synthetic-review-tracking.ts",
      "../../../components/claimant-review-tracking/review-control-status.tsx",
      "../../../components/claimant-review-tracking/review-tracking-boundary.tsx",
      "../../../components/claimant-review-tracking/synthetic-review-tracking-preview.tsx",
    ]
      .map((path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"))
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
      expect(sources, forbidden).not.toContain(forbidden);
    }
  });

  it("remains outside search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
