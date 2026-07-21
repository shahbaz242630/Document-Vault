import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  claimantApplicationStatuses,
  claimantDataBoundaries,
  claimantEvidenceChecklist,
  claimantInformationRoutes,
  claimantPortalCapabilities,
  claimantPortalStages,
} from "@/lib/claimant-portal";
import { claimInformationRoutes, publicRoutes } from "@/lib/site";

import ClaimPage from "./page";
import EmergencyCodeClaimPage, { metadata as emergencyMetadata } from "./emergency-code/page";
import RegisteredRecipientClaimPage, { metadata as recipientMetadata } from "./registered-recipient/page";

const routeMarkup = [ClaimPage, RegisteredRecipientClaimPage, EmergencyCodeClaimPage]
  .map((Page) => renderToStaticMarkup(<Page />))
  .join("\n");

describe("inactive claimant portal foundation", () => {
  it("keeps every stateful claimant capability hard-disabled", () => {
    expect(claimantPortalCapabilities).toEqual({
      adminCaseNotification: false,
      authentication: false,
      claimIntake: false,
      emergencyCodeEntry: false,
      evidenceUpload: false,
      localClaimantDecryption: false,
      review: false,
      release: false,
    });

    const modelSource = readFileSync(
      fileURLToPath(new URL("../../lib/claimant-portal.ts", import.meta.url)),
      "utf8",
    );
    expect(modelSource).not.toContain("process.env");
  });

  it("declares both informational routes from one typed model", () => {
    expect(claimantInformationRoutes.map(({ href }) => href)).toEqual(claimInformationRoutes);
    expect(claimantInformationRoutes.map(({ key }) => key)).toEqual([
      "registered-recipient",
      "emergency-code",
    ]);
    expect(new Set(claimantPortalStages.map(({ title }) => title)).size).toBe(
      claimantPortalStages.length,
    );
    for (const route of claimInformationRoutes) expect(publicRoutes).toContain(route);
  });

  it("renders the planned structure without an intake or release control", () => {
    expect(routeMarkup).toContain("Preparation is not authorization");
    expect(routeMarkup).toContain("Non-response never auto-releases the MVP");
    expect(routeMarkup).toContain("time-limited claimant-addressed ciphertext package");
    expect(routeMarkup).toContain("Do not submit information here");
    expect(routeMarkup).toContain("Documents stay out of email");
    expect(routeMarkup).toContain("Application progress placeholder");
    expect(routeMarkup).toContain("Approval creates claimant-addressed ciphertext");
    expect(routeMarkup).not.toMatch(/<(form|input|textarea|select|button)\b/iu);
    expect(routeMarkup).not.toMatch(/href="(?:javascript:|mailto:|tel:)/iu);
  });

  it("defines one shared evidence, status, and data-boundary model for both routes", () => {
    expect(claimantEvidenceChecklist.length).toBeGreaterThanOrEqual(5);
    expect(claimantApplicationStatuses.map(({ key }) => key)).toEqual([
      "account-verified",
      "documents-needed",
      "submitted",
      "owner-protection",
      "human-review",
      "decision",
      "encrypted-release",
    ]);
    expect(claimantDataBoundaries).toHaveLength(3);

    const model = JSON.stringify({
      claimantApplicationStatuses,
      claimantDataBoundaries,
      claimantEvidenceChecklist,
      claimantInformationRoutes,
    });
    expect(model).toContain("value-free email");
    expect(model).toContain("documents are not emailed");
    expect(model).toContain("complete secret");
    expect(model).toContain("decrypts it locally");
  });

  it("keeps both route pages out of search indexes", () => {
    expect(recipientMetadata.robots).toEqual({ index: false, follow: false });
    expect(emergencyMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("contains no network, persistence, authentication, or storage integration", () => {
    const sources = [
      "page.tsx",
      "registered-recipient/page.tsx",
      "emergency-code/page.tsx",
      "../../components/inactive-claim-route-page.tsx",
      "../../lib/claimant-portal.ts",
    ].map((path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"));
    const source = sources.join("\n");

    for (const forbidden of [
      "@supabase/",
      "createClient(",
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "process.env",
      "mailto:",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
