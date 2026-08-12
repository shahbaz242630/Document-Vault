import { describe, expect, it, vi } from "vitest";

import {
  CLAIMANT_CUSTODY_PROBE_ENABLED,
  createClaimantCustodyProbe,
  type CustodyCapability,
  type CustodyOperation,
  type CustodyProbeAdapter,
} from "./custody-probe";

function adapter(
  overrides: Partial<CustodyProbeAdapter> = {},
): CustodyProbeAdapter {
  return {
    inspectCapabilityAsync: vi.fn(async (): Promise<CustodyCapability> => ({
      result_class: "eligible",
      eligible: true,
      platform: "ios",
      key_algorithm: "p256_ecdh",
      public_key_encoding: "ansi_x9_63_uncompressed",
      hardware_security_level: "secure_enclave",
      private_key_exportable: false,
      user_presence_binding: "transaction_bound",
      test_alias_only: true,
    })),
    createTestKeyAsync: vi.fn(async (): Promise<CustodyOperation> => ({
      result_class: "created",
      passed: true,
      public_key: `B${"A".repeat(86)}`,
      public_key_fingerprint: "F".repeat(43),
      public_key_encoding: "ansi_x9_63_uncompressed",
      private_key_exportable: false,
      protocol_profile: "native_enrollment_v1",
      test_alias_only: true,
    })),
    exerciseTestKeyAsync: vi.fn(async (): Promise<CustodyOperation> => ({
      result_class: "passed",
      passed: true,
      public_key_fingerprint: "F".repeat(43),
      protocol_profile: "native_enrollment_v1",
      test_alias_only: true,
    })),
    deleteTestKeyAsync: vi.fn(async (): Promise<CustodyOperation> => ({
      result_class: "deleted",
      passed: true,
      test_alias_only: true,
    })),
    ...overrides,
  };
}

describe("claimant custody probe", () => {
  it("remains hard-disabled from application runtime", () => {
    expect(CLAIMANT_CUSTODY_PROBE_ENABLED).toBe(false);
  });

  it("passes only after capability, creation, exercise, and cleanup pass", async () => {
    const native = adapter();
    const report = await createClaimantCustodyProbe(native).run();
    expect(report.passed).toBe(true);
    expect(native.deleteTestKeyAsync).toHaveBeenCalledOnce();
  });

  it("fails closed without creating a key on an unsupported device", async () => {
    const native = adapter({
      inspectCapabilityAsync: vi.fn(async (): Promise<CustodyCapability> => ({
        result_class: "transaction_bound_auth_unavailable",
        eligible: false,
        platform: "android",
        key_algorithm: "p256_ecdh",
        public_key_encoding: "ansi_x9_63_uncompressed",
        hardware_security_level: "unknown",
        private_key_exportable: false,
        user_presence_binding: "unavailable",
        test_alias_only: true,
      })),
    });
    const report = await createClaimantCustodyProbe(native).run();
    expect(report.passed).toBe(false);
    expect(native.createTestKeyAsync).not.toHaveBeenCalled();
    expect(native.exerciseTestKeyAsync).not.toHaveBeenCalled();
    expect(native.deleteTestKeyAsync).toHaveBeenCalledOnce();
  });

  it("rejects private key or shared-secret fields from native results", async () => {
    const native = adapter({
      createTestKeyAsync: vi.fn(async () => ({
        result_class: "created",
        passed: true,
        test_alias_only: true,
        shared_secret: "forbidden",
      }) as never),
    });
    await expect(createClaimantCustodyProbe(native).run()).rejects.toThrow(
      "prohibited key material",
    );
  });

  it("fails closed when the exercised key fingerprint does not match creation", async () => {
    const native = adapter({
      exerciseTestKeyAsync: vi.fn(async (): Promise<CustodyOperation> => ({
        result_class: "passed",
        passed: true,
        public_key_fingerprint: "G".repeat(43),
        protocol_profile: "native_enrollment_v1",
        test_alias_only: true,
      })),
    });
    expect((await createClaimantCustodyProbe(native).run()).passed).toBe(false);
  });

  it("rejects padded or standard-Base64 public keys", async () => {
    const native = adapter({
      createTestKeyAsync: vi.fn(async (): Promise<CustodyOperation> => ({
        result_class: "created",
        passed: true,
        public_key: `B${"A".repeat(86)}=`,
        public_key_fingerprint: "F".repeat(43),
        protocol_profile: "native_enrollment_v1",
        test_alias_only: true,
      })),
    });
    await expect(createClaimantCustodyProbe(native).run()).rejects.toThrow(
      "non-canonical public key",
    );
  });
});
