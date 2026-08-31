import { createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { createOfflineCodeV2Coordinator, type OfflineCodeV2SyntheticAttempt } from "./offline-code-v2-coordinator";
import type { OfflineCodeV2ProofInput } from "./offline-code-v2-proof-core";
import { createOfflineCodeV2PlatformProofProducer } from "./offline-code-v2-proof-producer";
import { createOfflineCodeV2Transport, OfflineCodeV2UnavailableError,
  type OfflineCodeV2IssuedChallenge, type OfflineCodeV2ProofRequest } from "./offline-code-v2-transport";

const unavailable = { name: "OfflineCodeV2UnavailableError", message: "Offline-code request is unavailable." };
const success = { status: "proof_verified", authority: "route_possession_only", route_possession_asserted: true,
  identity_verified: false, claim_created: false, release_authorized: false } as const;

describe("offline-code V2 synthetic coordinator", () => {
  it("is disabled before dependencies run", async () => {
    const h = harness(false);
    await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(h.coordinator.retryProof()).rejects.toMatchObject(unavailable);
    expect(h.issueChallenge).not.toHaveBeenCalled(); expect(h.produce).not.toHaveBeenCalled();
    expect(h.verifyProof).not.toHaveBeenCalled();
  });

  it("connects real local crypto to the transport wire contract and verifies the resulting signature", async () => {
    const h = harness();
    const send = vi.fn<typeof fetch>(async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).endsWith("/proofs")) {
        const proof = body.possession_proof as OfflineCodePossessionProofV2;
        const publicKey = createPublicKey({ format: "der", type: "spki", key: Buffer.concat([
          Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(proof.proof_public_key, "base64url"),
        ]) });
        const bytes = Buffer.from(canonicalJson({ protocol: "sanduqkin:claim:offline-code:v2",
          purpose: "possession_proof", label: "sanduqkin:claim:offline-code:v2:possession-proof", challenge: body.challenge }));
        expect(verify(null, bytes, publicKey, Buffer.from(proof.signature, "base64url"))).toBe(true);
        expect(proof.signature === h.fixture.possession_proof.signature).toBe(true);
      }
      return new Response(JSON.stringify({ result: String(url).endsWith("/proofs") ? success : {
        status: "challenge_issued", authority: "route_possession_only", challenge: h.issued.challenge,
        challenge_bytes_base64url: h.issued.challengeBytesBase64url, kdf_profile: h.issued.kdfProfile,
        identity_verified: false, claim_created: false, release_authorized: false,
      } }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": h.fixture.challenge.origin } });
    });
    const coordinator = createOfflineCodeV2Coordinator({ approved: true, claimantOrigin: h.fixture.challenge.origin,
      now: h.now, producer: createOfflineCodeV2PlatformProofProducer(true),
      transport: createOfflineCodeV2Transport({ approved: true, apiOrigin: "https://api.sanduqkin.test",
        claimantOrigin: h.fixture.challenge.origin, send }) });
    await expect(coordinator.start(h.attempt)).resolves.toEqual(success);
    expect(send).toHaveBeenCalledTimes(2);
    for (const [, init] of send.mock.calls) expect(String(init?.body)).not.toContain(h.attempt.clientSecret.secret);
    await expect(coordinator.retryProof()).rejects.toMatchObject(unavailable);
  });

  it("rejects non-synthetic inputs, KDF changes, key reuse, and invalid material before transport", async () => {
    const mutations = [
      (a: OfflineCodeV2SyntheticAttempt) => ({ ...a, syntheticOnly: false }),
      (a: OfflineCodeV2SyntheticAttempt) => ({ ...a, kdfProfile: { ...a.kdfProfile, production_approved: true } }),
      (a: OfflineCodeV2SyntheticAttempt) => ({ ...a, proofIdempotencyKey: a.challengeIdempotencyKey }),
      (a: OfflineCodeV2SyntheticAttempt) => ({ ...a, publicLocator: { ...a.publicLocator, locator: "SK1-legacy" } }),
      (a: OfflineCodeV2SyntheticAttempt) => ({ ...a, clientSecret: { ...a.clientSecret, secret: "invalid" } }),
    ];
    for (const mutate of mutations) {
      const h = harness();
      await expect(h.coordinator.start(mutate(h.attempt) as OfflineCodeV2SyntheticAttempt)).rejects.toMatchObject(unavailable);
      expect(h.issueChallenge).not.toHaveBeenCalled(); expect(h.produce).not.toHaveBeenCalled();
    }
  });

  it.each(["locator_record_id", "locator_version", "locator_commitment", "proof_key_version", "proof_public_key",
    "origin", "expires_at"] as const)("rejects substituted %s before the expensive producer", async (field) => {
    const h = harness();
    const challenge = { ...h.issued.challenge, [field]: typeof h.issued.challenge[field] === "number" ? 99 : "invalid" };
    h.issueChallenge.mockResolvedValueOnce({ ...h.issued, challenge,
      challengeBytesBase64url: Buffer.from(canonicalJson(challenge as never)).toString("base64url") });
    await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.produce).not.toHaveBeenCalled(); expect(h.verifyProof).not.toHaveBeenCalled();
  });

  it("rejects altered canonical bytes and KDF salt before producing proof", async () => {
    for (const field of ["bytes", "salt"]) {
      const h = harness();
      h.issueChallenge.mockResolvedValueOnce(field === "bytes" ? { ...h.issued, challengeBytesBase64url: "A".repeat(80) }
        : { ...h.issued, kdfProfile: { ...h.issued.kdfProfile, salt: Buffer.alloc(16, 9).toString("base64url") } });
      await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
      expect(h.produce).not.toHaveBeenCalled();
    }
  });

  it("uses the real producer to reject a substituted record digest", async () => {
    const h = harness();
    const challenge = { ...h.issued.challenge, record_binding_digest: Buffer.alloc(32, 7).toString("base64url") };
    h.issueChallenge.mockResolvedValueOnce({ ...h.issued, challenge,
      challengeBytesBase64url: Buffer.from(canonicalJson(challenge as never)).toString("base64url") });
    h.produce.mockImplementation(createOfflineCodeV2PlatformProofProducer(true).produce);
    await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.verifyProof).not.toHaveBeenCalled();
  });

  it("rejects proof substitution and never transmits extra producer fields", async () => {
    for (const mutation of [{ challenge_id: hId(99) }, { private_key: "must-not-transmit" }]) {
      const h = harness(); h.produce.mockResolvedValueOnce({ ...h.fixture.possession_proof, ...mutation });
      await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
      expect(h.verifyProof).not.toHaveBeenCalled();
    }
  });

  it("freezes the input snapshot against caller mutation during challenge issuance", async () => {
    const h = harness(); const wait = deferred<OfflineCodeV2IssuedChallenge>();
    h.issueChallenge.mockReturnValueOnce(wait.promise);
    const attempt = structuredClone(h.attempt);
    const result = h.coordinator.start(attempt);
    Object.assign(attempt.kdfProfile, { salt: "invalid" });
    Object.assign(attempt.recordBinding, { owner_id: hId(98) });
    Object.assign(attempt.clientSecret, { secret: "invalid" });
    wait.resolve(h.issued); await expect(result).resolves.toEqual(success);
    const captured = h.produce.mock.calls[0][0];
    expect(Object.isFrozen(captured.recordBinding)).toBe(true);
    expect(captured.clientSecret.secret === h.attempt.clientSecret.secret).toBe(true);
    expect(captured.kdfProfile.salt === h.attempt.kdfProfile.salt).toBe(true);
  });

  it.each(["challenge", "produce", "verify"] as const)("blocks late success after cancellation during %s", async (stage) => {
    const h = harness(); const wait = deferred<never>();
    if (stage === "challenge") h.issueChallenge.mockReturnValueOnce(wait.promise);
    if (stage === "produce") h.produce.mockReturnValueOnce(wait.promise);
    if (stage === "verify") h.verifyProof.mockReturnValueOnce(wait.promise);
    const result = expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
    await vi.waitFor(() => expect(stage === "challenge" ? h.issueChallenge : stage === "produce" ? h.produce : h.verifyProof).toHaveBeenCalledOnce());
    h.coordinator.cancel();
    wait.resolve((stage === "challenge" ? h.issued : stage === "produce" ? h.fixture.possession_proof : success) as never);
    await result;
    if (stage !== "verify") expect(h.verifyProof).not.toHaveBeenCalled();
    await expect(h.coordinator.retryProof()).rejects.toMatchObject(unavailable);
  });

  it("prevents concurrent attempts and keeps the active run intact", async () => {
    const h = harness(); const wait = deferred<OfflineCodeV2IssuedChallenge>();
    h.issueChallenge.mockReturnValueOnce(wait.promise);
    const result = h.coordinator.start(h.attempt);
    await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(h.coordinator.retryProof()).rejects.toMatchObject(unavailable);
    wait.resolve(h.issued); await expect(result).resolves.toEqual(success);
    expect(h.issueChallenge).toHaveBeenCalledOnce();
  });

  it("retries an ambiguous proof with identical public bytes and idempotency, without redoing KDF", async () => {
    const h = harness(); h.verifyProof.mockRejectedValueOnce(new OfflineCodeV2UnavailableError(true));
    await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
    await expect(h.coordinator.retryProof()).resolves.toEqual(success);
    expect(h.produce).toHaveBeenCalledOnce(); expect(h.issueChallenge).toHaveBeenCalledOnce();
    const requests = h.verifyProof.mock.calls.map(([{ signal: _signal, ...request }]) => JSON.stringify(request));
    expect(requests[0] === requests[1]).toBe(true);
    expect(requests[1]).not.toContain(h.attempt.clientSecret.secret);
    expect(requests[1]).not.toContain("owner_id");
  });

  it("bounds retries to three proof sends and clears pending state on definite rejection", async () => {
    const h = harness(); h.verifyProof.mockRejectedValue(new OfflineCodeV2UnavailableError(true));
    await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
    for (let i = 0; i < 4; i += 1) await expect(h.coordinator.retryProof()).rejects.toMatchObject(unavailable);
    expect(h.verifyProof).toHaveBeenCalledTimes(3);
    const rejected = harness(); rejected.verifyProof.mockRejectedValueOnce(new OfflineCodeV2UnavailableError());
    await expect(rejected.coordinator.start(rejected.attempt)).rejects.toMatchObject(unavailable);
    await expect(rejected.coordinator.retryProof()).rejects.toMatchObject(unavailable);
    expect(rejected.verifyProof).toHaveBeenCalledOnce();
  });

  it("automatically drops idle retry material at expiry even when the injected clock stalls", async () => {
    vi.useFakeTimers();
    try {
      const h = harness(); h.verifyProof.mockRejectedValueOnce(new OfflineCodeV2UnavailableError(true));
      await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
      await vi.advanceTimersByTimeAsync(300_000);
      await expect(h.coordinator.retryProof()).rejects.toMatchObject(unavailable);
      expect(h.verifyProof).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });

  it("drops an idle pending request on cancellation and rejects success arriving after expiry", async () => {
    const h = harness(); h.verifyProof.mockRejectedValueOnce(new OfflineCodeV2UnavailableError(true));
    await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
    h.coordinator.cancel();
    await expect(h.coordinator.retryProof()).rejects.toMatchObject(unavailable);
    expect(h.verifyProof).toHaveBeenCalledOnce();
    const slow = harness(); slow.verifyProof.mockImplementationOnce(async () => {
      slow.now.mockReturnValue(new Date(slow.fixture.challenge.expires_at)); return success;
    });
    await expect(slow.coordinator.start(slow.attempt)).rejects.toMatchObject(unavailable);
    await expect(slow.coordinator.retryProof()).rejects.toMatchObject(unavailable);
    expect(slow.verifyProof).toHaveBeenCalledOnce();
  });

  it("rejects expiry, clock rollback, and future issuance, including after slow proof production", async () => {
    for (const stage of ["future", "expired", "slow", "rollback", "retry-expired"]) {
      const h = harness();
      if (stage === "future") h.now.mockReturnValue(new Date(Date.parse(h.fixture.challenge.issued_at) - 1));
      if (stage === "expired") h.now.mockReturnValue(new Date(h.fixture.challenge.expires_at));
      if (stage === "slow" || stage === "rollback") h.produce.mockImplementationOnce(async () => {
        h.now.mockReturnValue(new Date(stage === "slow" ? h.fixture.challenge.expires_at : h.fixture.challenge.issued_at));
        return h.fixture.possession_proof;
      });
      if (stage === "retry-expired") h.verifyProof.mockRejectedValueOnce(new OfflineCodeV2UnavailableError(true));
      await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
      if (stage === "retry-expired") {
        h.now.mockReturnValue(new Date(h.fixture.challenge.expires_at));
        await expect(h.coordinator.retryProof()).rejects.toMatchObject(unavailable);
        expect(h.verifyProof).toHaveBeenCalledOnce();
      } else expect(h.verifyProof).not.toHaveBeenCalled();
    }
  });

  it("rejects upgraded, malformed, and private-field results from an injected transport", async () => {
    for (const extra of [{ identity_verified: true }, { release_authorized: true }, { claim_created: true },
      { route_possession_asserted: false }, { owner_id: hId(90) }, { status: "claim_created" }]) {
      const h = harness(); h.verifyProof.mockResolvedValueOnce({ ...success, ...extra } as typeof success);
      await expect(h.coordinator.start(h.attempt)).rejects.toMatchObject(unavailable);
      await expect(h.coordinator.retryProof()).rejects.toMatchObject(unavailable);
      expect(h.verifyProof).toHaveBeenCalledOnce();
    }
  });
});

