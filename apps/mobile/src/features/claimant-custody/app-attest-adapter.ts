import type { NativeAppAttestResult } from "../../../modules/claimant-key-custody/src";

export const CLAIMANT_APP_ATTEST_ADAPTER_ENABLED = false as const;
export const CLAIMANT_APP_ATTEST_MINIMUM_IOS_MAJOR_VERSION = 27 as const;

const keyIdPattern = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/u;
const opaqueBase64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export type AppAttestNativeAdapter = {
  inspectCapabilityAsync(): Promise<NativeAppAttestResult>;
  ensureTestKeyAsync(): Promise<NativeAppAttestResult>;
  attestTestKeyAsync(challengeBytes: string): Promise<NativeAppAttestResult>;
  generateTestAssertionAsync(challengeBytes: string): Promise<NativeAppAttestResult>;
  clearTestKeyIdentifierAsync(): Promise<NativeAppAttestResult>;
};

export function createClaimantAppAttestProbe(adapter: AppAttestNativeAdapter) {
  return {
    async register(challengeBytes: string): Promise<NativeAppAttestResult> {
      assertOpaqueChallengeBytes(challengeBytes);
      const capability = assertSafeResult(await adapter.inspectCapabilityAsync());
      if (!capability.passed) return capability;
      const key = assertSafeResult(await adapter.ensureTestKeyAsync());
      if (!key.passed) return key;
      return assertSafeResult(await adapter.attestTestKeyAsync(challengeBytes), "attestation_object");
    },
    async assert(challengeBytes: string): Promise<NativeAppAttestResult> {
      assertOpaqueChallengeBytes(challengeBytes);
      return assertSafeResult(
        await adapter.generateTestAssertionAsync(challengeBytes),
        "assertion_object",
      );
    },
    async clearIdentifier(): Promise<NativeAppAttestResult> {
      return assertSafeResult(await adapter.clearTestKeyIdentifierAsync());
    },
  };
}

function assertOpaqueChallengeBytes(value: string): void {
  if (value.length < 22 || value.length > 16_384 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("App Attest challenge bytes are invalid.");
  }
}

function assertSafeResult(
  value: NativeAppAttestResult,
  requiredObject?: "assertion_object" | "attestation_object",
): NativeAppAttestResult {
  const allowed = new Set([
    "app_attest_key_id", "assertion_object", "attestation_object", "passed",
    "protocol_profile", "result_class", "test_alias_only",
  ]);
  if (Object.keys(value).some((field) => !allowed.has(field))) {
    throw new Error("App Attest native result exposed a non-allowlisted field.");
  }
  if (value.test_alias_only !== true || value.protocol_profile !== "app_attest_adapter_v1") {
    throw new Error("App Attest native result violates the isolated adapter contract.");
  }
  for (const prohibited of [
    "private_key", "certificate_chain", "receipt", "counter", "native_error",
    "client_data_hash", "challenge_bytes",
  ]) {
    if (prohibited in value) throw new Error("App Attest native result exposed prohibited data.");
  }
  if (value.app_attest_key_id !== undefined && !keyIdPattern.test(value.app_attest_key_id)) {
    throw new Error("App Attest native key identifier is invalid.");
  }
  if (requiredObject && value.passed) {
    const object = value[requiredObject];
    if (typeof object !== "string" || object.length < 24 || object.length > 131_072 ||
        object.length % 4 !== 0 || !opaqueBase64Pattern.test(object)) {
      throw new Error("App Attest native opaque object is invalid.");
    }
    if (value.app_attest_key_id === undefined) {
      throw new Error("App Attest native key identifier is missing.");
    }
  }
  const otherObject = requiredObject === "assertion_object" ? "attestation_object" : "assertion_object";
  if (requiredObject && value[otherObject] !== undefined) {
    throw new Error("App Attest native result mixed opaque object types.");
  }
  return value;
}
