import { afterEach, describe, expect, it, vi } from "vitest";

import { attempt, completion, id, issue, now, session, signature } from "./fixtures.test";
import { createHandoffLifecycle, type HandoffLifecycleSource } from "./lifecycle";
import type { HandoffSend } from "./transport";

const unavailable = { name: "HandoffUnavailableError", message: "Offline-code handoff is unavailable." };
type Options = Parameters<typeof createHandoffLifecycle>[0];
afterEach(() => vi.useRealTimers());

function harness(initial: unknown = { sequence: 0, state: "foreground" }) {
  let listener: (value: unknown) => void = () => undefined;
  const cleanup = vi.fn();
  const subscribe = vi.fn<HandoffLifecycleSource["subscribe"]>((next) => {
    listener = next; next(initial); return cleanup;
  });
  const response = (result: unknown) => new Response(JSON.stringify({ result }), { headers: {
    "Content-Type": "application/json", "Cache-Control": "private, no-store",
    "Access-Control-Allow-Origin": "https://claimant.test", "X-Robots-Tag": "noindex, nofollow",
  } });
  const send = vi.fn<HandoffSend>(async (url) => response(url.endsWith("/issue") ? issue() : completion));
  const signer = { syntheticOnly: true as const, sign: vi.fn(async () => signature) };
  const getSession = vi.fn(() => ({ ...session }));
  const options = () => ({ approved: true, syntheticOnly: true as const, productionRuntime: false as const,
    apiOrigin: "https://api.test", claimantOrigin: "https://claimant.test", send, signer, getSession,
    lifecycle: { subscribe }, now: () => now });
  const create = (overrides: Partial<Options> = {}) => createHandoffLifecycle({ ...options(), ...overrides });
  return { create, options, response, send, signer, getSession, cleanup, subscribe,
    emit: (value: unknown) => listener(value) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("disabled authenticated handoff lifecycle", () => {
  it("does not read dependencies while disabled", async () => {
    const touched = vi.fn(() => { throw new Error("private adapter detail"); });
    const input = Object.defineProperties({}, Object.fromEntries([
      "syntheticOnly", "productionRuntime", "apiOrigin", "claimantOrigin", "send", "signer",
      "getSession", "lifecycle", "now",
    ].map((key) => [key, { get: touched }]))) as Options;
    const runtime = createHandoffLifecycle(input);
    await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    await expect(runtime.retryCompletion()).rejects.toMatchObject(unavailable);
    await runtime.dispose();
    expect(runtime.snapshot().status).toBe("disabled"); expect(touched).not.toHaveBeenCalled();
  });

  it.each([{ syntheticOnly: false }, { productionRuntime: true }, { apiOrigin: "http://api.test" },
    { claimantOrigin: "https://claimant.test/path" }, { send: undefined }, { signer: {} },
    { getSession: undefined }])("fails closed before subscription for %j", async (override) => {
    const h = harness(); const runtime = h.create(override as Partial<Options>);
    await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    expect(runtime.snapshot().status).toBe("closed"); expect(h.subscribe).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("composes exact issue/sign/complete while exposing only a value-free snapshot", async () => {
    const h = harness(); const runtime = h.create();
    await expect(runtime.start(attempt)).resolves.toEqual(completion);
    expect(h.signer.sign).toHaveBeenCalledWith({ transcriptBytesBase64url: issue().transcript_bytes_base64url,
      challengeId: attempt.challengeId, recordBindingDigest: attempt.recordBindingDigest,
      signal: expect.any(AbortSignal) });
    expect(runtime.snapshot()).toEqual({ status: "completed", identity_verified: false,
      claim_created: false, release_authorized: false });
    expect(Object.isFrozen(runtime.snapshot())).toBe(true);
    await runtime.dispose(); expect(h.cleanup).toHaveBeenCalledOnce();
  });

  it("requires a synchronous foreground event and never starts from a lifecycle event", async () => {
    const h = harness({ sequence: 0, state: "background" }); const runtime = h.create();
    await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    h.emit({ sequence: 1, state: "foreground" });
    expect(runtime.snapshot().status).toBe("ready"); expect(h.send).not.toHaveBeenCalled();
    await runtime.start(attempt); await runtime.dispose();
    const missing = harness(); const other = missing.create({ lifecycle: { subscribe: () => missing.cleanup } });
    expect(other.snapshot().status).toBe("closed"); expect(missing.cleanup).toHaveBeenCalledOnce();
  });

  it("fails closed on a broken subscription or cleanup", async () => {
    for (const mode of ["throws", "no-cleanup", "cleanup-throws"]) {
      const h = harness();
      if (mode === "cleanup-throws") h.cleanup.mockImplementation(() => { throw new Error("private cleanup"); });
      const runtime = h.create({ lifecycle: { subscribe(listener) {
        if (mode === "throws") throw new Error("private subscribe");
        listener({ sequence: 0, state: mode === "cleanup-throws" ? "locked" : "foreground" });
        return mode === "no-cleanup" ? undefined as never : h.cleanup;
      } } });
      expect(runtime.snapshot().status).toBe("closed");
      await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
      expect(JSON.stringify(runtime.snapshot())).not.toContain("private");
    }
  });

  it.each(["locked", "session_ended", "disabled"])("closes permanently after %s", async (state) => {
    const h = harness(); const runtime = h.create(); h.emit({ sequence: 1, state });
    h.emit({ sequence: 2, state: "foreground" });
    await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    expect(runtime.snapshot().status).toBe("closed"); expect(h.cleanup).toHaveBeenCalledOnce();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("closes on malformed, rolled-back or divergent lifecycle events", async () => {
    for (const event of [null, { sequence: -1, state: "foreground" },
      { sequence: 0, state: "background" }, { sequence: 1, state: "foreground", account: id(8) }]) {
      const h = harness(); const runtime = h.create(); h.emit(event);
      expect(runtime.snapshot().status).toBe("closed"); expect(h.cleanup).toHaveBeenCalledOnce();
    }
    const h = harness(); const runtime = h.create();
    h.emit({ sequence: 0, state: "foreground" }); expect(runtime.snapshot().status).toBe("ready");
    h.emit({ sequence: 1, state: "foreground" }); h.emit({ sequence: 0, state: "foreground" });
    expect(runtime.snapshot().status).toBe("closed");
  });

  it.each(["issue", "sign", "complete"])("discards late %s results after background and resume", async (stage) => {
    const h = harness(); const pending = deferred<never>();
    if (stage === "issue") h.send.mockReturnValueOnce(pending.promise);
    if (stage === "sign") h.signer.sign.mockReturnValueOnce(pending.promise);
    if (stage === "complete") h.send.mockImplementationOnce(async () => h.response(issue()))
      .mockReturnValueOnce(pending.promise);
    const runtime = h.create(); const result = expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    await vi.waitFor(() => expect(stage === "sign" ? h.signer.sign : h.send)
      .toHaveBeenCalledTimes(stage === "complete" ? 2 : 1));
    h.emit({ sequence: 1, state: "background" }); h.emit({ sequence: 2, state: "foreground" });
    expect(runtime.snapshot().status).toBe("working");
    await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    pending.resolve((stage === "sign" ? signature : h.response(stage === "issue" ? issue() : completion)) as never);
    await result;
    expect(runtime.snapshot().status).toBe("ready");
    await expect(runtime.retryCompletion()).rejects.toMatchObject(unavailable);
    await runtime.dispose();
  });

  it("retains identical retry only in one foreground scope and clears it on background", async () => {
    const h = harness(); h.send.mockImplementationOnce(async () => h.response(issue()))
      .mockRejectedValueOnce(new Error("lost response"));
    const runtime = h.create(); await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    await expect(runtime.retryCompletion()).resolves.toEqual(completion);
    expect(h.signer.sign).toHaveBeenCalledOnce();
    expect(h.send.mock.calls[1][1]?.body).toBe(h.send.mock.calls[2][1]?.body);
    await runtime.dispose();
    const stopped = harness(); stopped.send.mockImplementationOnce(async () => stopped.response(issue()))
      .mockRejectedValueOnce(new Error("lost response"));
    const other = stopped.create(); await expect(other.start(attempt)).rejects.toMatchObject(unavailable);
    stopped.emit({ sequence: 1, state: "inactive" }); stopped.emit({ sequence: 2, state: "foreground" });
    await expect(other.retryCompletion()).rejects.toMatchObject(unavailable);
    expect(stopped.send).toHaveBeenCalledTimes(2); await other.dispose();
  });

  it("clears retry after session change and blocks overlapping operations", async () => {
    const h = harness(); h.send.mockImplementationOnce(async () => h.response(issue()))
      .mockRejectedValueOnce(new Error("lost response"));
    const runtime = h.create(); await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    h.getSession.mockReturnValue({ ...session, sessionId: id(8) });
    await expect(runtime.retryCompletion()).rejects.toMatchObject(unavailable);
    expect(h.send).toHaveBeenCalledTimes(2); await runtime.dispose();
    const stalled = harness(); const pending = deferred<Response>(); stalled.send.mockReturnValueOnce(pending.promise);
    const active = stalled.create(); const result = expect(active.start(attempt)).rejects.toMatchObject(unavailable);
    await vi.waitFor(() => expect(stalled.send).toHaveBeenCalledOnce());
    await expect(active.retryCompletion()).rejects.toMatchObject(unavailable);
    active.cancel(); pending.resolve(stalled.response(issue())); await result;
    await active.dispose();
  });

  it("waits for in-flight cleanup on disposal and ignores later events", async () => {
    const h = harness(); const pending = deferred<Response>(); h.send.mockReturnValueOnce(pending.promise);
    const runtime = h.create(); const result = expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    await vi.waitFor(() => expect(h.send).toHaveBeenCalledOnce());
    let settled = false; const disposal = runtime.dispose().then(() => { settled = true; });
    h.emit({ sequence: 1, state: "foreground" }); await Promise.resolve(); expect(settled).toBe(false);
    pending.resolve(h.response(issue())); await result; await disposal;
    expect(runtime.snapshot().status).toBe("closed"); expect(h.cleanup).toHaveBeenCalledOnce();
    await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
  });

  it("includes an adapter-triggered disposal in the in-flight completion", async () => {
    const h = harness(); const runtime = h.create(); let disposal: Promise<void> | undefined;
    h.send.mockImplementationOnce(async () => {
      disposal = runtime.dispose(); return h.response(issue());
    });
    await expect(runtime.start(attempt)).rejects.toMatchObject(unavailable);
    await disposal;
    expect(runtime.snapshot().status).toBe("closed");
    expect(h.signer.sign).not.toHaveBeenCalled(); expect(h.cleanup).toHaveBeenCalledOnce();
  });
});
