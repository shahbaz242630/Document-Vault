import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { claimantSyntheticEvidenceFixtures } from "@/lib/claimant-synthetic-evidence";

import SyntheticClaimantEvidencePage, { metadata } from "./page";

const markup = renderToStaticMarkup(<SyntheticClaimantEvidencePage />);

describe("synthetic claimant evidence preview", () => {
  it("renders safe preparation outcomes and summaries", () => {
    expect(markup).toContain("Synthetic evidence preparation");
    expect(markup).toContain("More evidence needed");
    expect(markup).toContain("Ready for controlled review");
    expect(markup).toContain("Manual review required");
    expect(markup).toContain("A placeholder label was rejected");
    expect(markup).toContain("A selected requirement was declared unavailable");
  });

  it("does not expose internal codes or synthetic references", () => {
    expect(markup).not.toMatch(
      /invalid_display_label|document_unavailable|synthetic_evidence_|synthetic_bundle_/u,
    );
  });

  it("keeps preparation separate from approval and release", () => {
    expect(markup.match(/Release authorized:<\/strong> No/gu)).toHaveLength(
      claimantSyntheticEvidenceFixtures.length,
    );
    expect(markup).toContain("Preparation is not approval");
    expect(markup).not.toMatch(/Release authorized:<\/strong> Yes/iu);
  });

  it("has no intake control or runtime integration", () => {
    expect(markup).not.toMatch(/<(form|input|textarea|select|button)\b/iu);

    const sources = [
      "./page.tsx",
      "../../../lib/claimant-synthetic-evidence.ts",
      "../../../components/claimant-evidence/evidence-boundary.tsx",
      "../../../components/claimant-evidence/evidence-issues.tsx",
      "../../../components/claimant-evidence/evidence-item.tsx",
      "../../../components/claimant-evidence/evidence-status.tsx",
      "../../../components/claimant-evidence/evidence-summary.tsx",
      "../../../components/claimant-evidence/synthetic-evidence-preview.tsx",
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
