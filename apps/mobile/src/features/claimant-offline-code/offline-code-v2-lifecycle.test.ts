import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { OfflineCodeV2SyntheticAttempt } from "./offline-code-v2-coordinator";
import { createOfflineCodeV2Lifecycle, type OfflineCodeV2LifecycleSource } from "./offline-code-v2-lifecycle";
import type { OfflineCodeV2ProofInput } from "./offline-code-v2-proof-core";
import { createOfflineCodeV2PlatformProofProducer } from "./offline-code-v2-proof-producer";

const unavailable = { name: "OfflineCodeV2UnavailableError", message: "Offline-code request is unavailable." };
const success = { status: "proof_verified", authority: "route_possession_only", route_possession_asserted: true,
  identity_verified: false, claim_created: false, release_authorized: false } as const;
type Options = Parameters<typeof createOfflineCodeV2Lifecycle>[0];

describe("offline-code V2 lifecycle composition", () => {
  it("does not read adapters, configuration, or lifecycle when disabled", async () => {
    const touched = vi.fn(() => { throw new Error("private adapter detail"); });
    const options = Object.defineProperties({}, Object.fromEntries([
      "syntheticOnly", "productionRuntime", "apiOrigin", "claimantOrigin", "send", "producer", "lifecycle", "now",
    ].map((key) => [key, { get: touched }]))) as Options;
    const runtime = createOfflineCodeV2Lifecycle(options);
    await expect(runtime.start({} as OfflineCodeV2SyntheticAttempt)).rejects.toMatchObject(unavailable);
    await expect(runtime.retryProof()).rejects.toMatchObject(unavailable);
    runtime.cancel(); runtime.dispose();
    expect(runtime.snapshot().status).toBe("disabled"); expect(touched).not.toHaveBeenCalled();
  });

  it.each([
    { syntheticOnly: false }, { productionRuntime: true }, { apiOrigin: "http://api.test" },
    { claimantOrigin: "https://example.test/path" }, { send: undefined }, { producer: {} },
  ])("fails closed before subscription for invalid composition %j", async (overrides) => {
    const h = harness(); const runtime = h.create(overrides as Partial<Options>);
    await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(runtime.snapshot().status).toBe("closed");
    expect(h.subscribe).not.toHaveBeenCalled(); expect(h.send).not.toHaveBeenCalled();
  });

  it("composes the real local proof producer and exact transport while exposing only a value-free snapshot", async () => {
    const h = harness();
    const runtime = h.create({ producer: createOfflineCodeV2PlatformProofProducer(true) });
    expect(runtime.snapshot().status).toBe("ready"); expect(h.send).not.toHaveBeenCalled();
    await expect(runtime.start(h.attempt)).resolves.toEqual(success);
    expect(runtime.snapshot()).toEqual({ status: "completed", identity_verified: false,
      claim_created: false, release_authorized: false });
    expect(Object.isFrozen(runtime.snapshot())).toBe(true); expect(Object.isFrozen(runtime)).toBe(true);
    const body = JSON.parse(String(h.send.mock.calls[1][1]?.body));
    expect(body.possession_proof.signature === h.fixture.possession_proof.signature).toBe(true);
    for (const [, request] of h.send.mock.calls) {
      expect(String(request?.body)).not.toContain(h.attempt.clientSecret.secret);
      expect(new Headers(request?.headers).has("authorization")).toBe(false);
    }
    runtime.dispose(); expect(h.cleanup).toHaveBeenCalledOnce();
  });

  it.each(["inactive", "background"])("requires foreground before any work after initial %s", async (state) => {
    const h = harness({ sequence: 0, state }); const runtime = h.create();
    await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(runtime.retryProof()).rejects.toMatchObject(unavailable);
    expect(runtime.snapshot().status).toBe("suspended"); expect(h.send).not.toHaveBeenCalled();
    h.emit({ sequence: 1, state: "foreground" });
    expect(runtime.snapshot().status).toBe("ready"); expect(h.send).not.toHaveBeenCalled();
    await expect(runtime.start(h.attempt)).resolves.toEqual(success); runtime.dispose();
  });

  it.each(["locked", "session_ended", "disabled"])("treats %s as terminal, including during synchronous subscription", async (state) => {
    for (const duringSubscription of [false, true]) {
      const h = harness({ sequence: 0, state: duringSubscription ? state : "foreground" });
      const runtime = h.create();
      if (!duringSubscription) h.emit({ sequence: 1, state });
      expect(h.cleanup).toHaveBeenCalledOnce();
      h.emit({ sequence: 2, state: "foreground" });
      await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
      await expect(runtime.retryProof()).rejects.toMatchObject(unavailable);
      expect(runtime.snapshot().status).toBe("closed"); expect(h.send).not.toHaveBeenCalled();
      runtime.dispose(); expect(h.cleanup).toHaveBeenCalledOnce();
    }
  });

  it("requires a synchronous initial event and a working cleanup contract", async () => {
    for (const mode of ["no-event", "throws", "no-cleanup"]) {
      const h = harness(); const runtime = h.create({ lifecycle: { subscribe(listener) {
        if (mode === "throws") throw new Error("private source detail");
        if (mode === "no-cleanup") { listener({ sequence: 0, state: "foreground" }); return undefined as never; }
        return h.cleanup;
      } } });
      await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
      expect(runtime.snapshot().status).toBe("closed"); expect(h.send).not.toHaveBeenCalled();
      if (mode === "no-event") expect(h.cleanup).toHaveBeenCalledOnce();
    }
  });

  it.each([null, {}, { sequence: -1, state: "foreground" }, { sequence: 1.5, state: "foreground" },
    { sequence: Number.MAX_SAFE_INTEGER + 1, state: "foreground" }, { sequence: 1, state: "unknown" },
    { sequence: 1, state: "foreground", accountId: "private" }])("closes on malformed lifecycle event %j", async (event) => {
    const h = harness(); const runtime = h.create(); h.emit(event);
    expect(runtime.snapshot().status).toBe("closed"); expect(h.cleanup).toHaveBeenCalledOnce();
    await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.send).not.toHaveBeenCalled();
  });

  it("accepts identical event replay but closes on rollback or same-sequence divergence", async () => {
    const h = harness({ sequence: 4, state: "foreground" }); const runtime = h.create();
    h.emit({ sequence: 4, state: "foreground" });
    await expect(runtime.start(h.attempt)).resolves.toEqual(success);
    h.emit({ sequence: 5, state: "foreground" });
    expect(runtime.snapshot().status).toBe("completed");
    h.emit({ sequence: 4, state: "foreground" }); expect(runtime.snapshot().status).toBe("closed");
    const alternate = harness(); const other = alternate.create();
    alternate.emit({ sequence: 0, state: "background" }); expect(other.snapshot().status).toBe("closed");
  });

  it.each(["challenge", "produce", "proof"] as const)("suppresses late %s completion after background then foreground", async (stage) => {
    const h = harness(); const pending = deferred<never>();
    if (stage === "challenge") h.send.mockReturnValueOnce(pending.promise);
    if (stage === "produce") h.produce.mockReturnValueOnce(pending.promise);
    if (stage === "proof") h.send.mockImplementationOnce(async () => h.response(false)).mockReturnValueOnce(pending.promise);
    const runtime = h.create();
    const result = expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    await vi.waitFor(() => expect(stage === "produce" ? h.produce : h.send).toHaveBeenCalledTimes(stage === "proof" ? 2 : 1));
    h.emit({ sequence: 1, state: "background" }); expect(runtime.snapshot().status).toBe("suspended");
    h.emit({ sequence: 2, state: "foreground" });
    expect(runtime.snapshot().status).toBe("working");
    await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    pending.resolve((stage === "produce" ? h.fixture.possession_proof : h.response(stage === "proof")) as never);
    await result;
    expect(runtime.snapshot().status).toBe("ready");
    await expect(runtime.retryProof()).rejects.toMatchObject(unavailable);
    expect(h.send).toHaveBeenCalledTimes(stage === "proof" ? 2 : 1);
    runtime.dispose();
  });

  it("retains bounded replay only within one foreground scope and clears it on leaving", async () => {
    const h = harness(); h.send.mockImplementationOnce(async () => h.response(false))
      .mockRejectedValueOnce(new Error("ambiguous response"));
    const runtime = h.create();
    await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(runtime.snapshot().status).toBe("unavailable");
    await expect(runtime.retryProof()).resolves.toEqual(success);
    expect(h.produce).toHaveBeenCalledOnce();
    expect(h.send.mock.calls[1][1]?.body === h.send.mock.calls[2][1]?.body).toBe(true);
    runtime.dispose();

    const ended = harness(); ended.send.mockImplementationOnce(async () => ended.response(false))
      .mockRejectedValueOnce(new Error("ambiguous response"));
    const other = ended.create(); await expect(other.start(ended.attempt)).rejects.toMatchObject(unavailable);
    ended.emit({ sequence: 1, state: "inactive" }); ended.emit({ sequence: 2, state: "foreground" });
    await expect(other.retryProof()).rejects.toMatchObject(unavailable);
    expect(ended.send).toHaveBeenCalledTimes(2); other.dispose();
  });

  it("cancels pending replay explicitly and prevents concurrent operations", async () => {
    const h = harness(); const wait = deferred<OfflineCodePossessionProofV2>(); h.produce.mockReturnValueOnce(wait.promise);
    const runtime = h.create(); const result = expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    await vi.waitFor(() => expect(h.produce).toHaveBeenCalledOnce());
    await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(runtime.retryProof()).rejects.toMatchObject(unavailable);
    runtime.cancel(); wait.resolve(h.fixture.possession_proof); await result;
    expect(runtime.snapshot().status).toBe("ready");
    await expect(runtime.retryProof()).rejects.toMatchObject(unavailable);
    expect(h.send).toHaveBeenCalledOnce(); runtime.dispose();
  });

  it("disposes during cryptographic work, waits for it to settle, and ignores subsequent events", async () => {
    const h = harness(); const wait = deferred<OfflineCodePossessionProofV2>(); h.produce.mockReturnValueOnce(wait.promise);
    const runtime = h.create(); const result = expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    await vi.waitFor(() => expect(h.produce).toHaveBeenCalledOnce());
    let settled = false;
    const disposal = runtime.dispose().then(() => { settled = true; });
    const secondDisposal = runtime.dispose(); h.emit({ sequence: 1, state: "foreground" });
    expect(runtime.snapshot().status).toBe("closed"); expect(h.cleanup).toHaveBeenCalledOnce();
    await Promise.resolve(); expect(settled).toBe(false);
    wait.resolve(h.fixture.possession_proof); await result;
    await disposal; await secondDisposal; expect(settled).toBe(true);
    await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.send).toHaveBeenCalledOnce();
  });

  it("handles teardown reentered from a transport adapter without missing its in-flight completion", async () => {
    const h = harness(); let disposal: Promise<void> | undefined;
    const runtime = h.create();
    h.send.mockImplementationOnce(async () => { disposal = runtime.dispose(); return h.response(false); });
    await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    await disposal;
    expect(runtime.snapshot().status).toBe("closed"); expect(h.cleanup).toHaveBeenCalledOnce();
    expect(h.produce).not.toHaveBeenCalled();
  });

  it("keeps cleanup failure and late source callbacks generic and terminal", async () => {
    const h = harness(); h.cleanup.mockImplementation(() => { throw new Error("private cleanup detail"); });
    const runtime = h.create(); expect(() => runtime.dispose()).not.toThrow();
    h.emit({ sequence: 9, state: "foreground" });
    await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(JSON.stringify(runtime.snapshot())).not.toContain("private"); expect(h.cleanup).toHaveBeenCalledOnce();
  });

  it("clears completed display state on background and never submits work just from a foreground event", async () => {
    const h = harness(); const runtime = h.create(); await runtime.start(h.attempt);
    h.emit({ sequence: 1, state: "background" }); expect(runtime.snapshot().status).toBe("suspended");
    h.emit({ sequence: 2, state: "foreground" }); expect(runtime.snapshot().status).toBe("ready");
    expect(h.send).toHaveBeenCalledTimes(2); runtime.dispose();
  });

  it("snapshots injected adapter methods and does not rebind a live scope", async () => {
    const h = harness(); const options = h.options(); const runtime = createOfflineCodeV2Lifecycle(options);
    options.send = vi.fn(); options.producer.produce = vi.fn(); options.apiOrigin = "https://hostile.test";
    await expect(runtime.start(h.attempt)).resolves.toEqual(success);
    expect(h.send).toHaveBeenCalledTimes(2); expect(h.produce).toHaveBeenCalledOnce(); runtime.dispose();
  });

  it("keeps malformed proof responses generic and preserves all authority denials", async () => {
    const h = harness(); h.send.mockImplementationOnce(async () => h.response(false))
      .mockImplementationOnce(async () => h.json({ result: { ...success, release_authorized: true } }));
    const runtime = h.create(); await expect(runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(runtime.snapshot()).toEqual({ status: "unavailable", identity_verified: false,
      claim_created: false, release_authorized: false }); runtime.dispose();
  });
});

