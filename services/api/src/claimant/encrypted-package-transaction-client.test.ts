import { describe, expect, it, vi } from "vitest";
import { createEncryptedPackageTransactionClientV1, EncryptedPackageTransactionError }
  from "./encrypted-package-transaction-client.js";

const id = (last: string) => `b8000000-0000-4000-8000-0000000000${last}`;
describe("encrypted package transaction client", () => {
  it("maps ciphertext authority and accepts only unsigned, non-retrievable results", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result(), error: null });
    await expect(createEncryptedPackageTransactionClientV1(rpc).prepare(input()))
      .resolves.toMatchObject({ packageStatus: "prepared_unsigned",
        manifestSigned: false, retrievalAuthorized: false });
    expect(rpc).toHaveBeenCalledWith("claimant_prepare_encrypted_release_package",
      expect.objectContaining({ p_package_ref: "synthetic_release_package_alpha",
        p_assets: [expect.objectContaining({ asset_id: id("01"), ciphertext: "A".repeat(64) })],
        p_grants: expect.arrayContaining([expect.objectContaining({ grant_id: id("04") })]) }));
  });
  it("redacts transaction errors", async () => {
    const failed = createEncryptedPackageTransactionClientV1(vi.fn().mockResolvedValue({
      data: null, error: { code: "42501", message: "encrypted vault detail" } }));
    const error = await failed.prepare(input()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(EncryptedPackageTransactionError);
    expect(JSON.stringify(error)).not.toContain("vault detail");
  });
  it("rejects signed, retrievable, extra, cross-case, or incoherent output", async () => {
    for (const hostile of [{ ...result(), manifest_signed: true },
      { ...result(), retrieval_authorized: true }, { ...result(), ciphertext: "secret" },
      { ...result(), case_id: id("99") }, { ...result(), case_version: 7 },
      { ...result(), asset_count: 2 }, { ...result(), package_status: "ready" }])
      await expect(createEncryptedPackageTransactionClientV1(vi.fn().mockResolvedValue({
        data: hostile, error: null })).prepare(input())).rejects.toThrow("invalid result");
  });
});
function input() { return { assets: [{ assetId: id("01"), assetType: "bank_account",
  ciphertext: "A".repeat(64), ciphertextDigest: "a".repeat(64), nonce: "B".repeat(32) }],
  caseId: id("02"), cycleId: id("03"), expectedCaseVersion: 6,
  grants: [{ grantId: id("04"), grantVersion: 1, recipientKeyId: id("05"),
    recipientKeyVersion: 1, sealedGrantDigest: "b".repeat(64) },
  { grantId: id("06"), grantVersion: 1, recipientKeyId: id("07"),
    recipientKeyVersion: 1, sealedGrantDigest: "c".repeat(64) }],
  idempotencyKey: id("08"), ownerUserId: id("09"), packageId: id("10"),
  packageRef: "synthetic_release_package_alpha", releaseAuthorizationId: id("11"),
  reviewRoundId: id("12") }; }
function result(changes = {}) { return { asset_count: 1, case_id: id("02"),
  case_state: "approved", case_version: 6, grant_count: 2, manifest_signed: false,
  package_status: "prepared_unsigned", release_authorization_id: id("11"),
  release_package_id: id("10"), replayed: false, retrieval_authorized: false, ...changes }; }
