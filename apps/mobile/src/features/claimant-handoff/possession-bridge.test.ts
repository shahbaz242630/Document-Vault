import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { OfflineCodeV2SyntheticAttempt } from "../claimant-offline-code/offline-code-v2-coordinator";
import { completion, id, session, signature, transcript } from "./fixtures.test";
import { createPossessionHandoffBridge } from "./possession-bridge";
import type { HandoffSend } from "./transport";

const unavailable = { name: "HandoffUnavailableError", message: "Offline-code handoff is unavailable." };
type Options = Parameters<typeof createPossessionHandoffBridge>[0];

function harness() {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(),
    "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as {
      public_locator: OfflineCodeV2SyntheticAttempt["publicLocator"];
      synthetic_client_secret: OfflineCodeV2SyntheticAttempt["clientSecret"];
      kdf_profile: OfflineCodeV2SyntheticAttempt["kdfProfile"];
      record_binding: OfflineCodeV2SyntheticAttempt["recordBinding"];
      challenge: OfflineCodeChallengeV2; possession_proof: OfflineCodePossessionProofV2;
    };
  const time = Date.parse(fixture.challenge.issued_at) + 1_000;
  const currentSession = { ...session, assuredAt: time, expiresAt: time + 600_000 };
  let listener: (event: unknown) => void = () => undefined;
  const cleanup = vi.fn();
  const lifecycle = { subscribe: vi.fn((next: (event: unknown) => void) => {
    listener = next; next({ sequence: 0, state: "foreground" }); return cleanup;
  }) };
  const proofResult = { status: "proof_verified", authority: "route_possession_only",
    route_possession_asserted: true, identity_verified: false, claim_created: false, release_authorized: false };
  const possessionResponse = (proof: boolean, result: unknown = proofResult) => Response.json({ result: proof ? result : {
    status: "challenge_issued", authority: "route_possession_only", challenge: fixture.challenge,
    challenge_bytes_base64url: Buffer.from(canonicalJson(fixture.challenge as never)).toString("base64url"),
    kdf_profile: fixture.kdf_profile, identity_verified: false, claim_created: false, release_authorized: false,
  } }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": fixture.challenge.origin } });
  const possessionSend = vi.fn<typeof fetch>(async (url) => possessionResponse(String(url).endsWith("/proofs")));
  const sourceTranscript = { ...transcript, claimant_user_id: currentSession.userId,
    portal_session_id: currentSession.sessionId, portal_session_version: currentSession.sessionVersion,
    source_challenge_id: fixture.challenge.challenge_id,
    record_binding_digest: fixture.challenge.record_binding_digest, expires_at_epoch: (time + 120_000) / 1000 };
  const issued = { handoff_id: id(6), transcript_bytes_base64url: Buffer.from(JSON.stringify(sourceTranscript)).toString("base64url"),
    expires_at: new Date(time + 120_000).toISOString(), authority: "route_possession_only",
    identity_verified: false, claim_created: false, release_authorized: false };
  const handoffResponse = (result: unknown) => Response.json({ result }, { headers: {
    "Cache-Control": "private, no-store", "Access-Control-Allow-Origin": fixture.challenge.origin,
    "X-Robots-Tag": "noindex, nofollow" } });
  const handoffSend = vi.fn<HandoffSend>(async (url) => handoffResponse(url.endsWith("/issue") ? issued : completion));
  const producer = { produce: vi.fn(async () => fixture.possession_proof) };
  const signer = { syntheticOnly: true as const, sign: vi.fn(async () => signature) };
  const getSession = vi.fn(() => currentSession);
  const possession = { syntheticOnly: true as const, publicLocator: fixture.public_locator,
    clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile,
    recordBinding: fixture.record_binding, challengeIdempotencyKey: id(81), proofIdempotencyKey: id(82) };
  const attempt = { possession, issueIdempotencyKey: id(83), completionIdempotencyKey: id(84) };
  const options: Options = { approved: true, syntheticOnly: true, productionRuntime: false,
    apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin,
    possessionSend, handoffSend, producer, signer, getSession, lifecycle, now: () => time };
  return { fixture, time, attempt, options, cleanup, possessionSend, handoffSend, producer, signer,
    getSession, currentSession, possessionResponse, handoffResponse, issued,
    emit: (event: unknown) => listener(event) };
}

