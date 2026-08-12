import { describe, expect, it } from "vitest";

import {
  getClaimantWebRuntimeConfig,
  isClaimantWebRequestAllowed,
  isProtectedClaimantPath,
} from "./runtime-config";

describe("claimant web runtime boundary", () => {
  it("keeps protected claimant routes disabled by default", () => {
    const config = getClaimantWebRuntimeConfig({ NODE_ENV: "test" });
    expect(config.authenticationEnabled).toBe(false);
    expect(isClaimantWebRequestAllowed("/claimant/sign-in", "app.test", config)).toBe(false);
  });

  it("allows only exact claimant hosts in a non-production environment", () => {
    const config = getClaimantWebRuntimeConfig({
      CLAIMANT_WEB_ALLOWED_HOSTS: "claimant.localhost, app.synthetic.test",
      CLAIMANT_WEB_AUTHENTICATION_ENABLED: "true",
      NODE_ENV: "test",
    });
    expect(isClaimantWebRequestAllowed("/claimant/sign-in", "claimant.localhost", config)).toBe(true);
    expect(isClaimantWebRequestAllowed("/claimant/sign-in", "app.synthetic.test", config)).toBe(true);
    expect(isClaimantWebRequestAllowed("/claimant/sign-in", "sanduqkin.com", config)).toBe(false);
    expect(isClaimantWebRequestAllowed("/claimant/sign-in", "vault.sanduqkin.com", config)).toBe(false);
    expect(isClaimantWebRequestAllowed("/claimant/sign-in", "evil.app.synthetic.test", config)).toBe(false);
  });

  it("does not classify public claim information as protected claimant application routes", () => {
    expect(isProtectedClaimantPath("/claim")).toBe(false);
    expect(isProtectedClaimantPath("/claim/registered-recipient")).toBe(false);
    expect(isProtectedClaimantPath("/claimant")).toBe(true);
  });

  it("rejects ambiguous flags, missing host allowlists, and production activation", () => {
    expect(() => getClaimantWebRuntimeConfig({
      CLAIMANT_WEB_AUTHENTICATION_ENABLED: "1", NODE_ENV: "test",
    })).toThrow("must be true or false");
    expect(() => getClaimantWebRuntimeConfig({
      CLAIMANT_WEB_AUTHENTICATION_ENABLED: "true", NODE_ENV: "test",
    })).toThrow("requires an exact host allowlist");
    expect(() => getClaimantWebRuntimeConfig({
      CLAIMANT_WEB_ALLOWED_HOSTS: "app.sanduqkin.com",
      CLAIMANT_WEB_AUTHENTICATION_ENABLED: "true",
      NODE_ENV: "production",
    })).toThrow("not approved for production");
  });
});
