import { describe, expect, it } from "vitest";

import { requireFreshClaimantAssurance } from "./session-assurance.js";

const now = 1_785_852_000;
const baseSession = {
  aal: "aal2" as const,
  amr: [{ method: "password", timestamp: now - 100 }, { method: "mfa/totp", timestamp: now }],
  expiresAt: now + 3600,
  issuedAt: now - 100,
  sessionId: "70000000-0000-4000-8000-000000000007",
  userId: "10000000-0000-4000-8000-000000000001",
};

describe("claimant session assurance", () => {
  it("accepts a current unexpired AAL2 session with timestamped MFA", () => {
    expect(requireFreshClaimantAssurance(baseSession, now)).toEqual({
      authenticatedAt: new Date(now * 1000).toISOString(),
    });
  });

  it("supports a bounded configurable freshness policy", () => {
    const fiveMinutesOld = {
      ...baseSession,
      amr: [{ method: "mfa/totp", timestamp: now - 300 }],
    };
    expect(() => requireFreshClaimantAssurance(fiveMinutesOld, now, 240)).toThrow();
    expect(requireFreshClaimantAssurance(fiveMinutesOld, now, 300)).toBeTruthy();
    expect(() => requireFreshClaimantAssurance(baseSession, now, 601)).toThrow(
      "Claimant fresh-assurance policy must be between 60 and 600 seconds.",
    );
  });

  it.each([
    ["AAL1", { ...baseSession, aal: "aal1" as const }],
    ["expired", { ...baseSession, expiresAt: now }],
    ["stale MFA", { ...baseSession, amr: [{ method: "mfa/totp", timestamp: now - 601 }] }],
    ["future MFA", { ...baseSession, amr: [{ method: "mfa/totp", timestamp: now + 61 }] }],
    ["missing MFA", { ...baseSession, amr: [{ method: "password", timestamp: now }] }],
    ["recovery", { ...baseSession, amr: [...baseSession.amr, { method: "recovery", timestamp: now }] }],
  ])("rejects %s assurance", (_label, candidate) => {
    expect(() => requireFreshClaimantAssurance(candidate, now)).toThrow(
      "Fresh multi-factor authentication is required.",
    );
  });
});
