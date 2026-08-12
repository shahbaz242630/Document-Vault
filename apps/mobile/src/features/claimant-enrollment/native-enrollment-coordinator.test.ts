import { appAttestSyntheticFixtureV1 as app, nativeEnrollmentSyntheticFixtureV1 as native } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";
import { CLAIMANT_NATIVE_ENROLLMENT_COORDINATOR_APPROVED, createNativeEnrollmentCoordinatorV1,
  type EnrollmentAppAttestAdapterV1, type EnrollmentCustodyAdapterV1 } from "./native-enrollment-coordinator";
import type { NativeEnrollmentTransportV1 } from "./native-enrollment-transport";

const acceptance = { assertionCounter: 1, caseId: "61000000-0000-4000-8000-000000000016", caseVersion: 1,
  claimantKeyId: native.challenge.claimant_key_id, invitationId: native.challenge.invitation_reference,
  invitationVersion: 1, replayed: false };

describe("hard-disabled native enrollment coordinator", () => {
  it("is immutably disabled before any adapter, token, or transport work", async () => {
    expect(CLAIMANT_NATIVE_ENROLLMENT_COORDINATOR_APPROVED).toBe(false);
    const deps = dependencies();
    await expect(createNativeEnrollmentCoordinatorV1(deps).enroll(native.challenge.invitation_reference))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(deps.appAttest.ensureKey).not.toHaveBeenCalled(); expect(deps.transport.issueRegistration).not.toHaveBeenCalled();
  });

  it("orchestrates registration, key creation, paired proofs, and exact completion when explicitly injected for tests", async () => {
    const deps = dependencies(); const coordinator = createNativeEnrollmentCoordinatorV1({ ...deps, approved: true });
    await expect(coordinator.enroll(native.challenge.invitation_reference)).resolves.toEqual(acceptance);
    expect(deps.transport.completeRegistration).toHaveBeenCalledWith(expect.objectContaining({
      challengeId: app.registration_challenge.challenge_id, response: app.registration_response }));
    expect(deps.transport.issueNative).toHaveBeenCalledWith(expect.objectContaining({ request: expect.not.objectContaining({
      policy_pack_id: expect.anything(), claimant_id: expect.anything() }) }));
    expect(deps.custody.createPossessionProof).toHaveBeenCalledWith({ challenge: native.challenge,
      challengeBytes: native.challenge_bytes });
    expect(deps.transport.completeNative).toHaveBeenCalledWith(expect.objectContaining({
      nativeChallengeId: native.challenge.challenge_id, possessionProof: native.possession_proof }));
    expect(deps.custody.deleteKey).not.toHaveBeenCalled();
  });

  it("deletes a newly created custody key after transport, assertion, or binding failure", async () => {
    for (const change of ["transport", "assertion", "binding"] as const) {
      const deps = dependencies();
      if (change === "transport") vi.mocked(deps.transport.issueNative).mockRejectedValueOnce(new Error("sensitive server detail"));
      if (change === "assertion") vi.mocked(deps.appAttest.createAssertion).mockRejectedValueOnce(new Error("native detail"));
      if (change === "binding") vi.mocked(deps.custody.createPossessionProof).mockResolvedValueOnce({
        ...native.possession_proof, claimant_id: "99000000-0000-4000-8000-000000000099" });
      await expect(createNativeEnrollmentCoordinatorV1({ ...deps, approved: true })
        .enroll(native.challenge.invitation_reference)).rejects.toMatchObject({ kind: "failed",
          message: "Native enrollment could not be completed." });
      expect(deps.custody.deleteKey).toHaveBeenCalledOnce();
    }
  });

  it("does not delete before custody creation and reports cancellation without leaking details", async () => {
    const deps = dependencies(); const controller = new AbortController();
    vi.mocked(deps.appAttest.ensureKey).mockImplementationOnce(async () => { controller.abort(); return { appAttestKeyId: app.registration_response.app_attest_key_id }; });
    await expect(createNativeEnrollmentCoordinatorV1({ ...deps, approved: true })
      .enroll(native.challenge.invitation_reference, controller.signal)).rejects.toMatchObject({ kind: "aborted" });
    expect(deps.custody.createKey).not.toHaveBeenCalled(); expect(deps.custody.deleteKey).not.toHaveBeenCalled();
  });

  it("preserves the device key when final acceptance has an ambiguous outcome", async () => {
    const deps = dependencies(); vi.mocked(deps.transport.completeNative).mockRejectedValueOnce(new Error("connection lost"));
    await expect(createNativeEnrollmentCoordinatorV1({ ...deps, approved: true })
      .enroll(native.challenge.invitation_reference)).rejects.toMatchObject({
        kind: "reconciliation_required", message: "Native enrollment could not be completed.",
      });
    expect(deps.custody.deleteKey).not.toHaveBeenCalled();
  });
});

function dependencies(): { appAttest: EnrollmentAppAttestAdapterV1 & Record<string, ReturnType<typeof vi.fn>>;
  custody: EnrollmentCustodyAdapterV1 & Record<string, ReturnType<typeof vi.fn>>; createIdempotencyKey: () => string;
  transport: NativeEnrollmentTransportV1 & Record<string, ReturnType<typeof vi.fn>> } {
  const appAttest = { ensureKey: vi.fn(async () => ({ appAttestKeyId: app.registration_response.app_attest_key_id })),
    createAttestation: vi.fn(async () => ({ appAttestKeyId: app.registration_response.app_attest_key_id,
      attestationObject: app.registration_response.attestation_object })),
    createAssertion: vi.fn(async () => ({ appAttestKeyId: app.assertion_response.app_attest_key_id,
      assertionObject: app.assertion_response.assertion_object })) };
  const custody = { createKey: vi.fn(async () => ({ capability: native.challenge_request.capability,
    publicKey: native.challenge_request.public_key })), createPossessionProof: vi.fn(async () => native.possession_proof),
    deleteKey: vi.fn(async () => undefined) };
  const assertion = { ...app.assertion_challenge, claimant_id: native.challenge.claimant_id,
    claimant_key_id: native.challenge.claimant_key_id, claimant_key_version: native.challenge.claimant_key_version,
    invitation_reference: native.challenge.invitation_reference, invitation_version: native.challenge.invitation_version,
    public_key_fingerprint: native.challenge.public_key_fingerprint };
  const transport = { issueRegistration: vi.fn(async () => ({ challenge: app.registration_challenge,
    challengeBytes: "A".repeat(43) })), completeRegistration: vi.fn(async () => ({ appAttestKeyRecordId: "81000000-0000-4000-8000-000000000018",
      assertionCounter: 0, challengeId: app.registration_challenge.challenge_id, replayed: false })),
    issueNative: vi.fn(async () => ({ appAttestChallenge: assertion, appAttestChallengeBytes: "B".repeat(43), native: {
      challenge: native.challenge, challenge_bytes: native.challenge_bytes } })), completeNative: vi.fn(async () => acceptance) };
  let next = 0; return { appAttest, custody, createIdempotencyKey: () => `91000000-0000-4000-8000-0000000000${20 + next++}`,
    transport } as ReturnType<typeof dependencies>;
}
