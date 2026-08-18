import { describe, expect, it, vi } from "vitest";
import { CLAIMANT_RELEASE_AUTHORIZATION_APPROVED, createReleaseAuthorizationServiceV1 }
  from "./release-authorization-service.js";

const id = (last: string) => `b5000000-0000-4000-8000-0000000000${last}`;
describe("release authorization service", () => {
  it("is literal-false and performs no transaction while disabled", async () => {
    expect(CLAIMANT_RELEASE_AUTHORIZATION_APPROVED).toBe(false);
    const transactions = { authorize: vi.fn() };
    await expect(createReleaseAuthorizationServiceV1({ transactions }).authorize(valid()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(transactions.authorize).not.toHaveBeenCalled();
  });
  it("passes exact authority only when explicitly enabled", async () => {
    const transactions = { authorize: vi.fn() };
    await createReleaseAuthorizationServiceV1({ approved: true, transactions }).authorize(valid());
    expect(transactions.authorize).toHaveBeenCalledWith(valid());
  });
  it("rejects malformed, zero-version, and extra package authority", async () => {
    const service = createReleaseAuthorizationServiceV1({ approved: true,
      transactions: { authorize: vi.fn() } });
    for (const value of [valid({ expectedRoundVersion: 0 }),
      valid({ authorityIdentityId: "release-authority" }),
      valid({ packageCreationAuthorized: true })]) {
      await expect(service.authorize(value)).rejects.toMatchObject({ kind: "invalid_input" });
    }
  });
});
function valid(changes = {}) { return { authorityIdentityId: id("01"), caseId: id("02"),
  cycleId: id("03"), expectedBindingVersion: 2, expectedCaseVersion: 5,
  expectedFinalizationVersion: 1, expectedRoundVersion: 2, idempotencyKey: id("04"),
  reviewRoundId: id("05"), ...changes }; }
