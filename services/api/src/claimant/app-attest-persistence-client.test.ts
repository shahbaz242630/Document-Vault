import { describe, expect, it, vi } from "vitest";

import { AppAttestPersistenceError, createAppAttestPersistenceClientV1 } from "./app-attest-persistence-client.js";

const ids = {
  claimant: "21000000-0000-4000-8000-000000000002",
  claimantKey: "31000000-0000-4000-8000-000000000013",
  idempotency: "71000000-0000-4000-8000-000000000001",
  portal: "81000000-0000-4000-8000-000000000018",
  record: "91000000-0000-4000-8000-000000000019",
};

describe("App Attest persistence client", () => {
  it("passes only server-verified registration material to the service-role transaction", async () => {
    const rpc = vi.fn(async () => ({ data: { app_attest_key_record_id: ids.record, assertion_counter: 0, replayed: false }, error: null }));
    const result = await createAppAttestPersistenceClientV1(rpc).registerKey({
      appIdHash: "A".repeat(43), claimantUserId: ids.claimant, idempotencyKey: ids.idempotency,
      portalSessionId: ids.portal, verified: {
        appAttestKeyIdDigest: "B".repeat(43), bundleVersion: "1", environment: "production",
        publicKeySpkiBase64: "Q".repeat(80), receiptBase64: "cmVjZWlwdA==", validationCategory: 2,
      },
    });
    expect(result).toEqual({ appAttestKeyRecordId: ids.record, assertionCounter: 0, replayed: false });
    expect(rpc).toHaveBeenCalledWith("claimant_register_app_attest_key", expect.objectContaining({
      p_claimant_user_id: ids.claimant, p_validation_category: 2,
    }));
  });

  it("uses compare-and-advance counter input and redacts database errors", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "40001", message: "sensitive database detail" } }));
    const call = createAppAttestPersistenceClientV1(rpc).advanceAssertion({
      appAttestKeyIdDigest: "B".repeat(43), claimantKeyId: ids.claimantKey,
      claimantUserId: ids.claimant, expectedPreviousCounter: 6, idempotencyKey: ids.idempotency,
      portalSessionId: ids.portal, verified: { bundleVersion: "1", counter: 7, validationCategory: 2 },
    });
    await expect(call).rejects.toMatchObject({ code: "40001", message: "App Attest persistence failed." });
    await call.catch((error: unknown) => expect(error).toBeInstanceOf(AppAttestPersistenceError));
    expect(rpc).toHaveBeenCalledWith("claimant_advance_app_attest_assertion", expect.objectContaining({
      p_expected_previous_counter: 6, p_verified_counter: 7,
    }));
  });
});
