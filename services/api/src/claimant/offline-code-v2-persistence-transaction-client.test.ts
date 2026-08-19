import { createHash } from "node:crypto";

import { canonicalJson } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { createOfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";

describe("offline-code V2 persistence transaction client", () => {
  it("maps registration, constant challenge, proof-attempt, and revocation RPCs", async () => {
    const responses = [registrationResult(), challengeResult(), attemptResult("verified"), revocationResult()];
    const rpc = vi.fn(async (_name: string, _input: Record<string, unknown>) => ({
      data: responses.shift(), error: null,
    }));
    const client = createOfflineCodeV2PersistenceTransactionClient(rpc);
    await expect(client.register(registration())).resolves.toMatchObject({
      status: "active", authority: "route_possession_only", claimCreated: false });
    await expect(client.issueChallenge(challenge())).resolves.toMatchObject({ rateLimited: false,
      challenge: { authority: "route_possession_only", proof_key_version: 1 },
      identityVerified: false, releaseAuthorized: false });
    await expect(client.recordAttempt(attempt("verified"))).resolves.toMatchObject({
      verificationOutcome: "verified", routePossessionAsserted: true,
      identityVerified: false, claimCreated: false, releaseAuthorized: false });
    await expect(client.revoke(revocation())).resolves.toMatchObject({
      status: "revoked", futureChallengesAllowed: false });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "claimant_register_offline_code_v2_locator", "claimant_issue_offline_code_v2_challenge",
      "claimant_record_offline_code_v2_attempt", "claimant_revoke_offline_code_v2_locator",
    ]);
    expect(rpc).toHaveBeenCalledWith("claimant_issue_offline_code_v2_challenge",
      expect.objectContaining({ p_locator_index_digest: digest("L"),
        p_network_bucket_digest: digest("I"), p_origin: "https://claim.synthetic.test" }));
  });

  it("maps rate limiting without returning challenge material", async () => {
    const client = createOfflineCodeV2PersistenceTransactionClient(async () => ({ data: {
      rate_limited: true, retry_after_seconds: 300, identity_verified: false,
      claim_created: false, release_authorized: false, replayed: false }, error: null }));
    await expect(client.issueChallenge(challenge())).resolves.toEqual({ rateLimited: true,
      retryAfterSeconds: 300, identityVerified: false, claimCreated: false,
      releaseAuthorized: false, replayed: false });
  });

  it("rejects database failures and unsafe, extra, or incoherent results", async () => {
    const failed = createOfflineCodeV2PersistenceTransactionClient(async () => ({
      data: null, error: { code: "40001" },
    }));
    await expect(failed.register(registration())).rejects.toMatchObject({ code: "40001" });
    const hostile = [{ ...attemptResult("verified"), identity_verified: true },
      { ...attemptResult("verified"), release_authorized: true },
      { ...attemptResult("verified"), route_possession_asserted: false },
      { ...challengeResult(), claimant_id: id("99") },
      { ...challengeResult(), challenge_bytes_digest: digest("X") },
      { ...registrationResult(), locator_record_id: id("99") }];
    for (const value of hostile) {
      const client = createOfflineCodeV2PersistenceTransactionClient(async () => ({
        data: value, error: null,
      }));
      const operation = "status" in value && value.status === "active"
        ? client.register(registration())
        : "challenge" in value ? client.issueChallenge(challenge())
          : client.recordAttempt(attempt("verified"));
      await expect(operation).rejects.toThrow(/invalid|incoherent|binding|canonical/u);
    }
  });
});

function registration() { return { locatorRecordId: id("01"), ownerUserId: id("09"),
  locatorIndexDigest: digest("L"), locatorCommitment: digest("C"), grantId: id("03"),
  proofPublicKey: digest("P"), recordBindingDigest: digest("B"), kdfSalt: `${"K".repeat(21)}A`,
  wrapNonce: "N".repeat(32), wrapCiphertext: "W".repeat(64),
  wrapAssociatedDataDigest: digest("A"), issuedAt: "2026-08-19T08:00:00.000Z",
  expiresAt: "2026-09-19T08:00:00.000Z", idempotencyKey: id("11") }; }
function challenge() { return { locatorIndexDigest: digest("L"),
  networkBucketDigest: digest("I"), deviceBucketDigest: digest("E"),
  globalBucketDigest: digest("G"), origin: "https://claim.synthetic.test",
  idempotencyKey: id("12") }; }
function attempt(outcome: "invalid" | "verified") { return { locatorRecordId: id("01"),
  challengeId: id("02"), verifiedChallengeBytesDigest: digest("D"),
  verifiedRecordBindingDigest: digest("B"), proofSignatureDigest: digest("S"),
  verificationOutcome: outcome, idempotencyKey: id("13") }; }
function revocation() { return { locatorRecordId: id("01"), ownerUserId: id("09"),
  expectedLocatorVersion: 2 as const, reason: "owner_revoked" as const,
  idempotencyKey: id("14") }; }
function registrationResult() { return { locator_record_id: id("01"), locator_version: 2,
  status: "active", authority: "route_possession_only", synthetic_only: true,
  claim_created: false, release_authorized: false, replayed: false }; }
function challengeResult() { const value = { authority: "route_possession_only",
  challenge_id: id("02"), expires_at: "2026-08-19T08:05:00.000Z",
  issued_at: "2026-08-19T08:00:00.000Z", locator_commitment: digest("C"),
  locator_record_id: id("01"), locator_version: 2, nonce: digest("N"),
  origin: "https://claim.synthetic.test", proof_key_version: 1,
  proof_public_key: digest("P"), protocol: "sanduqkin:claim:offline-code:v2",
  purpose: "possession_challenge", record_binding_digest: digest("B") };
  const bytes = Buffer.from(canonicalJson(value as never)); return { rate_limited: false,
    challenge: value, challenge_bytes_base64url: bytes.toString("base64url"),
    challenge_bytes_digest: createHash("sha256").update(bytes).digest("base64url"),
    kdf_profile: { algorithm: "argon2id", memlimit_bytes: 67_108_864, opslimit: 2,
      output_bytes: 32, production_approved: false, profile_id: "argon2id-synthetic-test-v2",
      protocol: "sanduqkin:claim:offline-code:v2", purpose: "client_secret_root",
      salt: `${"K".repeat(21)}A` }, identity_verified: false, claim_created: false,
    release_authorized: false, replayed: false }; }
function attemptResult(outcome: "invalid" | "verified") { return { challenge_id: id("02"),
  locator_record_id: id("01"), verification_outcome: outcome,
  route_possession_asserted: outcome === "verified", locator_locked: false,
  identity_verified: false, claim_created: false, release_authorized: false, replayed: false }; }
function revocationResult() { return { locator_record_id: id("01"), locator_version: 2,
  status: "revoked", future_challenges_allowed: false, claim_created: false,
  release_authorized: false, replayed: false }; }
function digest(character: string) { return `${character.repeat(42)}Q`; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
