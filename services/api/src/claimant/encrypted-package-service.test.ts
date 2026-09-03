import { describe, expect, it, vi } from "vitest";
import { CLAIMANT_ENCRYPTED_PACKAGE_APPROVED, createEncryptedPackageServiceV1 }
  from "./encrypted-package-service.js";

const id = (last: string) => `b7000000-0000-4000-8000-0000000000${last}`;
describe("encrypted package service", () => {
  it("is literal-false and performs no transaction while disabled", async () => {
    expect(CLAIMANT_ENCRYPTED_PACKAGE_APPROVED).toBe(false);
    const transactions = { prepare: vi.fn() };
    await expect(createEncryptedPackageServiceV1({ transactions }).prepare(valid()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(transactions.prepare).not.toHaveBeenCalled();
  });
  it("passes exact encrypted envelopes only when explicitly enabled", async () => {
    const transactions = { prepare: vi.fn() }; const value = valid();
    await createEncryptedPackageServiceV1({ approved: true, transactions }).prepare(value);
    expect(transactions.prepare).toHaveBeenCalledWith(value);
  });
  it("rejects duplicate, malformed, oversized, and extra authority", async () => {
    const service = createEncryptedPackageServiceV1({ approved: true,
      transactions: { prepare: vi.fn() } }); const value = valid();
    for (const hostile of [{ ...value, assets: [value.assets[0], value.assets[0]] },
      { ...value, grants: [value.grants[0], value.grants[0]] },
      { ...value, assets: [{ ...value.assets[0], ciphertextDigest: "a" }] },
      { ...value, retrievalAuthorized: true }])
      await expect(service.prepare(hostile)).rejects.toMatchObject({ kind: "invalid_input" });
  });
});
function valid() { return { assets: [{ assetId: id("01"), assetType: "bank_account",
  ciphertext: "A".repeat(64), ciphertextDigest: "a".repeat(64), nonce: "B".repeat(32) }],
  caseId: id("02"), cycleId: id("03"), expectedCaseVersion: 6,
  grants: [{ grantId: id("04"), grantVersion: 1, recipientKeyId: id("05"),
    recipientKeyVersion: 1, sealedGrantDigest: "b".repeat(64) },
  { grantId: id("06"), grantVersion: 1, recipientKeyId: id("07"),
    recipientKeyVersion: 1, sealedGrantDigest: "c".repeat(64) }],
  idempotencyKey: id("08"), ownerUserId: id("09"), packageId: id("10"),
  packageRef: "synthetic_release_package_alpha", releaseAuthorizationId: id("11"),
  reviewRoundId: id("12") }; }
