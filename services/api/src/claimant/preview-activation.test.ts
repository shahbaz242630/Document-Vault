import { describe, expect, it } from "vitest";

import { isClaimantPreviewActivated } from "./preview-activation.js";

const activated = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "claimant-preview",
  CLAIMANT_PREVIEW_ACTIVATION: "synthetic-only",
} as const;

describe("claimant Preview activation", () => {
  it("is true only when all four conditions hold", () => {
    expect(isClaimantPreviewActivated(activated)).toBe(true);
  });

  it("stays false whenever any condition is missing, blank or different", () => {
    const keys = Object.keys(activated) as (keyof typeof activated)[];
    for (let mask = 0; mask < 2 ** keys.length - 1; mask += 1) {
      const env = Object.fromEntries(keys.filter((_, index) => mask & (1 << index)).map((key) => [key, activated[key]]));
      expect(isClaimantPreviewActivated(env)).toBe(false);
    }
    for (const key of keys) {
      for (const value of ["", " ", activated[key].toUpperCase(), ` ${activated[key]}`, `${activated[key]} `]) {
        if (value === activated[key]) continue;
        expect(isClaimantPreviewActivated({ ...activated, [key]: value })).toBe(false);
      }
    }
  });

  it("never activates in Production, development or on another preview branch", () => {
    expect(isClaimantPreviewActivated({ ...activated, VERCEL_ENV: "production" })).toBe(false);
    expect(isClaimantPreviewActivated({ ...activated, VERCEL_ENV: "development" })).toBe(false);
    expect(isClaimantPreviewActivated({ ...activated, VERCEL_GIT_COMMIT_REF: "main" })).toBe(false);
    expect(isClaimantPreviewActivated({ ...activated, VERCEL_GIT_COMMIT_REF: "dependabot/npm_and_yarn/hono" }))
      .toBe(false);
    expect(isClaimantPreviewActivated({ ...activated, VERCEL_GIT_COMMIT_REF: "claimant-preview-2" })).toBe(false);
    expect(isClaimantPreviewActivated({ ...activated, CLAIMANT_PREVIEW_ACTIVATION: "true" })).toBe(false);
  });

  it("reads the process environment by default and is false in tests", () => {
    expect(isClaimantPreviewActivated()).toBe(false);
  });
});
