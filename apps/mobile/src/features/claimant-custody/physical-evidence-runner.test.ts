import { describe, expect, it, vi } from "vitest";

import type {
  CustodyCapability,
  CustodyOperation,
  CustodyProbeAdapter,
} from "./custody-probe";
import {
  CLAIMANT_PHYSICAL_EVIDENCE_APP_ENTRY_ENABLED,
  createClaimantPhysicalEvidenceRunner,
} from "./physical-evidence-runner";

const request = {
  build_profile: "claimant_custody_probe",
  operator_confirmed: true,
  passcode_set_confirmed: true,
  physical_device_confirmed: true,
  platform: "ios",
  production_runtime: false,
  run_id: "71000000-0000-4000-8000-000000000001",
  value_free_capture: true,
} as const;

function adapter(overrides: Partial<CustodyProbeAdapter> = {}): CustodyProbeAdapter {
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

function clock() {
  const values = ["2030-01-01T00:00:00.000Z", "2030-01-01T00:00:01.000Z"];
  return () => values.shift() ?? "2030-01-01T00:00:02.000Z";
}

describe("claimant physical evidence runner", () => {
  it("has no application entry point", () => {
    expect(CLAIMANT_PHYSICAL_EVIDENCE_APP_ENTRY_ENABLED).toBe(false);
  });

  it("emits only value-free result classes after a complete probe", async () => {
    const report = await createClaimantPhysicalEvidenceRunner(adapter(), clock()).run(request);
    expect(report).toMatchObject({
      passed: true,
      result_class: "passed",
      fingerprint_continuity: true,
      cleanup_result_class: "deleted",
      test_alias_only: true,
    });
    expect(JSON.stringify(report)).not.toMatch(/public_key|fingerprint_value|proof|nonce|salt|challenge/iu);
  });

  it("rejects every relaxed physical-run precondition before touching native code", async () => {
    for (const mutation of [
      { production_runtime: true },
      { physical_device_confirmed: false },
      { passcode_set_confirmed: false },
      { operator_confirmed: false },
      { value_free_capture: false },
      { platform: "android" },
      { build_profile: "production" },
    ]) {
      const native = adapter();
      await expect(
        createClaimantPhysicalEvidenceRunner(native, clock()).run({ ...request, ...mutation }),
      ).rejects.toThrow("preconditions");
      expect(native.inspectCapabilityAsync).not.toHaveBeenCalled();
    }
  });

  it("rejects extra identifiers or device metadata", async () => {
    await expect(
      createClaimantPhysicalEvidenceRunner(adapter(), clock()).run({
        ...request,
        device_identifier: "prohibited",
      }),
    ).rejects.toThrow("missing or prohibited fields");
  });

  it("redacts native errors and still invokes cleanup", async () => {
    const native = adapter({
      createTestKeyAsync: vi.fn(async () => {
        throw new Error("sensitive native detail");
      }),
    });
    const report = await createClaimantPhysicalEvidenceRunner(native, clock()).run(request);
    expect(report.result_class).toBe("probe_error");
    expect(JSON.stringify(report)).not.toContain("sensitive native detail");
    expect(native.deleteTestKeyAsync).toHaveBeenCalledOnce();
  });
});
