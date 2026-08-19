import { describe, expect, it, vi } from "vitest";

import { createOfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";

describe("offline-code V2 persistence transaction client", () => {
  it("maps registration, challenge, proof-attempt, and revocation RPCs exactly", async () => {
    const responses = [registrationResult(), challengeResult(), attemptResult("verified"), revocationResult()];
    const rpc = vi.fn(async (_name: string, _input: Record<string, unknown>) => ({
      data: responses.shift(), error: null,
    }));
    const client = createOfflineCodeV2PersistenceTransactionClient(rpc);
    await expect(client.register(registration())).resolves.toMatchObject({
      status: "active", authority: "route_possession_only", claimCreated: false });
    await expect(client.issueChallenge(challenge())).resolves.toMatchObject({
      authority: "route_possession_only", proofKeyVersion: 1, releaseAuthorized: false });
    await expect(client.recordAttempt(attempt("verified"))).resolves.toMatchObject({
      verificationOutcome: "verified", routePossessionAsserted: true,
      identityVerified: false, claimCreated: false, releaseAuthorized: false });
    await expect(client.revoke(revocation())).resolves.toMatchObject({
      status: "revoked", futureChallengesAllowed: false });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "claimant_register_offline_code_v2_locator",
      "claimant_issue_offline_code_v2_challenge",
      "claimant_record_offline_code_v2_attempt",
      "claimant_revoke_offline_code_v2_locator",
    ]);
    expect(rpc).toHaveBeenCalledWith("claimant_issue_offline_code_v2_challenge",
      expect.objectContaining({ p_locator_index_digest: digest("L"),
        p_challenge_id: id("02"), p_origin: "https://claim.synthetic.test" }));
  });

  it("rejects database failures and unsafe, extra, or incoherent results", async () => {
    const failed = createOfflineCodeV2PersistenceTransactionClient(async () => ({
      data: null, error: { code: "40001" },
    }));
    await expect(failed.register(registration())).rejects.toMatchObject({ code: "40001" });
    const hostile = [
      { ...attemptResult("verified"), identity_verified: true },
      { ...attemptResult("verified"), release_authorized: true },
      { ...attemptResult("verified"), route_possession_asserted: false },
      { ...challengeResult(), claimant_id: id("99") },
      { ...registrationResult(), locator_record_id: id("99") },
    ];
    for (const value of hostile) {
      const client = createOfflineCodeV2PersistenceTransactionClient(async () => ({
        data: value, error: null,
      }));
      const operation = "status" in value && value.status === "active"
        ? client.register(registration())
        : "expires_at" in value ? client.issueChallenge(challenge())
          : client.recordAttempt(attempt("verified"));
      await expect(operation).rejects.toThrow(/invalid|incoherent|binding/u);
    }
  });
});

function registration() { return { locatorRecordId: id("01"), ownerUserId: id("09"),
  locatorIndexDigest: digest("L"), locatorCommitment: digest("C"), grantId: id("03"),
  proofPublicKey: digest("P"), recordBindingDigest: digest("B"),
  wrapNonce: "N".repeat(32), wrapCiphertext: "W".repeat(64),
  wrapAssociatedDataDigest: digest("A"), issuedAt: "2026-08-19T08:00:00.000Z",
  expiresAt: "2026-09-19T08:00:00.000Z", idempotencyKey: id("11") }; }
function challenge() { return { locatorIndexDigest: digest("L"), challengeId: id("02"),
  locatorCommitment: digest("C"), recordBindingDigest: digest("B"),
  proofPublicKey: digest("P"), challengeBytesBase64url: "Q".repeat(80),
  challengeBytesDigest: digest("D"), origin: "https://claim.synthetic.test",
  nonce: digest("N"), issuedAt: "2026-08-19T08:00:00.000Z",
  expiresAt: "2026-08-19T08:05:00.000Z", idempotencyKey: id("12") }; }
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
function challengeResult() { return { challenge_id: id("02"), locator_record_id: id("01"),
  locator_version: 2, proof_key_version: 1, authority: "route_possession_only",
  expires_at: "2026-08-19T08:05:00.000Z", claim_created: false,
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
