import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { claimantSyntheticSubmissionFixtures } from "@/lib/claimant-synthetic-submission";

import SyntheticClaimantSubmissionPage, { metadata } from "./page";

const markup = renderToStaticMarkup(<SyntheticClaimantSubmissionPage />);

describe("synthetic claimant submission preview", () => {
  it("renders safe assembly and rejection outcomes", () => {
    expect(markup).toContain("Synthetic submission assembly");
    expect(markup).toContain("Assembled for review submission");
    expect(markup).toContain("Assembly rejected safely");
    expect(markup).toContain("Selected evidence requirements are not ready for review");
    expect(markup).toContain("The case changed after this draft was prepared");
    expect(markup).toContain("This synthetic submission identity was already used");
  });

  it("renders safe labels instead of internal identities or issue codes", () => {
    expect(markup).toContain("Current photo identity document");
    expect(markup).toContain("Review readiness is not release authorization");
    expect(markup).not.toMatch(
      /synthetic_(?:submission|idempotency|case|bundle|evidence)_|evidence_not_ready|stale_case_version|replayed_/u,
    );
  });

  it("keeps assembly separate from runtime submission and release", () => {
    expect(markup.match(/Runtime submission authorized:<\/strong> No/gu)).toHaveLength(
      claimantSyntheticSubmissionFixtures.length,
    );
    expect(markup.match(/Release authorized:<\/strong> No/gu)).toHaveLength(
      claimantSyntheticSubmissionFixtures.length,
    );
    expect(markup).toContain("Assembly is not submission");
  });

  it("has no submit control or runtime integration", () => {
    expect(markup).not.toMatch(/<(form|input|textarea|select|button)\b/iu);

    const sources = [
      "./page.tsx",
      "../../../lib/claimant-synthetic-submission.ts",
      "../../../components/claimant-submission/submission-bindings.tsx",
      "../../../components/claimant-submission/submission-boundary.tsx",
      "../../../components/claimant-submission/submission-declarations.tsx",
      "../../../components/claimant-submission/submission-issues.tsx",
      "../../../components/claimant-submission/submission-manifest.tsx",
      "../../../components/claimant-submission/submission-status.tsx",
      "../../../components/claimant-submission/synthetic-submission-preview.tsx",
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
