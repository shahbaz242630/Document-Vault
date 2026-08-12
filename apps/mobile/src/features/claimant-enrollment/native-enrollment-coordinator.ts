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

export const CLAIMANT_NATIVE_ENROLLMENT_COORDINATOR_APPROVED = false as const;

export type EnrollmentAppAttestAdapterV1 = Readonly<{
  createAssertion(challengeBytes: string): Promise<Readonly<{ appAttestKeyId: string; assertionObject: string }>>;
  createAttestation(challengeBytes: string): Promise<Readonly<{ appAttestKeyId: string; attestationObject: string }>>;
  ensureKey(): Promise<Readonly<{ appAttestKeyId: string }>>;
}>;
export type EnrollmentCustodyAdapterV1 = Readonly<{
  createKey(): Promise<Readonly<{ capability: NativeEnrollmentCapabilityV1; publicKey: string }>>;
  createPossessionProof(input: Readonly<{ challenge: NativeEnrollmentChallengeV1;
    challengeBytes: string }>): Promise<NativeEnrollmentPossessionProofV1>;
  deleteKey(): Promise<void>;
}>;

export class NativeEnrollmentCoordinatorError extends Error {
  constructor(readonly kind: "aborted" | "disabled" | "failed" | "reconciliation_required") {
    super("Native enrollment could not be completed."); this.name = "NativeEnrollmentCoordinatorError";
  }
}

export function createNativeEnrollmentCoordinatorV1(input: Readonly<{
  appAttest: EnrollmentAppAttestAdapterV1; approved?: boolean; custody: EnrollmentCustodyAdapterV1;
  createIdempotencyKey: () => string; transport: NativeEnrollmentTransportV1;
}>) {
  return { async enroll(invitationReference: string, signal?: AbortSignal) {
    if (!(input.approved ?? CLAIMANT_NATIVE_ENROLLMENT_COORDINATOR_APPROVED)) throw new NativeEnrollmentCoordinatorError("disabled");
    let custodyCreated = false; let completed = false; let finalizationAttempted = false;
    try {
      active(signal); const appKey = await input.appAttest.ensureKey();
      const registration = await input.transport.issueRegistration({ appAttestKeyId: appKey.appAttestKeyId,
        idempotencyKey: input.createIdempotencyKey(), signal });
      active(signal); const attestation = await input.appAttest.createAttestation(registration.challengeBytes);
      if (attestation.appAttestKeyId !== appKey.appAttestKeyId) fail();
      const registrationResponse = assertAppAttestRegistrationResponseV1({ app_attest_key_id: appKey.appAttestKeyId,
        attestation_object: attestation.attestationObject, challenge_id: registration.challenge.challenge_id,
        protocol: "sanduqkin:claim:native-enrollment:app-attest-registration:v1" });
      await input.transport.completeRegistration({ challengeId: registration.challenge.challenge_id,
        idempotencyKey: input.createIdempotencyKey(), response: registrationResponse, signal });

      active(signal); const key = await input.custody.createKey(); custodyCreated = true;
      const request = assertNativeEnrollmentChallengeRequestV1({ capability: key.capability,
        invitation_reference: invitationReference, policy_pack_id: "client-not-authoritative",
        policy_pack_version: 1, protocol: "sanduqkin:claim:native-enrollment:v1", public_key: key.publicKey });
      const issued = await input.transport.issueNative({ appAttestKeyId: appKey.appAttestKeyId,
        idempotencyKey: input.createIdempotencyKey(), request: { capability: request.capability,
          invitation_reference: request.invitation_reference, protocol: request.protocol, public_key: request.public_key }, signal });
      active(signal); const proof = assertNativeEnrollmentPossessionProofV1(await input.custody.createPossessionProof({
        challenge: issued.native.challenge, challengeBytes: issued.native.challenge_bytes }));
      assertProofBinding(proof, issued.native.challenge);
      const assertion = await input.appAttest.createAssertion(issued.appAttestChallengeBytes);
      if (assertion.appAttestKeyId !== appKey.appAttestKeyId) fail();
      const appResponse = assertAppAttestAssertionResponseV1({ app_attest_key_id: appKey.appAttestKeyId,
        assertion_object: assertion.assertionObject, challenge_id: issued.appAttestChallenge.challenge_id,
        protocol: "sanduqkin:claim:native-enrollment:app-attest-assertion:v1" });
      finalizationAttempted = true;
      const result = await input.transport.completeNative({ appAttestChallengeId: issued.appAttestChallenge.challenge_id,
        appAttestResponse: appResponse, idempotencyKey: input.createIdempotencyKey(),
        nativeChallengeId: issued.native.challenge.challenge_id, possessionProof: proof, signal });
      completed = true; return result;
    } catch (error) {
      if (finalizationAttempted) throw new NativeEnrollmentCoordinatorError("reconciliation_required");
      if (signal?.aborted) throw new NativeEnrollmentCoordinatorError("aborted");
      if (error instanceof NativeEnrollmentCoordinatorError) throw error;
      throw new NativeEnrollmentCoordinatorError("failed");
    } finally {
      if (custodyCreated && !completed && !finalizationAttempted) {
        try { await input.custody.deleteKey(); } catch { /* fail closed; preserve safe public error */ }
      }
    }
  } };
}

function assertProofBinding(proof: NativeEnrollmentPossessionProofV1, challenge: NativeEnrollmentChallengeV1): void {
  for (const key of ["challenge_id", "claimant_id", "claimant_key_id", "claimant_key_version",
    "device_binding_digest", "invitation_reference", "protocol", "public_key_fingerprint"] as const) {
    if (proof[key] !== challenge[key]) fail();
  }
}
function active(signal?: AbortSignal): void { if (signal?.aborted) throw new NativeEnrollmentCoordinatorError("aborted"); }
function fail(): never { throw new NativeEnrollmentCoordinatorError("failed"); }
