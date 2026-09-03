import {
  assertAppAttestAssertionResponseV1,
  assertAppAttestRegistrationResponseV1,
  assertNativeEnrollmentChallengeRequestV1,
  assertNativeEnrollmentPossessionProofV1,
  type NativeEnrollmentCapabilityV1,
  type NativeEnrollmentChallengeV1,
  type NativeEnrollmentPossessionProofV1,
} from "@vault/shared-types";
import type { NativeEnrollmentTransportV1 } from "./native-enrollment-transport";
import type { NativeEnrollmentAttemptStoreV1, NativeEnrollmentAttemptV1 } from "./native-enrollment-attempt-store";

export const CLAIMANT_NATIVE_ENROLLMENT_COORDINATOR_APPROVED = false as const;

export type EnrollmentAppAttestAdapterV1 = Readonly<{
  createAssertion(challengeBytes: string): Promise<Readonly<{ appAttestKeyId: string; assertionObject: string }>>;
  createAttestation(challengeBytes: string): Promise<Readonly<{ appAttestKeyId: string; attestationObject: string }>>;
  ensureKey(): Promise<Readonly<{ appAttestKeyId: string }>>;
}>;
export type EnrollmentCustodyAdapterV1 = Readonly<{
  createKey(): Promise<Readonly<{ capability: NativeEnrollmentCapabilityV1; keyAliasReference: string; publicKey: string }>>;
  createPossessionProof(input: Readonly<{ challenge: NativeEnrollmentChallengeV1;
    challengeBytes: string; keyAliasReference: string }>): Promise<NativeEnrollmentPossessionProofV1>;
  deleteKey(keyAliasReference: string): Promise<void>;
}>;

export type AttemptPersistenceV1 = Readonly<{
  accountId: string;
  approved?: boolean;
  createAttemptId: () => string;
  digestRequest: (value: unknown) => Promise<string>;
  now?: () => Date;
  store: NativeEnrollmentAttemptStoreV1;
}>;

export class NativeEnrollmentCoordinatorError extends Error {
  constructor(readonly kind: "aborted" | "disabled" | "failed" | "reconciliation_required") {
    super("Native enrollment could not be completed."); this.name = "NativeEnrollmentCoordinatorError";
  }
}

type NativeEnrollmentCoordinatorInputV1 = Readonly<{
  appAttest: EnrollmentAppAttestAdapterV1; approved?: boolean; custody: EnrollmentCustodyAdapterV1;
  attemptPersistence?: AttemptPersistenceV1; createIdempotencyKey: () => string;
  transport: NativeEnrollmentTransportV1;
}>;

