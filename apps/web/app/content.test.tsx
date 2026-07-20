import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AccessibilityPage from "./accessibility/page";
import AccountDeletionPage from "./account-deletion/page";
import ClaimPage, { metadata as claimMetadata } from "./claim/page";
import FeaturesPage from "./features/page";
import HowItWorksPage from "./how-it-works/page";
import HomePage from "./page";
import PrivacyPage from "./privacy/page";
import robots from "./robots";
import SecurityPage from "./security/page";
import sitemap from "./sitemap";
import SupportPage from "./support/page";
import TermsPage from "./terms/page";
import { contentVersion, publicRoutes, siteUrl } from "../lib/site";

const pages = [
  HomePage,
  FeaturesPage,
  HowItWorksPage,
  SecurityPage,
  PrivacyPage,
  TermsPage,
  AccountDeletionPage,
  SupportPage,
  AccessibilityPage,
  ClaimPage,
];

const combinedMarkup = pages.map((Page) => renderToStaticMarkup(<Page />)).join("\n");

describe("Phase 3 public content", () => {
  it("provides a static page for every declared public route", () => {
    const appRoot = fileURLToPath(new URL("./", import.meta.url));

    for (const route of publicRoutes) {
      const pagePath = route === "/" ? `${appRoot}page.tsx` : `${appRoot}${route.slice(1)}/page.tsx`;
      expect(existsSync(pagePath), `missing ${route}`).toBe(true);
    }
  });

  it("keeps every rendered internal link within the approved static surface", () => {
    const allowedTargets = new Set<string>([...publicRoutes, "/health.json"]);
    const hrefs = [...combinedMarkup.matchAll(/href="([^"]+)"/gu)].map((match) => match[1]);

    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      if (href?.startsWith("/")) expect(allowedTargets.has(href), `broken ${href}`).toBe(true);
    }
  });

  it("publishes legal content as versioned, non-effective review drafts", () => {
    for (const Page of [PrivacyPage, TermsPage, AccountDeletionPage, AccessibilityPage]) {
      const markup = renderToStaticMarkup(<Page />);
      expect(markup).toContain(contentVersion.label);
      expect(markup).toContain(contentVersion.reviewed);
      expect(markup).toContain(contentVersion.status);
      expect(markup).toContain("Draft for review");
    }
  });

  it("keeps the claim entry informational and unable to collect data", () => {
    const markup = renderToStaticMarkup(<ClaimPage />);

    expect(markup).toContain("Claim applications are not active");
    expect(markup).toContain("Do not enter or send the code");
    expect(markup).not.toMatch(/<(form|input|textarea|select|button)\b/iu);
    expect(claimMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("introduces no form on any public page", () => {
    expect(combinedMarkup).not.toMatch(/<(form|input|textarea|select)\b/iu);
  });

  it("keeps the protected preview out of search indexes while providing SEO routes", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(sitemap()).toHaveLength(publicRoutes.length);
    expect(sitemap().map(({ url }) => url)).toContain(siteUrl);
    expect(sitemap().map(({ url }) => url)).toContain(`${siteUrl}/privacy`);
  });

  it("contains no direct browser-storage, raw-network, analytics, or tracking integration", () => {
    const roots = [
      fileURLToPath(new URL("./", import.meta.url)),
      fileURLToPath(new URL("../components/", import.meta.url)),
    ];
    const source = roots.flatMap(readSourceFiles).join("\n");

    for (const forbidden of [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "gtag(",
      "GoogleAnalytics",
      "@supabase/",
      "createClient(",
      "fetch(",
      "XMLHttpRequest",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});

function readSourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = `${root}${name}`;
    if (statSync(path).isDirectory()) return readSourceFiles(`${path}/`);
    if (!path.endsWith(".tsx") || path.endsWith(".test.tsx")) return [];
    return [readFileSync(path, "utf8")];
  });
}
