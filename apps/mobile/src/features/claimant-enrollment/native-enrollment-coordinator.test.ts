import { appAttestSyntheticFixtureV1 as app, nativeEnrollmentSyntheticFixtureV1 as native } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";
import { CLAIMANT_NATIVE_ENROLLMENT_COORDINATOR_APPROVED, createNativeEnrollmentCoordinatorV1,
  type EnrollmentAppAttestAdapterV1, type EnrollmentCustodyAdapterV1 } from "./native-enrollment-coordinator";
import type { NativeEnrollmentTransportV1 } from "./native-enrollment-transport";
import type { NativeEnrollmentAttemptV1 } from "./native-enrollment-attempt-store";

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
      challengeBytes: native.challenge_bytes, keyAliasReference: "claimant-key.v1.synthetic" });
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

  it("durably records finalization before sending and preserves it after an ambiguous commit", async () => {
    const deps = dependencies(); const store = attemptStore();
    vi.mocked(deps.transport.completeNative).mockRejectedValueOnce(new Error("connection lost"));
    const coordinator = createNativeEnrollmentCoordinatorV1({ ...deps, approved: true,
      attemptPersistence: persistence(store) });
    await expect(coordinator.enroll(native.challenge.invitation_reference)).rejects.toMatchObject({
      kind: "reconciliation_required" });
    const phases = vi.mocked(store.save).mock.calls.map(([value]) => value.phase);
    expect(phases).toEqual(["key_created", "challenge_issued", "finalization_pending", "reconciliation_required"]);
    expect(vi.mocked(store.save).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
      attempt_id: "91000000-0000-4000-8000-000000000019",
      request_digests: expect.objectContaining({ native_complete: "A".repeat(43) }),
      key_alias_reference: "claimant-key.v1.synthetic" }));
    expect(store.clear).not.toHaveBeenCalled(); expect(deps.custody.deleteKey).not.toHaveBeenCalled();
  });

  it("cleans pre-finalization state without contacting reconciliation", async () => {
    const deps = dependencies(); const store = attemptStore({ ...storedAttempt(), phase: "challenge_issued",
      request_digests: { ...storedAttempt().request_digests, native_complete: null } });
    const result = await createNativeEnrollmentCoordinatorV1({ ...deps, approved: true,
      attemptPersistence: persistence(store) }).recover();
    expect(result).toEqual({ status: "cleaned" });
    expect(deps.custody.deleteKey).toHaveBeenCalledWith("claimant-key.v1.synthetic");
    expect(deps.transport.reconcileNative).not.toHaveBeenCalled(); expect(store.clear).toHaveBeenCalled();
  });

  it("preserves recovery state and custody when cancellation is already requested", async () => {
    const deps = dependencies(); const store = attemptStore(storedAttempt()); const controller = new AbortController();
    controller.abort();
    await expect(createNativeEnrollmentCoordinatorV1({ ...deps, approved: true,
      attemptPersistence: persistence(store) }).recover(controller.signal)).rejects.toMatchObject({ kind: "aborted" });
    expect(deps.transport.reconcileNative).not.toHaveBeenCalled();
    expect(deps.custody.deleteKey).not.toHaveBeenCalled(); expect(store.clear).not.toHaveBeenCalled();
  });

  it("reconciles an expired finalization attempt before deleting its custody key", async () => {
    const deps = dependencies(); const store = attemptStore({ ...storedAttempt(),
      expires_at: "2026-08-12T11:59:59.000Z" });
    vi.mocked(deps.transport.reconcileNative).mockResolvedValueOnce({ status: "not_committed" });
    await expect(createNativeEnrollmentCoordinatorV1({ ...deps, approved: true,
      attemptPersistence: persistence(store) }).recover()).resolves.toEqual({ status: "cleaned" });
    expect(deps.transport.reconcileNative).toHaveBeenCalledOnce();
    expect(deps.custody.deleteKey).toHaveBeenCalledWith("claimant-key.v1.synthetic");
    expect(store.clear).toHaveBeenCalled();
  });

  it("uses server authority before preserving or deleting a finalization key", async () => {
    for (const status of ["committed", "not_committed", "unknown"] as const) {
      const deps = dependencies(); const store = attemptStore(storedAttempt());
      vi.mocked(deps.transport.reconcileNative).mockResolvedValueOnce(status === "committed"
        ? { status, result: acceptance } : { status });
      const recovery = createNativeEnrollmentCoordinatorV1({ ...deps, approved: true,
        attemptPersistence: persistence(store) }).recover();
      if (status === "unknown") {
        await expect(recovery).rejects.toMatchObject({ kind: "reconciliation_required" });
        expect(store.clear).not.toHaveBeenCalled(); expect(deps.custody.deleteKey).not.toHaveBeenCalled();
      } else {
        await expect(recovery).resolves.toEqual(status === "committed"
          ? { status: "committed", result: acceptance } : { status: "cleaned" });
        expect(store.clear).toHaveBeenCalled();
        expect(deps.custody.deleteKey).toHaveBeenCalledTimes(status === "not_committed" ? 1 : 0);
      }
    }
  });
});