export function createNativeEnrollmentCoordinatorV1(input: NativeEnrollmentCoordinatorInputV1) {
  return { async enroll(invitationReference: string, signal?: AbortSignal) {
    if (!(input.approved ?? CLAIMANT_NATIVE_ENROLLMENT_COORDINATOR_APPROVED)) throw new NativeEnrollmentCoordinatorError("disabled");
    const ids = { registrationIssue: input.createIdempotencyKey(), registrationComplete: input.createIdempotencyKey(),
      nativeIssue: input.createIdempotencyKey(), nativeComplete: input.attemptPersistence?.createAttemptId() ?? input.createIdempotencyKey() };
    let attempt: NativeEnrollmentAttemptV1 | null = null;
    let custodyCreated = false; let completed = false; let finalizationAttempted = false; let keyAliasReference: string | null = null;
    try {
      active(signal); const appKey = await input.appAttest.ensureKey();
      const registrationIssueRequest = { appAttestKeyId: appKey.appAttestKeyId, idempotencyKey: ids.registrationIssue };
      const registrationIssueDigest = await digestRequest(input.attemptPersistence, registrationIssueRequest);
      const registration = await input.transport.issueRegistration({ ...registrationIssueRequest, signal });
      active(signal); const attestation = await input.appAttest.createAttestation(registration.challengeBytes);
      if (attestation.appAttestKeyId !== appKey.appAttestKeyId) fail();
      const registrationResponse = assertAppAttestRegistrationResponseV1({ app_attest_key_id: appKey.appAttestKeyId,
        attestation_object: attestation.attestationObject, challenge_id: registration.challenge.challenge_id,
        protocol: "sanduqkin:claim:native-enrollment:app-attest-registration:v1" });
      const registrationCompleteRequest = { challengeId: registration.challenge.challenge_id,
        idempotencyKey: ids.registrationComplete, response: registrationResponse };
      const registrationCompleteDigest = await digestRequest(input.attemptPersistence, registrationCompleteRequest);
      await input.transport.completeRegistration({ ...registrationCompleteRequest, signal });

      active(signal); const key = await input.custody.createKey(); custodyCreated = true;
      keyAliasReference = key.keyAliasReference;
      attempt = await persistAttempt(input.attemptPersistence, {
        account_id: input.attemptPersistence?.accountId ?? "00000000-0000-4000-8000-000000000000",
        app_attest_challenge_id: null, attempt_id: ids.nativeComplete,
        created_at: now(input.attemptPersistence).toISOString(), expires_at: new Date(now(input.attemptPersistence).getTime() + 300_000).toISOString(),
        idempotency_keys: { native_complete: ids.nativeComplete, native_issue: ids.nativeIssue,
          registration_complete: ids.registrationComplete, registration_issue: ids.registrationIssue },
        invitation_reference: invitationReference,
        key_alias_reference: key.keyAliasReference, native_challenge_id: null, phase: "key_created",
        protocol: "sanduqkin:claim:native-enrollment-attempt:v1",
        registration_challenge_id: registration.challenge.challenge_id,
        request_digests: { native_complete: null, native_issue: null,
          registration_complete: registrationCompleteDigest, registration_issue: registrationIssueDigest },
        updated_at: now(input.attemptPersistence).toISOString(),
      });
      const request = assertNativeEnrollmentChallengeRequestV1({ capability: key.capability,
        invitation_reference: invitationReference, policy_pack_id: "client-not-authoritative",
        policy_pack_version: 1, protocol: "sanduqkin:claim:native-enrollment:v1", public_key: key.publicKey });
      const nativeIssueRequest = { appAttestKeyId: appKey.appAttestKeyId, idempotencyKey: ids.nativeIssue,
        request: { capability: request.capability, invitation_reference: request.invitation_reference,
          protocol: request.protocol, public_key: request.public_key } };
      const nativeIssueDigest = await digestRequest(input.attemptPersistence, nativeIssueRequest);
      const issued = await input.transport.issueNative({ ...nativeIssueRequest, signal });
      attempt = await persistAttempt(input.attemptPersistence, attempt && {
        ...attempt, app_attest_challenge_id: issued.appAttestChallenge.challenge_id,
        expires_at: issued.native.challenge.expires_at, native_challenge_id: issued.native.challenge.challenge_id,
        phase: "challenge_issued", request_digests: { ...attempt.request_digests, native_issue: nativeIssueDigest },
        updated_at: now(input.attemptPersistence).toISOString(),
      });
      active(signal); const proof = assertNativeEnrollmentPossessionProofV1(await input.custody.createPossessionProof({
        challenge: issued.native.challenge, challengeBytes: issued.native.challenge_bytes,
        keyAliasReference: key.keyAliasReference }));
      assertProofBinding(proof, issued.native.challenge);
      const assertion = await input.appAttest.createAssertion(issued.appAttestChallengeBytes);
      if (assertion.appAttestKeyId !== appKey.appAttestKeyId) fail();
      const appResponse = assertAppAttestAssertionResponseV1({ app_attest_key_id: appKey.appAttestKeyId,
        assertion_object: assertion.assertionObject, challenge_id: issued.appAttestChallenge.challenge_id,
        protocol: "sanduqkin:claim:native-enrollment:app-attest-assertion:v1" });
      const finalRequest = { appAttestChallengeId: issued.appAttestChallenge.challenge_id,
        appAttestResponse: appResponse, idempotencyKey: ids.nativeComplete,
        nativeChallengeId: issued.native.challenge.challenge_id, possessionProof: proof };
      if (input.attemptPersistence) {
        const finalDigest = await input.attemptPersistence.digestRequest(finalRequest);
        attempt = await persistAttempt(input.attemptPersistence, attempt && { ...attempt,
          phase: "finalization_pending", request_digests: { ...attempt.request_digests, native_complete: finalDigest },
          updated_at: now(input.attemptPersistence).toISOString() });
      }
      finalizationAttempted = true;
      const result = await input.transport.completeNative({ ...finalRequest, signal });
      completed = true; await clearAttempt(input.attemptPersistence); return result;
    } catch (error) {
      if (finalizationAttempted) {
        try { await persistAttempt(input.attemptPersistence, attempt && { ...attempt, phase: "reconciliation_required",
          updated_at: now(input.attemptPersistence).toISOString() }); } catch { /* finalization_pending is already durable */ }
        throw new NativeEnrollmentCoordinatorError("reconciliation_required");
      }
      if (signal?.aborted) throw new NativeEnrollmentCoordinatorError("aborted");
      if (error instanceof NativeEnrollmentCoordinatorError) throw error;
      throw new NativeEnrollmentCoordinatorError("failed");
    } finally {
      if (custodyCreated && !completed && !finalizationAttempted) {
        try { if (keyAliasReference) await input.custody.deleteKey(keyAliasReference); } catch { /* preserve safe public error */ }
        await clearAttempt(input.attemptPersistence);
      }
    }
  }, recover: (signal?: AbortSignal) => recoverAttempt(input, signal) };
}

