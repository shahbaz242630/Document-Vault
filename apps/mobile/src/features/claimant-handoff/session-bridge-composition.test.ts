import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { OfflineCodeV2SyntheticAttempt } from "../claimant-offline-code/offline-code-v2-coordinator";
import { completion, id, session as baseSession, signature, transcript } from "./fixtures.test";
import { createClaimantSessionBridgeComposition } from "./session-bridge-composition";
import type { HandoffSend } from "./transport";

const unavailable = { name: "HandoffUnavailableError", message: "Offline-code handoff is unavailable." };
type Options = Parameters<typeof createClaimantSessionBridgeComposition>[0];

function harness() {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(),
    "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as {
      public_locator: OfflineCodeV2SyntheticAttempt["publicLocator"];
      synthetic_client_secret: OfflineCodeV2SyntheticAttempt["clientSecret"];
      kdf_profile: OfflineCodeV2SyntheticAttempt["kdfProfile"];
      record_binding: OfflineCodeV2SyntheticAttempt["recordBinding"];
      challenge: OfflineCodeChallengeV2;
      possession_proof: OfflineCodePossessionProofV2;
    };
  let time = Date.parse(fixture.challenge.issued_at) + 1_000;
  const currentSession = { ...baseSession, assuredAt: time, expiresAt: time + 600_000 };
  let sessionListener: (value: unknown) => void = () => undefined;
  let lifecycleListener: (value: unknown) => void = () => undefined;
  const sessionCleanup = vi.fn();
  const lifecycleCleanup = vi.fn();
  const sessionSource = { syntheticOnly: true as const, subscribe: vi.fn((listener: (value: unknown) => void) => {
    sessionListener = listener; listener(currentSession); return sessionCleanup;
  }) };
  const lifecycle = { subscribe: vi.fn((listener: (value: unknown) => void) => {
    lifecycleListener = listener; listener({ sequence: 0, state: "foreground" }); return lifecycleCleanup;
  }) };
  const proofResult = { status: "proof_verified", authority: "route_possession_only",
    route_possession_asserted: true, identity_verified: false, claim_created: false, release_authorized: false };
  const possessionResponse = (proof: boolean) => Response.json({ result: proof ? proofResult : {
    status: "challenge_issued", authority: "route_possession_only", challenge: fixture.challenge,
    challenge_bytes_base64url: Buffer.from(canonicalJson(fixture.challenge as never)).toString("base64url"),
    kdf_profile: fixture.kdf_profile, identity_verified: false, claim_created: false, release_authorized: false,
  } }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": fixture.challenge.origin } });
  const possessionSend = vi.fn<typeof fetch>(async (url) => possessionResponse(String(url).endsWith("/proofs")));
  const sourceTranscript = { ...transcript, claimant_user_id: currentSession.userId,
    portal_session_id: currentSession.sessionId, portal_session_version: currentSession.sessionVersion,
    source_challenge_id: fixture.challenge.challenge_id,
    record_binding_digest: fixture.challenge.record_binding_digest, expires_at_epoch: (time + 120_000) / 1000 };
  const issued = { handoff_id: id(6),
    transcript_bytes_base64url: Buffer.from(JSON.stringify(sourceTranscript)).toString("base64url"),
    expires_at: new Date(time + 120_000).toISOString(), authority: "route_possession_only",
    identity_verified: false, claim_created: false, release_authorized: false };
  const handoffResponse = (result: unknown) => Response.json({ result }, { headers: {
    "Cache-Control": "private, no-store", "Access-Control-Allow-Origin": fixture.challenge.origin,
    "X-Robots-Tag": "noindex, nofollow" } });
  const handoffSend = vi.fn<HandoffSend>(async (url) => handoffResponse(url.endsWith("/issue") ? issued : completion));
  const producer = { produce: vi.fn(async () => fixture.possession_proof) };
  const signer = { syntheticOnly: true as const, sign: vi.fn(async () => signature) };
  const possession = { syntheticOnly: true as const, publicLocator: fixture.public_locator,
    clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile,
    recordBinding: fixture.record_binding, challengeIdempotencyKey: id(91), proofIdempotencyKey: id(92) };
  const attempt = { possession, issueIdempotencyKey: id(93), completionIdempotencyKey: id(94) };
  const options: Options = { approved: true, syntheticOnly: true, productionRuntime: false,
    session: sessionSource, lifecycle, now: () => time, bridge: {
      apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin,
      possessionSend, handoffSend, producer, signer } };
  return { options, attempt, currentSession, sessionCleanup, lifecycleCleanup, possessionSend,
    handoffSend, producer, signer, issued, possessionResponse, handoffResponse,
    emitSession: (value: unknown) => sessionListener(value),
    emitLifecycle: (value: unknown) => lifecycleListener(value),
    advance: (milliseconds: number) => { time += milliseconds; } };
}