function harness(initial: unknown = { sequence: 0, state: "foreground" }) {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(),
    "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as {
      public_locator: OfflineCodeV2SyntheticAttempt["publicLocator"];
      synthetic_client_secret: OfflineCodeV2SyntheticAttempt["clientSecret"];
      kdf_profile: OfflineCodeV2SyntheticAttempt["kdfProfile"];
      record_binding: OfflineCodeV2SyntheticAttempt["recordBinding"];
      challenge: OfflineCodeChallengeV2; possession_proof: OfflineCodePossessionProofV2;
    };
  const attempt: OfflineCodeV2SyntheticAttempt = { syntheticOnly: true, publicLocator: fixture.public_locator,
    clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile, recordBinding: fixture.record_binding,
    challengeIdempotencyKey: "40000000-0000-4000-8000-000000000081",
    proofIdempotencyKey: "40000000-0000-4000-8000-000000000082" };
  let listener: (event: unknown) => void = () => undefined;
  const cleanup = vi.fn();
  const subscribe = vi.fn<OfflineCodeV2LifecycleSource["subscribe"]>((callback) => { listener = callback; callback(initial); return cleanup; });
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: {
    "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": fixture.challenge.origin,
  } });
  const response = (proof: boolean) => json({ result: proof ? success : {
    status: "challenge_issued", authority: "route_possession_only", challenge: fixture.challenge,
    challenge_bytes_base64url: Buffer.from(canonicalJson(fixture.challenge as never)).toString("base64url"),
    kdf_profile: fixture.kdf_profile, identity_verified: false, claim_created: false, release_authorized: false,
  } });
  const send = vi.fn<typeof fetch>(async (url) => response(String(url).endsWith("/proofs")));
  const produce = vi.fn(async (_value: OfflineCodeV2ProofInput) => fixture.possession_proof);
  const options = () => ({ approved: true, syntheticOnly: true as const, productionRuntime: false as const,
    apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin, send,
    producer: { produce }, lifecycle: { subscribe }, now: () => new Date(Date.parse(fixture.challenge.issued_at) + 1_000) });
  const create = (overrides: Partial<Options> = {}) => createOfflineCodeV2Lifecycle({ ...options(), ...overrides });
  return { fixture, attempt, send, produce, cleanup, subscribe, response, json, options, create,
    emit: (event: unknown) => listener(event) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
