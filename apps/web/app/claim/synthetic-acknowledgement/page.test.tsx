import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { claimantSyntheticAcknowledgementFixtures } from "@/lib/claimant-synthetic-acknowledgement";

import SyntheticClaimantAcknowledgementPage, { metadata } from "./page";

const markup = renderToStaticMarkup(<SyntheticClaimantAcknowledgementPage />);

describe("synthetic claimant acknowledgement preview", () => {
  it("renders safe new and already-received outcomes", () => {
    expect(markup).toContain("Safe synthetic receipt acknowledgement");
    expect(markup).toContain("Your information was received safely");
    expect(markup).toContain("Your information was already received");
    expect(markup.match(/Receipt confirmed<\/dt><dd>Yes/gu)).toHaveLength(
      claimantSyntheticAcknowledgementFixtures.length,
    );
  });

  it("does not expose receipt identities, versions, or internal details", () => {
    expect(markup).not.toMatch(
      /synthetic_(?:acknowledgement|submission|case|actor|event|request|correlation)_|case_version|reason_code|reviewer_id|owner_response|fraud_signal|risk_score|internal_note/iu,
    );
  });

  it("separates receipt from review and release", () => {
    expect(markup.match(/Review started<\/dt><dd>No/gu)).toHaveLength(
      claimantSyntheticAcknowledgementFixtures.length,
    );
    expect(markup.match(/Release authorized<\/dt><dd>No/gu)).toHaveLength(
      claimantSyntheticAcknowledgementFixtures.length,
    );
    expect(markup).toContain("Receipt is not a review decision");
  });

  it("has no controls or runtime integration", () => {
    expect(markup).not.toMatch(/<(form|input|textarea|select|button)\b/iu);

    const sources = [
      "./page.tsx",
      "../../../lib/claimant-synthetic-acknowledgement.ts",
      "../../../components/claimant-acknowledgement/acknowledgement-boundary.tsx",
      "../../../components/claimant-acknowledgement/acknowledgement-status.tsx",
      "../../../components/claimant-acknowledgement/synthetic-acknowledgement-preview.tsx",
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
