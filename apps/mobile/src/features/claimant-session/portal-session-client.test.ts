import { describe, expect, it, vi } from "vitest";

import { createSyntheticClaimantPortalSessionClient, type PortalSessionSend } from "./portal-session-client";

const id = (n: number) => `90000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = Date.parse("2026-09-15T08:00:00.000Z");
const unavailable = { name: "ClaimantPortalSessionUnavailableError",
  message: "Claimant portal session is unavailable." };

function response(result: unknown, headers: Record<string, string> = {}, status = 200) {
  return Response.json({ result }, { status, headers: { "Access-Control-Allow-Origin": "https://claim.sanduqkin.test",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin", ...headers } });
}

function harness() {
  let time = now;
  const authenticated = { syntheticOnly: true as const, userId: id(1), sessionId: id(2),
    accessToken: "synthetic-access-token", aal: "aal2" as const, recovery: false as const,
    expiresAt: now + 900_000, assuredAt: now };
  const results = {
    activate: { context: "claimant_portal", sessionVersion: 3, displacedPrevious: false, replayed: false },
    assert: { context: "claimant_portal", sessionVersion: 3 },
    revoke: { context: "claimant_portal", sessionVersion: 4, revoked: true, replayed: false },
  } as const;
  const send = vi.fn<PortalSessionSend>(async (url) => {
    const action = url.split("/").at(-1) as keyof typeof results;
    return response(results[action]);
  });
  const client = createSyntheticClaimantPortalSessionClient({ approved: true, syntheticOnly: true,
    productionRuntime: false, apiOrigin: "https://api.sanduqkin.test",
    claimantOrigin: "https://claim.sanduqkin.test", send, now: () => time });
  return { authenticated, results, send, client, advance: (milliseconds: number) => { time += milliseconds; } };
}

describe("synthetic claimant portal session client", () => {
  it("is dormant by default without reading dependencies", async () => {
    const touched = vi.fn(() => { throw new Error("private adapter detail"); });
    const input = Object.defineProperties({}, Object.fromEntries(["syntheticOnly", "productionRuntime",
      "apiOrigin", "claimantOrigin", "send", "now"].map((key) => [key, { get: touched }]))) as
      Parameters<typeof createSyntheticClaimantPortalSessionClient>[0];
    const client = createSyntheticClaimantPortalSessionClient(input);
    await expect(client.activate({} as never)).rejects.toMatchObject(unavailable);
    expect(client.snapshot().status).toBe("disabled"); expect(touched).not.toHaveBeenCalled();
  });

  it("activates with an exact body-free authority request and exposes a synchronous memory source", async () => {
    const h = harness();
    const active = await h.client.activate({ authenticated: h.authenticated, idempotencyKey: id(3) });
    expect(active).toEqual({ userId: id(1), sessionId: id(2), accessToken: "synthetic-access-token",
      aal: "aal2", recovery: false, expiresAt: now + 900_000, assuredAt: now,
      context: "claimant_portal", sessionVersion: 3 });
    const [url, request] = h.send.mock.calls[0];
    expect(url).toBe("https://api.sanduqkin.test/claimant/portal/session/activate");
    expect(request).toMatchObject({ method: "POST", body: "{}", headers: {
      Authorization: "Bearer synthetic-access-token", Origin: "https://claim.sanduqkin.test",
      "Content-Type": "application/json", "Idempotency-Key": id(3) } });
    expect(request.body).not.toContain(id(1)); expect(request.body).not.toContain(id(2));
    const listener = vi.fn(); h.client.source.subscribe(listener);
    expect(listener).toHaveBeenCalledWith(active);
    expect(h.client.snapshot()).toEqual({ status: "active", session_available: true, retry_available: false });
  });

  it("asserts and revokes only the exact active server session version", async () => {
    const h = harness(); const listener = vi.fn(); h.client.source.subscribe(listener);
    const active = await h.client.activate({ authenticated: h.authenticated, idempotencyKey: id(3) });
    await expect(h.client.assert(id(4))).resolves.toBe(active);
    await expect(h.client.revoke(id(5))).resolves.toBeUndefined();
    expect(h.send.mock.calls.map(([url]) => url.split("/").at(-1))).toEqual(["activate", "assert", "revoke"]);
    expect(listener).toHaveBeenNthCalledWith(1, active); expect(listener).toHaveBeenNthCalledWith(2, null);
    expect(h.client.snapshot()).toEqual({ status: "ready", session_available: false, retry_available: false });
  });

  it("rejects stale, recovery, AAL1 and malformed authenticated sessions before sending", async () => {
    type Authenticated = ReturnType<typeof harness>["authenticated"];
    const mutations: ((value: Authenticated) => unknown)[] = [(value) =>
      ({ ...value, aal: "aal1" }), (value) =>
      ({ ...value, recovery: true }), (value: ReturnType<typeof harness>["authenticated"]) =>
      ({ ...value, accessToken: "bad token" })];
    for (const mutate of mutations) {
      const h = harness();
      await expect(h.client.activate({ authenticated: mutate(h.authenticated) as never,
        idempotencyKey: id(3) })).rejects.toMatchObject(unavailable);
      expect(h.send).not.toHaveBeenCalled();
    }
    const expired = harness(); expired.advance(900_001);
    await expect(expired.client.activate({ authenticated: expired.authenticated,
      idempotencyKey: id(3) })).rejects.toMatchObject(unavailable);
    expect(expired.send).not.toHaveBeenCalled();
  });

  it("rejects unsafe response status, origin, cache and shape", async () => {
    for (const unsafe of [response({ context: "claimant_portal", sessionVersion: 3 }, {}, 401),
      response({ context: "claimant_portal", sessionVersion: 3 }, { "Access-Control-Allow-Origin": "*" }),
      response({ context: "claimant_portal", sessionVersion: 3 }, { "Cache-Control": "public" }),
      response({ context: "claimant_portal", sessionVersion: 3, accessToken: "leak" })]) {
      const h = harness(); h.send.mockResolvedValueOnce(unsafe);
      await expect(h.client.activate({ authenticated: h.authenticated,
        idempotencyKey: id(3) })).rejects.toMatchObject(unavailable);
      expect(h.client.snapshot().session_available).toBe(false);
    }
  });

  it("retries an ambiguous activation with the exact original request", async () => {
    const h = harness(); h.send.mockRejectedValueOnce(new Error("lost response"));
    await expect(h.client.activate({ authenticated: h.authenticated,
      idempotencyKey: id(3) })).rejects.toMatchObject({ ...unavailable, retryable: true });
    expect(h.client.snapshot().retry_available).toBe(true);
    await expect(h.client.retryActivation()).resolves.toMatchObject({ sessionVersion: 3 });
    expect(h.send.mock.calls[0][0]).toBe(h.send.mock.calls[1][0]);
    expect(h.send.mock.calls[0][1].body).toBe(h.send.mock.calls[1][1].body);
    expect(h.send.mock.calls[0][1].headers).toBe(h.send.mock.calls[1][1].headers);
  });

  it.each([3, 5])("rejects a revoke reporting session version %i instead of the advanced version", async (version) => {
    const h = harness(); await h.client.activate({ authenticated: h.authenticated, idempotencyKey: id(3) });
    h.send.mockResolvedValueOnce(response({ context: "claimant_portal", sessionVersion: version, revoked: true, replayed: false }));
    await expect(h.client.revoke(id(5))).rejects.toMatchObject(unavailable);
    expect(h.client.snapshot()).toMatchObject({ session_available: true, retry_available: false });
  });

  it("retries an ambiguous revoke but never grants assert retry authority", async () => {
    const h = harness();
    await h.client.activate({ authenticated: h.authenticated, idempotencyKey: id(3) });
    h.send.mockRejectedValueOnce(new Error("lost revoke"));
    await expect(h.client.revoke(id(5))).rejects.toMatchObject({ ...unavailable, retryable: true });
    await expect(h.client.retryRevoke()).resolves.toBeUndefined();
    const asserted = harness();
    await asserted.client.activate({ authenticated: asserted.authenticated, idempotencyKey: id(3) });
    asserted.send.mockRejectedValueOnce(new Error("lost assert"));
    await expect(asserted.client.assert(id(4))).rejects.toMatchObject({ ...unavailable, retryable: false });
    expect(asserted.client.snapshot().retry_available).toBe(false);
    await expect(asserted.client.retryActivation()).rejects.toMatchObject(unavailable);
    await expect(asserted.client.retryRevoke()).rejects.toMatchObject(unavailable);
  });

  it("closes if assert reports a changed server session version", async () => {
    const h = harness();
    await h.client.activate({ authenticated: h.authenticated, idempotencyKey: id(3) });
    h.send.mockResolvedValueOnce(response({ context: "claimant_portal", sessionVersion: 4 }));
    await expect(h.client.assert(id(4))).rejects.toMatchObject(unavailable);
    expect(h.client.snapshot()).toEqual({ status: "closed", session_available: false, retry_available: false });
  });

  it("rejects overlapping work and suppresses a late activation after cancellation", async () => {
    const h = harness(); let finish!: (value: Response) => void;
    h.send.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = h.client.activate({ authenticated: h.authenticated, idempotencyKey: id(3) });
    await vi.waitFor(() => expect(h.send).toHaveBeenCalledOnce());
    await expect(h.client.activate({ authenticated: h.authenticated,
      idempotencyKey: id(6) })).rejects.toMatchObject(unavailable);
    h.client.cancel(); finish(response(h.results.activate));
    await expect(pending).rejects.toMatchObject(unavailable);
    expect(h.client.snapshot()).toEqual({ status: "ready", session_available: false, retry_available: false });
  });

  it.each(["cancel", "dispose"] as const)("aborts a request that never responds on %s", async (action) => {
    const h = harness(); let signal: AbortSignal | undefined;
    h.send.mockImplementationOnce((_url, init) => { signal = init.signal; return new Promise<Response>(() => {}); });
    const pending = h.client.activate({ authenticated: h.authenticated, idempotencyKey: id(3) });
    await vi.waitFor(() => expect(h.send).toHaveBeenCalledOnce());
    const settled = action === "cancel" ? (h.client.cancel(), Promise.resolve()) : h.client.dispose();
    expect(signal?.aborted).toBe(true);
    await expect(pending).rejects.toMatchObject(unavailable);
    await expect(settled).resolves.toBeUndefined();
    expect(h.client.snapshot().retry_available).toBe(false);
    await expect(h.client.retryActivation()).rejects.toMatchObject(unavailable);
  });

  it("disposes awaitably and makes the session source unavailable", async () => {
    const h = harness(); const listener = vi.fn(); h.client.source.subscribe(listener);
    await h.client.activate({ authenticated: h.authenticated, idempotencyKey: id(3) });
    await h.client.dispose();
    expect(listener).toHaveBeenLastCalledWith(null);
    await expect(h.client.assert(id(4))).rejects.toMatchObject(unavailable);
    const late = vi.fn(); h.client.source.subscribe(late); expect(late).not.toHaveBeenCalled();
    expect(h.client.snapshot().status).toBe("closed");
  });
});
