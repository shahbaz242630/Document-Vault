import { createHash, generateKeyPairSync, sign } from "node:crypto";

import { canonicalJson } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import {
  CLAIMANT_OFFLINE_CODE_V2_PROOF_ATTEMPT_COORDINATOR_APPROVED,
  createOfflineCodeV2ProofAttemptCoordinator,
} from "./offline-code-v2-proof-attempt-coordinator.js";
import type { OfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";

describe("offline-code V2 proof-attempt coordinator", () => {
  it("is immutable-false before parsing or touching persistence", async () => {
    expect(CLAIMANT_OFFLINE_CODE_V2_PROOF_ATTEMPT_COORDINATOR_APPROVED).toBe(false);
    const persistence = { recordAttempt: vi.fn() };
    await expect(coordinator(persistence).verify({})).rejects.toMatchObject({ kind: "disabled" });
    expect(persistence.recordAttempt).not.toHaveBeenCalled();
  });

  it("verifies the exact Ed25519 transcript and asserts possession only", async () => {
    const fixture = signedFixture();
    const persistence = { recordAttempt: vi.fn(async () => attemptResult("verified")) };
    await expect(coordinator(persistence, true).verify(fixture.request)).resolves.toEqual({
      status: "proof_verified", authority: "route_possession_only",
      routePossessionAsserted: true, identityVerified: false,
      claimCreated: false, releaseAuthorized: false,
    });
    expect(persistence.recordAttempt).toHaveBeenCalledWith({
      locatorRecordId: id("01"), challengeId: id("02"),
      verifiedChallengeBytesDigest: digest(fixture.challengeBytes),
      verifiedRecordBindingDigest: digest(Buffer.from("binding")),
      proofSignatureDigest: digest(Buffer.from(fixture.proof.signature, "base64url")),
      verificationOutcome: "verified", idempotencyKey: id("13"),
    });
  });

  it("records cross-binding and signature failures but returns one safe rejection", async () => {
    const fixture = signedFixture();
    for (const proof of [
      { ...fixture.proof, challenge_id: id("99") },
      { ...fixture.proof, record_binding_digest: digest(Buffer.from("other")) },
      { ...fixture.proof, signature: Buffer.alloc(64, 7).toString("base64url") },
    ]) {
      const persistence = { recordAttempt: vi.fn(async () => attemptResult("invalid")) };
      await expect(coordinator(persistence, true).verify({
        ...fixture.request, possessionProof: proof,
      })).resolves.toEqual(rejected());
      expect(persistence.recordAttempt).toHaveBeenCalledWith(expect.objectContaining({
        verificationOutcome: "invalid", verifiedRecordBindingDigest: fixture.challenge.record_binding_digest,
      }));
    }
  });

  it("keeps unavailable records indistinguishable after an invalid proof", async () => {
    const fixture = signedFixture();
    const persistence = { recordAttempt: vi.fn(async () => { throw new Error("unavailable"); }) };
    const request = { ...fixture.request, possessionProof: {
      ...fixture.proof, signature: Buffer.alloc(64, 9).toString("base64url"),
    } };
    await expect(coordinator(persistence, true).verify(request)).resolves.toEqual(rejected());
  });

  it("rejects changed challenge bytes, V1, extras, and unsafe persistence results", async () => {
    const fixture = signedFixture();
    const persistence = { recordAttempt: vi.fn(async () => attemptResult("verified")) };
    const service = coordinator(persistence, true);
    for (const hostile of [
      { ...fixture.request, challengeBytesBase64url: Buffer.from("changed").toString("base64url") },
      { ...fixture.request, extra: true },
      { ...fixture.request, challenge: { ...fixture.challenge,
        protocol: "sanduqkin:claim:offline-code:v1" } },
      { ...fixture.request, possessionProof: { ...fixture.proof, privateKey: "prohibited" } },
    ]) await expect(service.verify(hostile)).rejects.toMatchObject({ kind: "invalid_input" });

    const incoherent = { recordAttempt: vi.fn(async () => ({
      ...attemptResult("verified"), routePossessionAsserted: false,
    })) };
    await expect(coordinator(incoherent, true).verify(fixture.request))
      .rejects.toMatchObject({ kind: "boundary_failure" });
    const unsafeAuthority = { recordAttempt: vi.fn(async () => ({
      ...attemptResult("verified"), identityVerified: true,
    })) };
    await expect(coordinator(unsafeAuthority as never, true).verify(fixture.request))
      .rejects.toMatchObject({ kind: "boundary_failure" });
  });
});

function coordinator(persistence: Pick<OfflineCodeV2PersistenceTransactionClient, "recordAttempt">,
  approved?: boolean) {
  return createOfflineCodeV2ProofAttemptCoordinator({ approved, persistence });
}

function signedFixture() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyBytes = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const challenge = { authority: "route_possession_only" as const, challenge_id: id("02"),
    expires_at: "2026-08-19T08:05:00.000Z", issued_at: "2026-08-19T08:00:00.000Z",
    locator_commitment: digest(Buffer.from("locator")), locator_record_id: id("01"),
    locator_version: 2, nonce: digest(Buffer.from("nonce")),
    origin: "https://claim.synthetic.test", proof_key_version: 1,
    proof_public_key: publicKeyBytes.toString("base64url"),
    protocol: "sanduqkin:claim:offline-code:v2" as const,
    purpose: "possession_challenge" as const,
    record_binding_digest: digest(Buffer.from("binding")) };
  const message = Buffer.from(canonicalJson({ protocol: "sanduqkin:claim:offline-code:v2",
    purpose: "possession_proof", label: "sanduqkin:claim:offline-code:v2:possession-proof",
    challenge }));
  const proof = { protocol: "sanduqkin:claim:offline-code:v2" as const,
    purpose: "possession_proof" as const, authority: "route_possession_only" as const,
    challenge_id: challenge.challenge_id, locator_record_id: challenge.locator_record_id,
    locator_version: 2, proof_key_version: 1, proof_public_key: challenge.proof_public_key,
    record_binding_digest: challenge.record_binding_digest,
    signature: sign(null, message, privateKey).toString("base64url") };
  const challengeBytes = Buffer.from(canonicalJson(challenge));
  return { challenge, challengeBytes, proof, request: { challenge,
    challengeBytesBase64url: challengeBytes.toString("base64url"), possessionProof: proof,
    idempotencyKey: id("13") } };
}

function attemptResult(outcome: "invalid" | "verified") { return { challengeId: id("02"),
  locatorRecordId: id("01"), verificationOutcome: outcome,
  routePossessionAsserted: outcome === "verified", locatorLocked: false,
  identityVerified: false as const, claimCreated: false as const,
  releaseAuthorized: false as const, replayed: false }; }
function rejected() { return { status: "proof_rejected", routePossessionAsserted: false,
  identityVerified: false, claimCreated: false, releaseAuthorized: false }; }
function digest(value: Buffer) { return createHash("sha256").update(value).digest("base64url"); }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
