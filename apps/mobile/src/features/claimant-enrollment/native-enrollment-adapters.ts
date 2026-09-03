import {
  assertNativeEnrollmentChallengeRequestV1,
  assertNativeEnrollmentPossessionProofV1,
  type NativeEnrollmentPossessionProofV1,
} from "@vault/shared-types";
import { z } from "zod";

import type {
  EnrollmentAppAttestAdapterV1,
  EnrollmentCustodyAdapterV1,
} from "./native-enrollment-coordinator";

export const CLAIMANT_NATIVE_LIFECYCLE_ADAPTERS_APPROVED = false as const;

const appAttestKeyId = z.string().regex(/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/u);
const opaqueAppleObject = z.string().min(24).max(131_072)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u);
const keyAlias = z.string().min(1).max(200).regex(/^claimant-enrollment\.v1\.[0-9a-f-]{36}$/u);
const appKey = z.strictObject({ app_attest_key_id: appAttestKeyId });
const attestation = appKey.extend({ attestation_object: opaqueAppleObject });
const assertion = appKey.extend({ assertion_object: opaqueAppleObject });

export type ClaimantEnrollmentNativeV1 = Readonly<{
  createClaimantKeyAsync(): Promise<unknown>;
  createClaimantPossessionProofAsync(keyAliasReference: string, challengeBytes: string): Promise<unknown>;
  deleteClaimantKeyAsync(keyAliasReference: string): Promise<unknown>;
  ensureAppAttestKeyAsync(): Promise<unknown>;
  attestAppAttestKeyAsync(challengeBytes: string): Promise<unknown>;
  generateAppAttestAssertionAsync(challengeBytes: string): Promise<unknown>;
}>;

export class NativeEnrollmentAdapterError extends Error {
  constructor(readonly kind: "disabled" | "failed" | "invalid_response") {
    super("Native enrollment operation could not be completed.");
    this.name = "NativeEnrollmentAdapterError";
  }
}

export function createEnrollmentAppAttestAdapterV1(input: Readonly<{
  approved?: boolean; native: ClaimantEnrollmentNativeV1 | null;
}>): EnrollmentAppAttestAdapterV1 {
  return {
    ensureKey: () => invoke(input, async (native) => {
      const value = parse(appKey, await native.ensureAppAttestKeyAsync());
      return { appAttestKeyId: value.app_attest_key_id };
    }),
    createAttestation: (challengeBytes) => invoke(input, async (native) => {
      requireChallengeBytes(challengeBytes);
      const value = parse(attestation, await native.attestAppAttestKeyAsync(challengeBytes));
      return { appAttestKeyId: value.app_attest_key_id, attestationObject: value.attestation_object };
    }),
    createAssertion: (challengeBytes) => invoke(input, async (native) => {
      requireChallengeBytes(challengeBytes);
      const value = parse(assertion, await native.generateAppAttestAssertionAsync(challengeBytes));
      return { appAttestKeyId: value.app_attest_key_id, assertionObject: value.assertion_object };
    }),
  };
}

export function createEnrollmentCustodyAdapterV1(input: Readonly<{
  approved?: boolean; native: ClaimantEnrollmentNativeV1 | null;
}>): EnrollmentCustodyAdapterV1 {
  return {
    createKey: () => invoke(input, async (native) => {
      const value = parse(z.strictObject({ capability: z.unknown(), key_alias_reference: keyAlias,
        public_key: z.string() }), await native.createClaimantKeyAsync());
      const checked = assertNativeEnrollmentChallengeRequestV1({ capability: value.capability,
        invitation_reference: "50000000-0000-4000-8000-000000000005", policy_pack_id: "adapter-validation-only",
        policy_pack_version: 1, protocol: "sanduqkin:claim:native-enrollment:v1", public_key: value.public_key });
      return { capability: checked.capability, keyAliasReference: value.key_alias_reference,
        publicKey: checked.public_key };
    }),
    createPossessionProof: ({ challenge, challengeBytes, keyAliasReference }) => invoke(input, async (native) => {
      requireAlias(keyAliasReference); requireChallengeBytes(challengeBytes);
      const proof = assertNativeEnrollmentPossessionProofV1(
        await native.createClaimantPossessionProofAsync(keyAliasReference, challengeBytes));
      requireProofBinding(proof, challenge); return proof;
    }),
    deleteKey: (keyAliasReference) => invoke(input, async (native) => {
      requireAlias(keyAliasReference);
      parse(z.strictObject({ deleted: z.literal(true) }), await native.deleteClaimantKeyAsync(keyAliasReference));
    }),
  };
}

async function invoke<T>(input: Readonly<{ approved?: boolean; native: ClaimantEnrollmentNativeV1 | null }>,
  operation: (native: ClaimantEnrollmentNativeV1) => Promise<T>): Promise<T> {
  if (!(input.approved ?? CLAIMANT_NATIVE_LIFECYCLE_ADAPTERS_APPROVED)) throw new NativeEnrollmentAdapterError("disabled");
  if (!input.native) throw new NativeEnrollmentAdapterError("failed");
  try { return await operation(input.native); }
  catch (error) { if (error instanceof NativeEnrollmentAdapterError) throw error;
    throw new NativeEnrollmentAdapterError(error instanceof z.ZodError ? "invalid_response" : "failed"); }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value); if (!parsed.success) throw new NativeEnrollmentAdapterError("invalid_response");
  return parsed.data;
}
function requireAlias(value: string): void { if (!keyAlias.safeParse(value).success) throw new NativeEnrollmentAdapterError("invalid_response"); }
function requireChallengeBytes(value: string): void {
  if (value.length < 22 || value.length > 16_384 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new NativeEnrollmentAdapterError("invalid_response");
  }
}
function requireProofBinding(proof: NativeEnrollmentPossessionProofV1,
  challenge: Parameters<EnrollmentCustodyAdapterV1["createPossessionProof"]>[0]["challenge"]): void {
  for (const key of ["challenge_id", "claimant_id", "claimant_key_id", "claimant_key_version",
    "device_binding_digest", "invitation_reference", "protocol", "public_key_fingerprint"] as const) {
    if (proof[key] !== challenge[key]) throw new NativeEnrollmentAdapterError("invalid_response");
  }
}
