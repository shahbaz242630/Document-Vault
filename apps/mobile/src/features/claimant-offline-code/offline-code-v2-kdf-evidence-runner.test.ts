import { describe, expect, it, vi } from "vitest";

import type { OfflineCodeV2KdfBenchmark } from "./offline-code-v2-proof-core";
import {
  CLAIMANT_OFFLINE_CODE_V2_KDF_EVIDENCE_ENTRY_ENABLED,
  createOfflineCodeV2KdfEvidenceRunner,
} from "./offline-code-v2-kdf-evidence-runner";

const preconditions = {
  build_profile: "claimant_offline_code_kdf_probe",
  device_tier: "ios_baseline_supported",
  low_power_mode_confirmed: false,
  operator_confirmed: true,
  physical_device_confirmed: true,
  platform: "ios",
  production_runtime: false,
  run_id: "72000000-0000-4000-8000-000000000002",
  sample_count: 5,
  synthetic_material_confirmed: true,
  thermal_state_confirmed: "nominal",
  value_free_capture: true,
} as const;

describe("offline-code V2 KDF physical evidence runner", () => {
  it("has no application entry point and stays disabled before benchmark execution", async () => {
    const benchmark = vi.fn(async () => report());
    expect(CLAIMANT_OFFLINE_CODE_V2_KDF_EVIDENCE_ENTRY_ENABLED).toBe(false);
    await expect(runner(benchmark, false).run(preconditions)).rejects.toThrow("unavailable");
    expect(benchmark).not.toHaveBeenCalled();
  });

  it("emits bounded value-free measurement evidence without approving production", async () => {
    const result = await runner(vi.fn(async () => report()), true).run(preconditions);
    expect(result).toEqual({
      build_profile: "claimant_offline_code_kdf_probe",
      completed_at: "2030-01-01T00:00:01.000Z",
      device_tier: "ios_baseline_supported",
      measurement_complete: true,
      median_ms: 300,
      p95_ms: 500,
      platform: "ios",
      production_approved: false,
      profile_id: "argon2id-synthetic-test-v2",
      protocol: "sanduqkin:claim:offline-code:v2:kdf-evidence:v1",
      purpose: "representative_device_measurement",
      result_class: "measured",
      run_id: preconditions.run_id,
      sample_count: 5,
      started_at: "2030-01-01T00:00:00.000Z",
      synthetic_only: true,
    });
    expect(JSON.stringify(result)).not.toMatch(/model|osVersion|duration|secret|salt|root|proof/iu);
  });

  it("rejects every relaxed precondition and extra device identity before execution", async () => {
    for (const mutation of [
      { physical_device_confirmed: false }, { operator_confirmed: false },
      { production_runtime: true }, { synthetic_material_confirmed: false },
      { value_free_capture: false }, { low_power_mode_confirmed: true },
      { thermal_state_confirmed: "serious" }, { sample_count: 4 },
      { platform: "android" }, { device_tier: "premium" },
    ]) {
      const benchmark = vi.fn(async () => report());
      await expect(runner(benchmark, true).run({ ...preconditions, ...mutation })).rejects.toThrow("preconditions");
      expect(benchmark).not.toHaveBeenCalled();
    }
    await expect(runner(vi.fn(async () => report()), true).run({
      ...preconditions, device_identifier: "prohibited",
    })).rejects.toThrow("missing or prohibited fields");
  });

  it("classifies substituted, simulator, malformed, or inconsistent benchmark reports as invalid", async () => {
    const hostile: OfflineCodeV2KdfBenchmark[] = [
      { ...report(), production_approved: true as never },
      { ...report(), representative_device: false },
      { ...report(), device: { ...report().device, evidenceClass: "simulator" } },
      { ...report(), device: { ...report().device, platform: "android" } },
      { ...report(), profile_id: "argon2id-production" },
      { ...report(), sample_count: 4 },
      { ...report(), durations_ms: [100, 200, 300, 400, 60_001] },
      { ...report(), median_ms: 301 },
      { ...report(), device: undefined as never },
      { ...report(), unexpected: "field" } as never,
    ];
    for (const value of hostile) {
      const result = await runner(vi.fn(async () => value), true).run(preconditions);
      expect(result).toMatchObject({ result_class: "invalid_measurement",
        measurement_complete: false, median_ms: null, p95_ms: null, sample_count: 0,
        production_approved: false });
    }
  });

  it("redacts runner failures and fails closed on an invalid clock", async () => {
    const failure = await runner(vi.fn(async () => { throw new Error("sensitive native detail"); }), true)
      .run(preconditions);
    expect(failure.result_class).toBe("runner_error");
    expect(JSON.stringify(failure)).not.toContain("sensitive native detail");
    const invalidClock = createOfflineCodeV2KdfEvidenceRunner({ approved: true,
      benchmark: async () => report(), now: () => "not-a-time" });
    await expect(invalidClock.run(preconditions)).rejects.toThrow("clock");
  });
});

function runner(benchmark: () => Promise<OfflineCodeV2KdfBenchmark>, approved: boolean) {
  const times = ["2030-01-01T00:00:00.000Z", "2030-01-01T00:00:01.000Z"];
  return createOfflineCodeV2KdfEvidenceRunner({ approved, benchmark, now: () => times.shift() ?? "" });
}
function report(): OfflineCodeV2KdfBenchmark {
  return {
    protocol: "sanduqkin:claim:offline-code:v2",
    purpose: "synthetic_kdf_benchmark",
    profile_id: "argon2id-synthetic-test-v2",
    synthetic_only: true,
    production_approved: false,
    representative_device: true,
    sample_count: 5,
    durations_ms: [100, 200, 300, 400, 500],
    median_ms: 300,
    p95_ms: 500,
    device: { platform: "ios", evidenceClass: "physical", model: "redacted by evidence runner",
      osVersion: "test", cryptoRuntime: "react-native-libsodium" },
  };
}
