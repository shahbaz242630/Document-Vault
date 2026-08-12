import { requireOptionalNativeModule } from "expo-modules-core";

export type NativeCustodyCapability = {
  result_class: string;
  eligible: boolean;
  platform: "ios" | "android";
  key_algorithm: "p256_ecdh";
  public_key_encoding: "ansi_x9_63_uncompressed";
  hardware_security_level:
    | "secure_enclave"
    | "strongbox"
    | "trusted_environment"
    | "software"
    | "none"
    | "unknown";
  private_key_exportable: false;
  user_presence_binding:
    | "transaction_bound"
    | "unavailable"
    | "per_use_key_policy_unexercised";
  test_alias_only: true;
};

export type NativeCustodyOperation = {
  result_class: string;
  passed: boolean;
  public_key?: string;
  public_key_fingerprint?: string;
  public_key_encoding?: "ansi_x9_63_uncompressed";
  hardware_security_level?: string;
  private_key_exportable?: false;
  protocol_profile?: "native_enrollment_v1";
  user_presence_binding?: string;
  test_alias_only: true;
};

export type ClaimantKeyCustodyNativeModule = {
  inspectCapabilityAsync(): Promise<NativeCustodyCapability>;
  createTestKeyAsync(): Promise<NativeCustodyOperation>;
  exerciseTestKeyAsync(): Promise<NativeCustodyOperation>;
  deleteTestKeyAsync(): Promise<NativeCustodyOperation>;
};

export const claimantKeyCustodyNative =
  requireOptionalNativeModule<ClaimantKeyCustodyNativeModule>(
    "ClaimantKeyCustody",
  );

export type NativeAppAttestResult = {
  result_class: string;
  passed: boolean;
  protocol_profile: "app_attest_adapter_v1";
  test_alias_only: true;
  app_attest_key_id?: string;
  attestation_object?: string;
  assertion_object?: string;
};

export type ClaimantAppAttestNativeModule = {
  inspectCapabilityAsync(): Promise<NativeAppAttestResult>;
  ensureTestKeyAsync(): Promise<NativeAppAttestResult>;
  attestTestKeyAsync(challengeBytes: string): Promise<NativeAppAttestResult>;
  generateTestAssertionAsync(challengeBytes: string): Promise<NativeAppAttestResult>;
  clearTestKeyIdentifierAsync(): Promise<NativeAppAttestResult>;
};

export const claimantAppAttestNative =
  requireOptionalNativeModule<ClaimantAppAttestNativeModule>("ClaimantAppAttest");
