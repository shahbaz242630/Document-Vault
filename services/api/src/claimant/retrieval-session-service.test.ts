import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_RETRIEVAL_SESSION_APPROVED, createRetrievalSessionServiceV1 }
  from "./retrieval-session-service.js";

describe("retrieval session service", () => {
  it("is immutable-false by default", async () => {
    expect(CLAIMANT_RETRIEVAL_SESSION_APPROVED).toBe(false);
    await expect(service().authorize(request())).rejects.toMatchObject({ kind: "disabled" });
  });
  it("derives claimant and fresh AAL2 portal bindings from a verified JWT", async () => {
    const transactions = { authorize: vi.fn(async () => ({ ok: true })) };
    await expect(service({ approved: true, transactions }).authorize(request()))
      .resolves.toEqual({ ok: true });
    expect(transactions.authorize).toHaveBeenCalledWith({
      authenticatedAt: "2026-08-18T11:59:00.000Z", caseId: id("01"),
      claimantUserId: id("09"), expectedCaseVersion: 7, finalizationId: id("02"),
      grantId: id("11"), idempotencyKey: id("03"), packageId: id("04"),
      portalSessionId: id("10"), recipientKeyId: id("31"),
      retrievalSessionId: id("05"),
    });
  });
  it("rejects unverified, stale, AAL1, recovery, and malformed requests", async () => {
    for (const sessionChange of [{ aal: "aal1" }, { expiresAt: NOW - 1 },
      { amr: [{ method: "mfa/totp", timestamp: NOW - 601 }] },
      { amr: [{ method: "recovery", timestamp: NOW - 1 },
        { method: "mfa/totp", timestamp: NOW - 1 }] }]) {
      await expect(service({ approved: true, sessionChange }).authorize(request()))
        .rejects.toMatchObject({ kind: "unauthorized" });
    }
    await expect(service({ approved: true, rejectSession: true }).authorize(request()))
      .rejects.toMatchObject({ kind: "unauthorized" });
    await expect(service({ approved: true }).authorize({ ...request(), extra: true }))
      .rejects.toMatchObject({ kind: "invalid_input" });
  });
});

const NOW = Date.parse("2026-08-18T12:00:00.000Z") / 1000;
function service(options: Record<string, unknown> = {}) {
  const session = { aal: "aal2", amr: [{ method: "mfa/totp", timestamp: NOW - 60 }],
    expiresAt: NOW + 3600, issuedAt: NOW - 60, sessionId: id("10"), userId: id("09"),
    ...(options.sessionChange as object ?? {}) };
  return createRetrievalSessionServiceV1({ approved: options.approved as boolean | undefined,
    nowEpochSeconds: () => NOW,
    sessions: { getSession: vi.fn(async () => {
      if (options.rejectSession) throw new Error("Unauthorized"); return session as never;
    }) }, transactions: (options.transactions ?? { authorize: vi.fn() }) as never });
}
function request() { return { bearerToken: "header.payload.signature".repeat(2),
  caseId: id("01"), expectedCaseVersion: 7, finalizationId: id("02"),
  grantId: id("11"), idempotencyKey: id("03"), packageId: id("04"),
  recipientKeyId: id("31"), retrievalSessionId: id("05") }; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
