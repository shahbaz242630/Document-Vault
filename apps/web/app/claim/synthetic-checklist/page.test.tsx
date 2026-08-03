import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { claimantSyntheticChecklistFixtures } from "@/lib/claimant-synthetic-checklist";

import SyntheticClaimantChecklistPage, { metadata } from "./page";

const markup = renderToStaticMarkup(<SyntheticClaimantChecklistPage />);

describe("synthetic claimant checklist preview", () => {
  it("renders safe status, policy, and document explanations", () => {
    expect(markup).toContain("Synthetic document requirements");
    expect(markup).toContain("Documents needed");
    expect(markup).toContain("Ready for review");
    expect(markup).toContain("Manual review required");
    expect(markup).toContain("No policy selected");
    expect(markup).toContain("Required document unavailable");
    expect(markup).toContain("Policy-selected requirement");
  });

  it("always presents review and release as separate boundaries", () => {
    expect(markup.match(/Release authorized:<\/strong> No/gu)).toHaveLength(
      claimantSyntheticChecklistFixtures.length,
    );
    expect(markup).toContain("only enters review; it never authorizes release");
    expect(markup).not.toMatch(/release authorized:<\/strong> yes/iu);
  });

  it("has no intake or operational control or integration", () => {
    expect(markup).not.toMatch(/<(form|input|textarea|select|button)\b/iu);

    const sources = [
      "./page.tsx",
      "../../../lib/claimant-synthetic-checklist.ts",
      "../../../components/claimant-checklist/checklist-item.tsx",
      "../../../components/claimant-checklist/checklist-status.tsx",
      "../../../components/claimant-checklist/checklist-summary.tsx",
      "../../../components/claimant-checklist/policy-boundary.tsx",
      "../../../components/claimant-checklist/synthetic-checklist-preview.tsx",
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