describe("synthetic claimant session to possession bridge composition", () => {
  it("is dormant by default without reading any dependency", async () => {
    const touched = vi.fn(() => { throw new Error("private adapter detail"); });
    const options = Object.defineProperties({}, Object.fromEntries(["syntheticOnly", "productionRuntime",
      "session", "lifecycle", "bridge", "now"].map((key) => [key, { get: touched }]))) as Options;
    const composition = createClaimantSessionBridgeComposition(options);
    await expect(composition.start({} as never)).rejects.toMatchObject(unavailable);
    expect(composition.snapshot().status).toBe("disabled");
    expect(touched).not.toHaveBeenCalled();
  });

  it("reduces a completed handoff to a value-free frozen draft", async () => {
    const h = harness();
    const composition = createClaimantSessionBridgeComposition(h.options);
    const result = await composition.start(h.attempt);
    expect(result).toEqual({ state: "draft", route_profile: "offline_code_v2", case_version: 1,
      claimant_session_bound: true, case_created: true, identity_verified: false,
      relationship_verified: false, intake_started: false, review_started: false,
      release_authorized: false });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(completion.case_id);
    expect(composition.snapshot()).toEqual({ status: "draft", draft_available: true,
      identity_verified: false, release_authorized: false });
    await expect(composition.start(h.attempt)).rejects.toMatchObject(unavailable);
    await composition.dispose();
  });

  it("fails closed unless session and foreground state are established synchronously", async () => {
    const h = harness();
    const noSession = createClaimantSessionBridgeComposition({ ...h.options,
      session: { syntheticOnly: true, subscribe: () => h.sessionCleanup } });
    expect(noSession.snapshot().status).toBe("closed");
    await expect(noSession.start(h.attempt)).rejects.toMatchObject(unavailable);
    const noLifecycle = createClaimantSessionBridgeComposition({ ...h.options,
      lifecycle: { subscribe: () => h.lifecycleCleanup } });
    expect(noLifecycle.snapshot().status).toBe("closed");
  });

  it("closes permanently when the bound session changes, even if it reverts", async () => {
    const h = harness();
    const composition = createClaimantSessionBridgeComposition(h.options);
    h.emitSession({ ...h.currentSession, sessionVersion: 2 });
    h.emitSession(h.currentSession);
    await expect(composition.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(composition.snapshot().status).toBe("closed");
    expect(h.sessionCleanup).toHaveBeenCalledOnce();
    expect(h.lifecycleCleanup).toHaveBeenCalledOnce();
  });

  it("rejects stale session state before adapter work", async () => {
    const h = harness();
    const composition = createClaimantSessionBridgeComposition(h.options);
    h.advance(600_001);
    await expect(composition.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(composition.snapshot().status).toBe("closed");
    expect(h.possessionSend).not.toHaveBeenCalled();
  });

  it("cancels on background and suppresses a late draft after resume", async () => {
    const h = harness();
    let finish!: (value: Response) => void;
    h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const composition = createClaimantSessionBridgeComposition(h.options);
    const pending = composition.start(h.attempt);
    await vi.waitFor(() => expect(h.handoffSend).toHaveBeenCalledTimes(2));
    h.emitLifecycle({ sequence: 1, state: "background" });
    h.emitLifecycle({ sequence: 2, state: "foreground" });
    finish(h.handoffResponse(completion));
    await expect(pending).rejects.toMatchObject(unavailable);
    expect(composition.snapshot()).toEqual({ status: "ready", draft_available: false,
      identity_verified: false, release_authorized: false });
    await expect(composition.retryCompletion()).rejects.toMatchObject(unavailable);
    await composition.dispose();
  });

  it("delegates only an exact completion retry in the unchanged scope", async () => {
    const h = harness();
    h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockRejectedValueOnce(new Error("lost response"));
    const composition = createClaimantSessionBridgeComposition(h.options);
    await expect(composition.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(composition.retryCompletion()).resolves.toMatchObject({ state: "draft" });
    expect(h.producer.produce).toHaveBeenCalledOnce();
    expect(h.signer.sign).toHaveBeenCalledOnce();
    expect(h.handoffSend.mock.calls[1][1]?.body).toBe(h.handoffSend.mock.calls[2][1]?.body);
    await composition.dispose();
  });

  it("delegates only an exact proof retry without reproducing possession", async () => {
    const h = harness();
    h.possessionSend.mockImplementationOnce(async () => h.possessionResponse(false))
      .mockRejectedValueOnce(new Error("lost proof response"));
    const composition = createClaimantSessionBridgeComposition(h.options);
    await expect(composition.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(composition.retryProof()).resolves.toMatchObject({ state: "draft" });
    expect(h.producer.produce).toHaveBeenCalledOnce();
    expect(h.possessionSend.mock.calls[1][1]?.body).toBe(h.possessionSend.mock.calls[2][1]?.body);
    await composition.dispose();
  });

  it("explicit cancellation clears retry and suppresses late completion", async () => {
    const h = harness();
    let finish!: (value: Response) => void;
    h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const composition = createClaimantSessionBridgeComposition(h.options);
    const pending = composition.start(h.attempt);
    await vi.waitFor(() => expect(h.handoffSend).toHaveBeenCalledTimes(2));
    composition.cancel();
    finish(h.handoffResponse(completion));
    await expect(pending).rejects.toMatchObject(unavailable);
    expect(composition.snapshot()).toEqual({ status: "ready", draft_available: false,
      identity_verified: false, release_authorized: false });
    await expect(composition.retryCompletion()).rejects.toMatchObject(unavailable);
    await composition.dispose();
  });

  it("closes on regressing or terminal lifecycle events", async () => {
    const first = harness();
    const regressing = createClaimantSessionBridgeComposition(first.options);
    first.emitLifecycle({ sequence: 1, state: "background" });
    first.emitLifecycle({ sequence: 0, state: "foreground" });
    expect(regressing.snapshot().status).toBe("closed");
    const second = harness();
    const terminal = createClaimantSessionBridgeComposition(second.options);
    second.emitLifecycle({ sequence: 1, state: "locked" });
    second.emitLifecycle({ sequence: 2, state: "foreground" });
    await expect(terminal.start(second.attempt)).rejects.toMatchObject(unavailable);
    expect(terminal.snapshot().status).toBe("closed");
  });
});
