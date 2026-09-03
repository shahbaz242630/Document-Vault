import { describe, expect, it, vi } from "vitest";
import { createReleaseAuthorizationTransactionClientV1, ReleaseAuthorizationTransactionError }
  from "./release-authorization-transaction-client.js";

const id = (last: string) => `b6000000-0000-4000-8000-0000000000${last}`;
describe("release authorization transaction client", () => {
  it("maps exact authority and keeps package and retrieval authorization false", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result(), error: null });
    await expect(createReleaseAuthorizationTransactionClientV1(rpc).authorize(input()))
      .resolves.toMatchObject({ releaseAuthorized: true, packageCreationAuthorized: false,
        retrievalAuthorized: false, caseState: "approved" });
    expect(rpc).toHaveBeenCalledWith("claimant_authorize_release", expect.objectContaining({
      p_authority_identity_id: id("01"), p_expected_binding_version: 2,
      p_expected_finalization_version: 1, p_expected_round_version: 2 }));
  });
  it("redacts transaction errors", async () => {
    const failed = createReleaseAuthorizationTransactionClientV1(vi.fn().mockResolvedValue({
      data: null, error: { code: "42501", message: "private release detail" } }));
    const error = await failed.authorize(input()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ReleaseAuthorizationTransactionError);
    expect(JSON.stringify(error)).not.toContain("private release detail");
  });
  it("rejects package, retrieval, extra, cross-case, stale, or incoherent output", async () => {
    for (const hostile of [{ ...result(), package_creation_authorized: true },
      { ...result(), retrieval_authorized: true }, { ...result(), ciphertext: "secret" },
      { ...result(), case_id: id("09") }, { ...result(), case_version: 5 },
      { ...result(), case_state: "release_ready" }, { ...result(), release_authorized: false }]) {
      await expect(createReleaseAuthorizationTransactionClientV1(vi.fn().mockResolvedValue({
        data: hostile, error: null })).authorize(input())).rejects.toThrow("invalid result");
    }
  });
});
function input() { return { authorityIdentityId: id("01"), caseId: id("02"),
  cycleId: id("03"), expectedBindingVersion: 2, expectedCaseVersion: 5,
  expectedFinalizationVersion: 1, expectedRoundVersion: 2, idempotencyKey: id("04"),
  reviewRoundId: id("05") }; }
function result(changes = {}) { return { case_id: id("02"), case_state: "approved",
  case_version: 6, cycle_id: id("03"), package_creation_authorized: false,
  release_authorization_id: id("06"), release_authorized: true,
  release_status: "authorized", replayed: false, retrieval_authorized: false,
  review_round_id: id("05"), ...changes }; }