function persistence(store: ReturnType<typeof attemptStore>) { return { accountId: storedAttempt().account_id,
  approved: true, createAttemptId: () => storedAttempt().attempt_id,
  digestRequest: async () => "A".repeat(43), now: () => new Date("2026-08-12T12:00:00.000Z"), store }; }
function attemptStore(value: NativeEnrollmentAttemptV1 | null = null) { return {
  clear: vi.fn(async (_accountId: string) => undefined), load: vi.fn(async (_accountId: string) => value),
  save: vi.fn(async (_attempt: NativeEnrollmentAttemptV1) => undefined) }; }
function storedAttempt(): NativeEnrollmentAttemptV1 { return { account_id: "21000000-0000-4000-8000-000000000002",
  app_attest_challenge_id: "71000000-0000-4000-8000-000000000002",
  attempt_id: "91000000-0000-4000-8000-000000000019", created_at: "2026-08-12T12:00:00.000Z",
  expires_at: "2026-08-12T12:05:00.000Z", idempotency_keys: {
    native_complete: "91000000-0000-4000-8000-000000000019",
    native_issue: "91000000-0000-4000-8000-000000000018",
    registration_complete: "91000000-0000-4000-8000-000000000017",
    registration_issue: "91000000-0000-4000-8000-000000000016" },
  invitation_reference: native.challenge.invitation_reference, key_alias_reference: "claimant-key.v1.synthetic",
  native_challenge_id: native.challenge.challenge_id, phase: "reconciliation_required",
  protocol: "sanduqkin:claim:native-enrollment-attempt:v1",
  registration_challenge_id: "71000000-0000-4000-8000-000000000003",
  request_digests: { native_complete: "A".repeat(43), native_issue: "B".repeat(43),
    registration_complete: "C".repeat(43), registration_issue: "D".repeat(43) },
  updated_at: "2026-08-12T12:01:00.000Z" }; }

function dependencies(): { appAttest: EnrollmentAppAttestAdapterV1 & Record<string, ReturnType<typeof vi.fn>>;
  custody: EnrollmentCustodyAdapterV1 & Record<string, ReturnType<typeof vi.fn>>; createIdempotencyKey: () => string;
  transport: NativeEnrollmentTransportV1 & Record<string, ReturnType<typeof vi.fn>> } {
  const appAttest = { ensureKey: vi.fn(async () => ({ appAttestKeyId: app.registration_response.app_attest_key_id })),
    createAttestation: vi.fn(async () => ({ appAttestKeyId: app.registration_response.app_attest_key_id,
      attestationObject: app.registration_response.attestation_object })),
    createAssertion: vi.fn(async () => ({ appAttestKeyId: app.assertion_response.app_attest_key_id,
      assertionObject: app.assertion_response.assertion_object })) };
  const custody = { createKey: vi.fn(async () => ({ capability: native.challenge_request.capability,
    keyAliasReference: "claimant-key.v1.synthetic", publicKey: native.challenge_request.public_key })), createPossessionProof: vi.fn(async () => native.possession_proof),
    deleteKey: vi.fn(async () => undefined) };
  const assertion = { ...app.assertion_challenge, claimant_id: native.challenge.claimant_id,
    claimant_key_id: native.challenge.claimant_key_id, claimant_key_version: native.challenge.claimant_key_version,
    invitation_reference: native.challenge.invitation_reference, invitation_version: native.challenge.invitation_version,
    public_key_fingerprint: native.challenge.public_key_fingerprint };
  const transport = { issueRegistration: vi.fn(async () => ({ challenge: app.registration_challenge,
    challengeBytes: "A".repeat(43) })), completeRegistration: vi.fn(async () => ({ appAttestKeyRecordId: "81000000-0000-4000-8000-000000000018",
      assertionCounter: 0, challengeId: app.registration_challenge.challenge_id, replayed: false })),
    issueNative: vi.fn(async () => ({ appAttestChallenge: assertion, appAttestChallengeBytes: "B".repeat(43), native: {
      challenge: native.challenge, challenge_bytes: native.challenge_bytes } })), completeNative: vi.fn(async () => acceptance),
    reconcileNative: vi.fn(async () => ({ status: "unknown" as const })) };
  let next = 0; return { appAttest, custody, createIdempotencyKey: () => `91000000-0000-4000-8000-0000000000${20 + next++}`,
    transport } as ReturnType<typeof dependencies>;
}
