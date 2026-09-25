import { describe, expect, it, vi } from "vitest";

import { id } from "../claimant-handoff/fixtures.test";
import { createClaimantRuntimeFoundation } from "./runtime-foundation";
import { harness, keyAlias, type Options, portalResponse, unavailable } from "./runtime-foundation.fixtures.test";

describe("claimant runtime foundation", () => {
  it("is dormant by default without reading identity, native, lifecycle or transports", async () => {
    const touched = vi.fn(() => { throw new Error("dependency detail"); });
    const runtime = createClaimantRuntimeFoundation(Object.defineProperties({}, Object.fromEntries([
      "syntheticOnly", "productionRuntime", "identity", "signing", "journey"
    ].map((key) => [key, { get: touched }]))) as Options);
    await expect(runtime.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(runtime.snapshot().status).toBe("disabled"); expect(touched).not.toHaveBeenCalled();
  });

  it("composes hosted AAL2, portal assertion, possession and native signing into a safe draft", async () => {
    const h = harness(); const runtime = createClaimantRuntimeFoundation(h.options);
    await runtime.activatePortal(id(101));
    const draft = await runtime.start({ attempt: h.attempt, sessionAssertionIdempotencyKey: id(102) });
    expect(draft).toEqual({ state: "draft", route_profile: "offline_code_v2", case_version: 1,
      claimant_session_bound: true, case_created: true, identity_verified: false,
      relationship_verified: false, intake_started: false, review_started: false, release_authorized: false });
    expect(h.portalSend.mock.calls.map(([url]) => url.split("/").at(-1))).toEqual(["activate", "assert"]);
    expect(h.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    expect(h.signClaimantHandoffAsync.mock.calls[0]?.[0]).toMatchObject({ key_alias_reference: keyAlias,
      challenge_id: expect.any(String) });
    expect(runtime.snapshot()).toEqual({ status: "draft", portal_session_active: true,
      draft_available: true, identity_verified: false, relationship_verified: false,
      intake_started: false, review_started: false, release_authorized: false });
    await runtime.dispose();
  });

  it("fails composition closed for invalid hosted identity before any adapter work", async () => {
    const h = harness(); const runtime = createClaimantRuntimeFoundation({ ...h.options,
      identity: { ...h.options.identity, expectedIssuer: "https://substituted.test" } });
    expect(runtime.snapshot().status).toBe("closed");
    await expect(runtime.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(h.portalSend).not.toHaveBeenCalled(); expect(h.possessionSend).not.toHaveBeenCalled();
    expect(h.signClaimantHandoffAsync).not.toHaveBeenCalled();
  });

  it("fails server assertion before possession or native signing", async () => {
    const h = harness(); const runtime = createClaimantRuntimeFoundation(h.options);
    await runtime.activatePortal(id(101));
    h.portalSend.mockResolvedValueOnce(portalResponse({ context: "claimant_portal", sessionVersion: 2 }));
    await expect(runtime.start({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    expect(h.possessionSend).not.toHaveBeenCalled(); expect(h.signClaimantHandoffAsync).not.toHaveBeenCalled();
    expect(runtime.snapshot().status).toBe("closed");
  });

  it("delegates only the exact ambiguous portal activation retry", async () => {
    const h = harness(); h.portalSend.mockRejectedValueOnce(new Error("lost activation response"));
    const runtime = createClaimantRuntimeFoundation(h.options);
    await expect(runtime.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    await expect(runtime.retryActivation()).resolves.toBeUndefined();
    expect(h.portalSend.mock.calls[0]?.[0]).toBe(h.portalSend.mock.calls[1]?.[0]);
    expect(h.portalSend.mock.calls[0]?.[1].headers).toBe(h.portalSend.mock.calls[1]?.[1].headers);
  });

  it("delegates the exact proof retry before native signing", async () => {
    const h = harness(); h.possessionSend.mockImplementationOnce(async () => h.possessionResponse(false))
      .mockRejectedValueOnce(new Error("lost proof response"));
    const runtime = createClaimantRuntimeFoundation(h.options); await runtime.activatePortal(id(101));
    await expect(runtime.start({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    await expect(runtime.retryProof(id(103))).resolves.toMatchObject({ state: "draft" });
    expect(h.producer.produce).toHaveBeenCalledOnce(); expect(h.signClaimantHandoffAsync).toHaveBeenCalledOnce();
  });

  it("retries an ambiguous completion without invoking native signing twice", async () => {
    const h = harness(); h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockRejectedValueOnce(new Error("lost completion response"));
    const runtime = createClaimantRuntimeFoundation(h.options); await runtime.activatePortal(id(101));
    await expect(runtime.start({ attempt: h.attempt,
      sessionAssertionIdempotencyKey: id(102) })).rejects.toMatchObject(unavailable);
    await expect(runtime.retryCompletion(id(103))).resolves.toMatchObject({ state: "draft" });
    expect(h.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    expect(h.handoffSend.mock.calls[1]?.[1]?.body).toBe(h.handoffSend.mock.calls[2]?.[1]?.body);
  });

  it("suppresses a late native result after background cancellation", async () => {
    const h = harness(); let finish!: (value: typeof h.nativeResult) => void;
    h.signClaimantHandoffAsync.mockImplementationOnce(() =>
      new Promise<typeof h.nativeResult>((resolve) => { finish = resolve; }));
    const runtime = createClaimantRuntimeFoundation(h.options); await runtime.activatePortal(id(101));
    const pending = runtime.start({ attempt: h.attempt, sessionAssertionIdempotencyKey: id(102) });
    const rejection = expect(pending).rejects.toMatchObject(unavailable);
    await vi.waitFor(() => expect(h.signClaimantHandoffAsync).toHaveBeenCalledOnce());
    h.emitLifecycle("background"); h.emitLifecycle("foreground"); finish(h.nativeResult);
    await rejection;
    expect(runtime.snapshot()).toMatchObject({ draft_available: false, release_authorized: false });
    await expect(runtime.retryCompletion(id(103))).rejects.toMatchObject(unavailable);
  });

  it("closes on hosted session drift and terminal lifecycle", async () => {
    const drift = harness(); const first = createClaimantRuntimeFoundation(drift.options);
    drift.emitAuth({ ...drift.authenticated, accessToken: "changed-token" });
    await expect(first.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(first.snapshot().status).toBe("closed");
    const terminal = harness(); const second = createClaimantRuntimeFoundation(terminal.options);
    terminal.emitLifecycle("locked");
    await expect(second.activatePortal(id(101))).rejects.toMatchObject(unavailable);
    expect(second.snapshot().status).toBe("closed"); await second.dispose();
  });

  it("preserves exact revoke retry and disposes all boundaries", async () => {
    const h = harness(); const runtime = createClaimantRuntimeFoundation(h.options);
    await runtime.activatePortal(id(101)); h.portalSend.mockRejectedValueOnce(new Error("lost revoke response"));
    await expect(runtime.revokePortal(id(104))).rejects.toMatchObject(unavailable);
    await expect(runtime.retryRevoke()).resolves.toBeUndefined();
    expect(h.portalSend.mock.calls[1]?.[0]).toBe(h.portalSend.mock.calls[2]?.[0]);
    expect(runtime.snapshot().status).toBe("closed"); await runtime.dispose();
  });
});