describe("synthetic possession to authenticated handoff bridge", () => {
  it("is dormant by default without reading any adapter", async () => {
    const touched = vi.fn(() => { throw new Error("private adapter detail"); });
    const options = Object.defineProperties({}, Object.fromEntries(["syntheticOnly", "productionRuntime",
      "apiOrigin", "claimantOrigin", "possessionSend", "handoffSend", "producer", "signer",
      "getSession", "lifecycle", "now"].map((key) => [key, { get: touched }]))) as Options;
    const bridge = createPossessionHandoffBridge(options);
    await expect(bridge.start({} as never)).rejects.toMatchObject(unavailable);
    expect(bridge.snapshot().status).toBe("disabled"); expect(touched).not.toHaveBeenCalled();
  });

  it("hands only the verified source challenge into a session-bound draft", async () => {
    const h = harness(); const bridge = createPossessionHandoffBridge(h.options);
    expect(bridge.snapshot().status).toBe("ready");
    await expect(bridge.start(h.attempt)).resolves.toEqual(completion);
    expect(h.handoffSend).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(h.handoffSend.mock.calls[0][1]?.body))).toEqual({ challengeId: h.fixture.challenge.challenge_id });
    expect(h.signer.sign).toHaveBeenCalledWith(expect.objectContaining({
      challengeId: h.fixture.challenge.challenge_id,
      recordBindingDigest: h.fixture.challenge.record_binding_digest }));
    expect(bridge.snapshot()).toEqual({ status: "completed", identity_verified: false,
      claim_created: false, release_authorized: false });
    for (const [, request] of h.possessionSend.mock.calls) {
      expect(String(request?.body)).not.toContain(h.attempt.possession.clientSecret.secret);
      expect(new Headers(request?.headers).has("authorization")).toBe(false);
    }
    await bridge.dispose(); expect(h.cleanup).toHaveBeenCalledOnce();
  });

  it("never issues handoff for a malformed or unverified proof response", async () => {
    const h = harness(); h.possessionSend.mockImplementationOnce(async () => h.possessionResponse(false))
      .mockImplementationOnce(async () => h.possessionResponse(true, {
        status: "proof_verified", authority: "route_possession_only", route_possession_asserted: false,
        identity_verified: false, claim_created: false, release_authorized: false }));
    const bridge = createPossessionHandoffBridge(h.options);
    await expect(bridge.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.handoffSend).not.toHaveBeenCalled(); await bridge.dispose();
  });

  it("fails before handoff when the claimant session changes during proof", async () => {
    const h = harness(); h.possessionSend.mockImplementationOnce(async () => h.possessionResponse(false))
      .mockImplementationOnce(async () => {
        h.currentSession.sessionId = id(99); return h.possessionResponse(true);
      });
    const bridge = createPossessionHandoffBridge(h.options);
    await expect(bridge.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.handoffSend).not.toHaveBeenCalled();
    h.currentSession.sessionId = session.sessionId;
    await expect(bridge.retryProof()).rejects.toMatchObject(unavailable);
    expect(bridge.snapshot().status).toBe("closed"); await bridge.dispose();
  });

  it("discards the verified proof after background and never starts handoff on resume", async () => {
    const h = harness(); h.possessionSend.mockImplementationOnce(async () => h.possessionResponse(false))
      .mockImplementationOnce(async () => {
        h.emit({ sequence: 1, state: "background" });
        h.emit({ sequence: 2, state: "foreground" });
        return h.possessionResponse(true);
      });
    const bridge = createPossessionHandoffBridge(h.options);
    await expect(bridge.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.handoffSend).not.toHaveBeenCalled(); expect(bridge.snapshot().status).toBe("ready");
    await expect(bridge.retryProof()).rejects.toMatchObject(unavailable); await bridge.dispose();
  });

  it("retries the exact public proof then completes without reproving possession", async () => {
    const h = harness(); h.possessionSend.mockImplementationOnce(async () => h.possessionResponse(false))
      .mockRejectedValueOnce(new Error("lost proof response"));
    const bridge = createPossessionHandoffBridge(h.options);
    await expect(bridge.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(bridge.retryProof()).resolves.toEqual(completion);
    expect(h.producer.produce).toHaveBeenCalledOnce();
    expect(h.possessionSend.mock.calls[1][1]?.body).toBe(h.possessionSend.mock.calls[2][1]?.body);
    await bridge.dispose();
  });

  it("retries an ambiguous completion under the same session", async () => {
    const h = harness(); h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockRejectedValueOnce(new Error("lost completion response"));
    const bridge = createPossessionHandoffBridge(h.options);
    await expect(bridge.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(bridge.retryCompletion()).resolves.toEqual(completion);
    expect(h.producer.produce).toHaveBeenCalledOnce(); expect(h.signer.sign).toHaveBeenCalledOnce();
    expect(h.handoffSend.mock.calls[1][1]?.body).toBe(h.handoffSend.mock.calls[2][1]?.body);
    await bridge.dispose();
  });

  it("clears a pending completion when the session rotates, even if it later reverts", async () => {
    const h = harness(); h.handoffSend.mockImplementationOnce(async () => h.handoffResponse(h.issued))
      .mockRejectedValueOnce(new Error("lost completion response"));
    const bridge = createPossessionHandoffBridge(h.options);
    await expect(bridge.start(h.attempt)).rejects.toMatchObject(unavailable);
    h.currentSession.sessionVersion += 1;
    await expect(bridge.retryCompletion()).rejects.toMatchObject(unavailable);
    h.currentSession.sessionVersion -= 1;
    await expect(bridge.retryCompletion()).rejects.toMatchObject(unavailable);
    expect(h.handoffSend).toHaveBeenCalledTimes(2); expect(bridge.snapshot().status).toBe("closed");
    await bridge.dispose();
  });

  it("requires synchronous foreground establishment and closes on terminal events", async () => {
    const h = harness(); const absent = createPossessionHandoffBridge({ ...h.options,
      lifecycle: { subscribe: () => h.cleanup } });
    await expect(absent.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(absent.snapshot().status).toBe("closed");
    const bridge = createPossessionHandoffBridge(h.options);
    h.emit({ sequence: 1, state: "locked" }); h.emit({ sequence: 2, state: "foreground" });
    await expect(bridge.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(bridge.snapshot().status).toBe("closed"); expect(h.possessionSend).not.toHaveBeenCalled();
  });
});
