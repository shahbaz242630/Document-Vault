import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { claimantSyntheticDecisionReadinessViews } from "@/lib/claimant-synthetic-decision-readiness";

import SyntheticClaimantDecisionReadinessPage, { metadata } from "./page";

const markup = renderToStaticMarkup(<SyntheticClaimantDecisionReadinessPage />);

describe("synthetic claimant decision and retrieval preview", () => {
  it("renders pending, available, blocked, expired, suspended, closed, and unavailable states", () => {
    expect(markup).toContain("Safe synthetic decision and retrieval states");
    expect(markup).toContain("A decision is not available yet");
    expect(markup).toContain("Secure retrieval is available");
    expect(markup).toContain("Secure retrieval is not available");
    expect(markup).toContain("The retrieval window is no longer available");
    expect(markup).toContain("Secure retrieval is suspended");
    expect(markup).toContain("The case is closed");
    expect(markup).toContain("Decision and retrieval status are unavailable");
    expect(markup.match(/Synthetic status example/gu)).toHaveLength(
      claimantSyntheticDecisionReadinessViews.length,
    );
  });

  it("renders accessible labelled sections and plain-language statuses", () => {
    for (const view of claimantSyntheticDecisionReadinessViews) {
      expect(markup).toContain(`aria-labelledby="decision-readiness-${view.key}"`);
      expect(markup).toContain(`id="decision-readiness-${view.key}"`);
    }
    expect(markup).toContain("Decision status</dt>");
    expect(markup).toContain("Secure retrieval</dt>");
    expect(markup).toContain("Available in approved native client</dd>");
  });

  it("does not reveal fixture identities, raw states, or private reasons", () => {
    expect(markup).not.toMatch(
      /available-before-delivery|available-after-delivery|blocked-one|blocked-two|invalid-input|release_ready|cancelled_by_owner|reviewer_id|owner_response|fraud_signal|risk_score|internal_note|reason_code|deadline|countdown|package_id|session_id|private_key/iu,
    );
  });

  it("shows status without performing or authorizing sensitive actions", () => {
    const count = claimantSyntheticDecisionReadinessViews.length;
    expect(markup.match(/Runtime action performed<\/dt><dd>No/gu)).toHaveLength(count);
    expect(markup.match(/Release authorized<\/dt><dd>No/gu)).toHaveLength(count);
    expect(markup.match(/Decryption authorized<\/dt><dd>No/gu)).toHaveLength(count);
    expect(markup).toContain("Status is not capability");
  });

  it("has no controls, downloads, or runtime integration", () => {
    expect(markup).not.toMatch(/<(form|input|textarea|select|button)\b/iu);
    expect(markup).not.toMatch(/<a\b[^>]*\bdownload\b|blob:|data:application|target="_blank"/iu);

    const sources = [
      "./page.tsx",
      "../../../lib/claimant-synthetic-decision-readiness.ts",
      "../../../components/claimant-decision-readiness/decision-readiness-boundary.tsx",
      "../../../components/claimant-decision-readiness/decision-readiness-status.tsx",
      "../../../components/claimant-decision-readiness/synthetic-decision-readiness-preview.tsx",
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
      "crypto.subtle",
      "libsodium",
      "mailto:",
    ]) {
      expect(sources, forbidden).not.toContain(forbidden);
    }
  });

  it("remains outside search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
