import { describe, expect, it, vi } from "vitest";

import type { NativeAppAttestResult } from "../../../modules/claimant-key-custody/src";
import type { AppAttestNativeAdapter } from "./app-attest-adapter";
import {
  CLAIMANT_APP_ATTEST_EVIDENCE_ENTRY_ENABLED,
  createClaimantAppAttestEvidenceRunner,
  type AppAttestEvidencePreconditions,
} from "./app-attest-evidence-runner";

describe("App Attest physical evidence coordinator", () => {
  it("stays disabled and emits only generic value-free results", async () => {
    const adapter = createAdapter();
    const runner = createClaimantAppAttestEvidenceRunner(adapter, timestamps());
    const report = await runner.run(preconditions());
    expect(CLAIMANT_APP_ATTEST_EVIDENCE_ENTRY_ENABLED).toBe(false);
    expect(report).toMatchObject({
      assertion_result_class: "assertion_generated",
      cleanup_result_class: "local_reference_cleared",
      passed: true,
      registration_result_class: "attestation_generated",
    });
    expect(JSON.stringify(report)).not.toMatch(
      /key_id|attestation_object|assertion_object|receipt|counter|certificate|native_error|challenge/iu,
    );
  });

  it("always clears the local identifier after registration failure", async () => {
    const adapter = createAdapter();
    adapter.attestTestKeyAsync = vi.fn(async () => safeResult("attestation_failed", false));
    const report = await createClaimantAppAttestEvidenceRunner(adapter, timestamps())
      .run(preconditions());
    expect(adapter.clearTestKeyIdentifierAsync).toHaveBeenCalledOnce();
    expect(report.passed).toBe(false);
    expect(report.assertion_result_class).toBe("not_attempted");
  });

  it("rejects non-physical, pre-iOS-27, or production preconditions", async () => {
    for (const mutation of [
      { physical_device_confirmed: false },
      { ios_27_or_later_confirmed: false },
      { production_runtime: true },
    ]) {
      await expect(createClaimantAppAttestEvidenceRunner(createAdapter(), timestamps()).run({
        ...preconditions(), ...mutation,
      } as never)).rejects.toThrow("preconditions are invalid");
    }
  });
});

function createAdapter(): AppAttestNativeAdapter & Record<string, ReturnType<typeof vi.fn>> {
  const keyId = `${"A".repeat(42)}A=`;
  return {
    inspectCapabilityAsync: vi.fn(async () => safeResult("eligible", true)),
    ensureTestKeyAsync: vi.fn(async () => ({ ...safeResult("key_generated", true), app_attest_key_id: keyId })),
    attestTestKeyAsync: vi.fn(async () => ({
      ...safeResult("attestation_generated", true), app_attest_key_id: keyId,
      attestation_object: Buffer.alloc(32, 1).toString("base64"),
    })),
    generateTestAssertionAsync: vi.fn(async () => ({
      ...safeResult("assertion_generated", true), app_attest_key_id: keyId,
      assertion_object: Buffer.alloc(32, 2).toString("base64"),
    })),
    clearTestKeyIdentifierAsync: vi.fn(async () => safeResult("local_reference_cleared", true)),
  } as never;
}

function safeResult(result_class: string, passed: boolean): NativeAppAttestResult {
  return { result_class, passed, protocol_profile: "app_attest_adapter_v1", test_alias_only: true };
}

function preconditions(): AppAttestEvidencePreconditions {
  return {
    build_profile: "claimant_app_attest_probe",
    ios_27_or_later_confirmed: true,
    operator_confirmed: true,
    physical_device_confirmed: true,
    platform: "ios",
    production_runtime: false,
    run_id: "71000000-0000-4000-8000-000000000001",
    value_free_capture: true,
  };
}

function timestamps() {
  const values = ["2026-08-12T08:00:00.000Z", "2026-08-12T08:00:01.000Z"];
  return () => values.shift() ?? "2026-08-12T08:00:01.000Z";
}
