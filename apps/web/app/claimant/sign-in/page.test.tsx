import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ClaimantSignInPage, { metadata } from "./page";

describe("claimant sign-in boundary shell", () => {
  it("is non-indexed and contains no credential, invitation, evidence, or key input", () => {
    const markup = renderToStaticMarkup(<ClaimantSignInPage />);
    expect(metadata.robots).toEqual({ follow: false, index: false });
    expect(markup).toContain("Eligibility comes before a claimant session");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("type=\"file\"");
  });
});