async function recoverAttempt(input: NativeEnrollmentCoordinatorInputV1, signal?: AbortSignal) {
  const persistence = input.attemptPersistence;
  if (!(input.approved ?? CLAIMANT_NATIVE_ENROLLMENT_COORDINATOR_APPROVED) || !persistence?.approved) {
    throw new NativeEnrollmentCoordinatorError("disabled");
  }
  const attempt = await persistence.store.load(persistence.accountId); if (!attempt) return { status: "none" as const };
  active(signal);
  if (attempt.phase === "key_created" || attempt.phase === "challenge_issued") {
    await input.custody.deleteKey(attempt.key_alias_reference); await persistence.store.clear(persistence.accountId);
    return { status: "cleaned" as const };
  }
  if (!attempt.app_attest_challenge_id || !attempt.native_challenge_id || !attempt.request_digests.native_complete) {
    throw new NativeEnrollmentCoordinatorError("reconciliation_required");
  }
  const result = await input.transport.reconcileNative({ appAttestChallengeId: attempt.app_attest_challenge_id,
    attemptId: attempt.attempt_id, nativeChallengeId: attempt.native_challenge_id, signal });
  if (result.status === "committed") {
    if (result.result.invitationId !== attempt.invitation_reference) throw new NativeEnrollmentCoordinatorError("reconciliation_required");
    await persistence.store.clear(persistence.accountId); return { status: "committed" as const, result: result.result };
  }
  if (result.status === "not_committed") {
    await input.custody.deleteKey(attempt.key_alias_reference); await persistence.store.clear(persistence.accountId);
    return { status: "cleaned" as const };
  }
  throw new NativeEnrollmentCoordinatorError("reconciliation_required");
}

async function persistAttempt(persistence: AttemptPersistenceV1 | undefined,
  attempt: NativeEnrollmentAttemptV1 | false | null): Promise<NativeEnrollmentAttemptV1 | null> {
  if (!persistence?.approved || !attempt) return attempt || null;
  await persistence.store.save(attempt); return attempt;
}
async function clearAttempt(persistence: AttemptPersistenceV1 | undefined): Promise<void> {
  if (persistence?.approved) await persistence.store.clear(persistence.accountId);
}
function now(persistence: AttemptPersistenceV1 | undefined): Date { return persistence?.now?.() ?? new Date(); }
async function digestRequest(persistence: AttemptPersistenceV1 | undefined, value: unknown): Promise<string> {
  return persistence ? persistence.digestRequest(value) : "A".repeat(43);
}

function assertProofBinding(proof: NativeEnrollmentPossessionProofV1, challenge: NativeEnrollmentChallengeV1): void {
  for (const key of ["challenge_id", "claimant_id", "claimant_key_id", "claimant_key_version",
    "device_binding_digest", "invitation_reference", "protocol", "public_key_fingerprint"] as const) {
    if (proof[key] !== challenge[key]) fail();
  }
}
function active(signal?: AbortSignal): void { if (signal?.aborted) throw new NativeEnrollmentCoordinatorError("aborted"); }
function fail(): never { throw new NativeEnrollmentCoordinatorError("failed"); }
