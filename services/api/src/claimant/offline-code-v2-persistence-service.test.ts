import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_APPROVED,
  createOfflineCodeV2PersistenceService }
  from "./offline-code-v2-persistence-service.js";

describe("offline-code V2 persistence service", () => {
  it("is immutable-false for every operation", async () => {
    expect(CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_APPROVED).toBe(false); const value = service();
    for (const operation of [value.register(registration()), value.issueChallenge(challenge()),
      value.recordAttempt(attempt()), value.revoke(revocation())])
      await expect(operation).rejects.toMatchObject({ kind: "disabled" });
  });

  it("passes only strict server-owned synthetic persistence inputs", async () => {
    const transactions = mocks(); const value = service({ approved: true, transactions });
    await value.register(registration()); await value.issueChallenge(challenge());
    await value.recordAttempt(attempt()); await value.revoke(revocation());
    expect(transactions.register).toHaveBeenCalledWith(registration());
    expect(transactions.issueChallenge).toHaveBeenCalledWith(challenge());
    expect(transactions.recordAttempt).toHaveBeenCalledWith(attempt());
    expect(transactions.revoke).toHaveBeenCalledWith(revocation());
  });

  it("rejects V1, raw secret/private material, unsafe outcomes, and extra fields", async () => {
    const value = service({ approved: true });
    for (const hostile of [{ ...registration(), protocol: "sanduqkin:claim:offline-code:v1" },
      { ...registration(), locator: "SK2-L-prohibited" },
      { ...registration(), clientSecret: "SK2-S-prohibited" },
      { ...registration(), proofPrivateKey: "prohibited" }, { ...registration(), mek: "prohibited" },
      { ...challenge(), claimantId: id("99") }, { ...attempt(), verificationOutcome: "release" },
      { ...revocation(), expectedLocatorVersion: 1 }]) {
      const operation = "verificationOutcome" in hostile ? value.recordAttempt(hostile)
        : "networkBucketDigest" in hostile ? value.issueChallenge(hostile)
          : "reason" in hostile ? value.revoke(hostile) : value.register(hostile);
      await expect(operation).rejects.toMatchObject({ kind: "invalid_input" });
    }
  });
});

function service(options: Record<string, unknown> = {}) { return createOfflineCodeV2PersistenceService({
  approved: options.approved as boolean | undefined,
  transactions: (options.transactions ?? mocks()) as never }); }
function mocks() { return { register: vi.fn(async (value) => value),
  issueChallenge: vi.fn(async (value) => value), recordAttempt: vi.fn(async (value) => value),
  revoke: vi.fn(async (value) => value) }; }
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
function attempt() { return { locatorRecordId: id("01"), challengeId: id("02"),
  verifiedChallengeBytesDigest: digest("D"), verifiedRecordBindingDigest: digest("B"),
  proofSignatureDigest: digest("S"), verificationOutcome: "invalid" as const,
  idempotencyKey: id("13") }; }
function revocation() { return { locatorRecordId: id("01"), ownerUserId: id("09"),
  expectedLocatorVersion: 2 as const, reason: "owner_revoked" as const,
  idempotencyKey: id("14") }; }
function digest(character: string) { return `${character.repeat(42)}Q`; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