function harness(approved = true) {
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
    challengeIdempotencyKey: hId(81), proofIdempotencyKey: hId(82) };
  const issued: OfflineCodeV2IssuedChallenge = { challenge: fixture.challenge,
    challengeBytesBase64url: Buffer.from(canonicalJson(fixture.challenge as never)).toString("base64url"), kdfProfile: fixture.kdf_profile };
  const issueChallenge = vi.fn(async (_value: { locator: string; idempotencyKey: string; signal: AbortSignal }) => issued);
  const verifyProof = vi.fn(async (_value: OfflineCodeV2ProofRequest & { signal: AbortSignal }) => success);
  const produce = vi.fn(async (_value: OfflineCodeV2ProofInput) => fixture.possession_proof);
  const now = vi.fn(() => new Date(Date.parse(fixture.challenge.issued_at) + 1_000));
  const coordinator = createOfflineCodeV2Coordinator({ ...(approved ? { approved: true } : {}),
    claimantOrigin: fixture.challenge.origin, now, transport: { issueChallenge, verifyProof }, producer: { produce } });
  return { fixture, attempt, issued, issueChallenge, verifyProof, produce, now, coordinator };
}
function hId(value: number) { return `40000000-0000-4000-8000-${String(value).padStart(12, "0")}`; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
