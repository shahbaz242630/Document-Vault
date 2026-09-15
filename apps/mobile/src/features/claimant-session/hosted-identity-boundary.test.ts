import { describe, expect, it, vi } from "vitest";

import { createClaimantHostedIdentityBoundary } from "./hosted-identity-boundary";

const now = Date.parse("2026-09-15T12:00:00.000Z");
const id = (n: number) => `81000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const session = Object.freeze({ syntheticOnly: true as const, status: "authenticated" as const,
  userId: id(1), sessionId: id(2), accessToken: "synthetic-hosted-token", aal: "aal2" as const,
  recovery: false as const, expiresAt: now + 600_000, assuredAt: now,
  issuer: "https://identity.sanduqkin.test", audience: "authenticated" as const });

function provider(initial: unknown = session) {
  const listeners = new Set<(value: unknown) => void>(); const cleanup = vi.fn();
  return { cleanup, value: { syntheticOnly: true as const, subscribe(listener: (value: unknown) => void) {
    listeners.add(listener); listener(initial); return () => { listeners.delete(listener); cleanup(); };
  } }, emit: (value: unknown) => { for (const listener of listeners) listener(value); } };
}

describe("claimant hosted identity boundary", () => {
  it("is dormant by default without touching the provider", () => {
    const touched = vi.fn(() => { throw new Error("provider detail"); });
    const boundary = createClaimantHostedIdentityBoundary(Object.defineProperties({}, Object.fromEntries([
      "syntheticOnly", "productionRuntime", "expectedIssuer", "provider", "now"
    ].map((key) => [key, { get: touched }]))) as never);
    expect(boundary.snapshot()).toEqual({ status: "disabled", session_available: false });
    expect(touched).not.toHaveBeenCalled();
  });

  it("establishes an exact fresh AAL2 session synchronously and exposes a value-free snapshot", async () => {
    const p = provider(); const boundary = createClaimantHostedIdentityBoundary({ approved: true,
      syntheticOnly: true, productionRuntime: false, expectedIssuer: session.issuer, provider: p.value, now: () => now });
    const listener = vi.fn(); const unsubscribe = boundary.source.subscribe(listener);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ userId: session.userId, aal: "aal2" }));
    expect(boundary.snapshot()).toEqual({ status: "ready", session_available: true });
    expect(JSON.stringify(boundary.snapshot())).not.toMatch(/token|userId|sessionId/iu);
    unsubscribe(); await boundary.dispose(); expect(p.cleanup).toHaveBeenCalledOnce();
  });

  it.each([
    { ...session, aal: "aal1" }, { ...session, recovery: true },
    { ...session, assuredAt: now - 600_001 }, { ...session, expiresAt: now },
    { ...session, issuer: "https://hostile.test" }, { ...session, audience: "other" },
    { ...session, extra: true },
  ])("fails closed for invalid hosted authentication", (value) => {
    const p = provider(value); const boundary = createClaimantHostedIdentityBoundary({ approved: true,
      syntheticOnly: true, productionRuntime: false, expectedIssuer: session.issuer, provider: p.value, now: () => now });
    expect(boundary.snapshot()).toEqual({ status: "closed", session_available: false });
    expect(p.cleanup).toHaveBeenCalledOnce();
  });

  it("rejects an asynchronously established session and rolls back its subscription", () => {
    const cleanup = vi.fn(); const boundary = createClaimantHostedIdentityBoundary({ approved: true,
      syntheticOnly: true, productionRuntime: false, expectedIssuer: session.issuer, now: () => now,
      provider: { syntheticOnly: true, subscribe: () => cleanup } });
    expect(boundary.snapshot().status).toBe("closed"); expect(cleanup).toHaveBeenCalledOnce();
  });

  it("closes permanently on token or session drift and emits only generic unavailability", () => {
    const p = provider(); const boundary = createClaimantHostedIdentityBoundary({ approved: true,
      syntheticOnly: true, productionRuntime: false, expectedIssuer: session.issuer, provider: p.value, now: () => now });
    const listener = vi.fn(); boundary.source.subscribe(listener);
    p.emit({ ...session, accessToken: "changed-token" }); p.emit(session);
    expect(boundary.snapshot()).toEqual({ status: "closed", session_available: false });
    expect(listener).toHaveBeenLastCalledWith({ unavailable: true });
    expect(p.cleanup).toHaveBeenCalledOnce();
  });
});
