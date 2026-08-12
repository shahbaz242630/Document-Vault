import { describe, expect, it, vi } from "vitest";

import { createNativeEnrollmentTransactionClientV1, NativeEnrollmentTransactionError } from "./native-enrollment-transaction-client.js";

const ids = {
  app: "71000000-0000-4000-8000-000000000002", case: "91000000-0000-4000-8000-000000000019",
  claimant: "21000000-0000-4000-8000-000000000002", claimantKey: "31000000-0000-4000-8000-000000000013",
  idempotency: "71000000-0000-4000-8000-000000000004", invitation: "51000000-0000-4000-8000-000000000005",
  native: "71000000-0000-4000-8000-000000000001", portal: "81000000-0000-4000-8000-000000000018",
};

describe("native enrollment transaction client", () => {
  it("passes only verifier evidence into the atomic acceptance mutation", async () => {
    const rpc = vi.fn(async (_name: string, _input: Record<string, unknown>) => ({ data: { assertion_counter: 5, case_id: ids.case, case_version: 1,
      claimant_key_id: ids.claimantKey, invitation_id: ids.invitation, invitation_version: 2, replayed: false }, error: null }));
    const result = await createNativeEnrollmentTransactionClientV1(rpc).acceptNativeEnrollment({
      appAttestChallengeId: ids.app, claimantUserId: ids.claimant, idempotencyKey: ids.idempotency,
      nativeChallengeId: ids.native, portalSessionId: ids.portal, evidence: {
        expectedAppAttestCounter: 4, verifiedAppAttestChallengeDigest: "A".repeat(43),
        verifiedAppAttestCounter: 5, verifiedBundleVersion: "1",
        verifiedNativeChallengeDigest: "B".repeat(43), verifiedValidationCategory: 2,
      },
    });
    expect(result).toMatchObject({ assertionCounter: 5, claimantKeyId: ids.claimantKey, replayed: false });
    expect(rpc).toHaveBeenCalledWith("claimant_accept_native_enrollment", expect.objectContaining({
      p_expected_app_attest_counter: 4, p_verified_app_attest_counter: 5,
      p_verified_validation_category: 2,
    }));
    expect(rpc.mock.calls[0]![1]).not.toHaveProperty("p_public_key_jwk");
    expect(rpc.mock.calls[0]![1]).not.toHaveProperty("p_possession_proof");
    expect(rpc.mock.calls[0]![1]).not.toHaveProperty("p_assertion_object");
  });

  it("strictly parses stored evidence and redacts RPC failures", async () => {
    const valid = { app_attest_challenge_bytes_base64url: "A".repeat(22),
      app_attest_challenge_bytes_digest: "A".repeat(43), app_attest_challenge_id: ids.app,
      app_attest_key_id_digest: "B".repeat(43), app_attest_public_key_spki_base64: "QQ==",
      claimant_public_key_base64url: "B".repeat(87), claimant_user_id: ids.claimant,
      native_challenge_bytes_base64url: "C".repeat(22), native_challenge_bytes_digest: "C".repeat(43),
      native_challenge_id: ids.native, previous_app_attest_counter: 4,
      server_ephemeral_private_key_envelope: "v1.synthetic.envelope.material" };
    const rpc = vi.fn(async (_name: string, _input: Record<string, unknown>) => ({ data: valid, error: null }));
    const evidence = await createNativeEnrollmentTransactionClientV1(rpc).getNativeEvidence({
      appAttestChallengeId: ids.app, claimantUserId: ids.claimant,
      nativeChallengeId: ids.native, portalSessionId: ids.portal,
    });
    expect(evidence.previousAppAttestCounter).toBe(4);

    const failed = createNativeEnrollmentTransactionClientV1(async () => ({ data: null,
      error: { code: "40001", message: "sensitive database detail" } })).getNativeEvidence({
        appAttestChallengeId: ids.app, claimantUserId: ids.claimant,
        nativeChallengeId: ids.native, portalSessionId: ids.portal,
      });
    await expect(failed).rejects.toMatchObject({ code: "40001", message: "Native enrollment transaction failed." });
    await failed.catch((error: unknown) => expect(error).toBeInstanceOf(NativeEnrollmentTransactionError));
  });
});
