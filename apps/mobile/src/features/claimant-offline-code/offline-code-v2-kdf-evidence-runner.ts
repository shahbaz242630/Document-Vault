import type { OfflineCodeV2KdfBenchmark } from "./offline-code-v2-proof-core";

export const CLAIMANT_OFFLINE_CODE_V2_KDF_EVIDENCE_ENTRY_ENABLED = false as const;

export type OfflineCodeV2KdfEvidencePreconditions = Readonly<{
  build_profile: "claimant_offline_code_kdf_probe";
  device_tier: "android_baseline_supported" | "ios_baseline_supported";
  low_power_mode_confirmed: false;
  operator_confirmed: true;
  physical_device_confirmed: true;
  platform: "android" | "ios";
  production_runtime: false;
  run_id: string;
  sample_count: 5;
  synthetic_material_confirmed: true;
  thermal_state_confirmed: "nominal";
  value_free_capture: true;
}>;

export type OfflineCodeV2KdfEvidenceReport = Readonly<{
  build_profile: "claimant_offline_code_kdf_probe";
  completed_at: string;
  device_tier: "android_baseline_supported" | "ios_baseline_supported";
  measurement_complete: boolean;
  median_ms: number | null;
  p95_ms: number | null;
  platform: "android" | "ios";
  production_approved: false;
  profile_id: "argon2id-synthetic-test-v2";
  protocol: "sanduqkin:claim:offline-code:v2:kdf-evidence:v1";
  purpose: "representative_device_measurement";
  result_class: "invalid_measurement" | "measured" | "runner_error";
  run_id: string;
  sample_count: number;
  started_at: string;
  synthetic_only: true;
}>;

type RunnerInput = Readonly<{
  approved?: boolean;
  benchmark(): Promise<unknown>;
  now(): string;
}>;

const expectedKeys = [
  "build_profile", "device_tier", "low_power_mode_confirmed", "operator_confirmed",
  "physical_device_confirmed", "platform", "production_runtime", "run_id", "sample_count",
  "synthetic_material_confirmed", "thermal_state_confirmed", "value_free_capture",
] as const;
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function createOfflineCodeV2KdfEvidenceRunner(input: RunnerInput) {
  return {
    async run(value: unknown): Promise<OfflineCodeV2KdfEvidenceReport> {
      if (!(input.approved ?? CLAIMANT_OFFLINE_CODE_V2_KDF_EVIDENCE_ENTRY_ENABLED)) {
        throw new Error("Offline-code KDF evidence collection is unavailable.");
      }
      const request = assertPreconditions(value);
      const startedAt = timestamp(input.now());
      let benchmark: OfflineCodeV2KdfBenchmark | null = null;
      try {
        const candidate = await input.benchmark();
        benchmark = validBenchmark(candidate, request) ? candidate : null;
      } catch {
        return report(request, startedAt, timestamp(input.now()), "runner_error", null, null, 0);
      }
      return report(request, startedAt, timestamp(input.now()), benchmark ? "measured" : "invalid_measurement",
        benchmark?.median_ms ?? null, benchmark?.p95_ms ?? null, benchmark?.sample_count ?? 0);
    },
  };
}

function assertPreconditions(value: unknown): OfflineCodeV2KdfEvidencePreconditions {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("preconditions");
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort(); const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail("fields");
  const platform = record.platform;
  if (record.build_profile !== "claimant_offline_code_kdf_probe"
    || (platform !== "android" && platform !== "ios")
    || record.device_tier !== `${platform}_baseline_supported`
    || record.low_power_mode_confirmed !== false
    || record.operator_confirmed !== true
    || record.physical_device_confirmed !== true
    || record.production_runtime !== false
    || record.sample_count !== 5
    || record.synthetic_material_confirmed !== true
    || record.thermal_state_confirmed !== "nominal"
    || record.value_free_capture !== true
    || typeof record.run_id !== "string" || !uuidV4.test(record.run_id)) fail("preconditions");
  return record as unknown as OfflineCodeV2KdfEvidencePreconditions;
}

function validBenchmark(value: unknown,
  request: OfflineCodeV2KdfEvidencePreconditions): value is OfflineCodeV2KdfBenchmark {
  if (!exactRecord(value, ["device", "durations_ms", "median_ms", "p95_ms", "production_approved",
    "profile_id", "protocol", "purpose", "representative_device", "sample_count", "synthetic_only"])) return false;
  const record = value as Record<string, unknown>;
  if (!exactRecord(record.device, ["cryptoRuntime", "evidenceClass", "model", "osVersion", "platform"])) return false;
  const benchmark = record as unknown as OfflineCodeV2KdfBenchmark;
  if (benchmark.protocol !== "sanduqkin:claim:offline-code:v2"
    || benchmark.purpose !== "synthetic_kdf_benchmark"
    || benchmark.profile_id !== "argon2id-synthetic-test-v2"
    || benchmark.synthetic_only !== true || benchmark.production_approved !== false
    || benchmark.representative_device !== true || benchmark.sample_count !== request.sample_count
    || benchmark.device.platform !== request.platform || benchmark.device.evidenceClass !== "physical"
    || benchmark.device.cryptoRuntime !== "react-native-libsodium"
    || typeof benchmark.device.model !== "string" || typeof benchmark.device.osVersion !== "string"
    || !Array.isArray(benchmark.durations_ms)
    || benchmark.durations_ms.length !== request.sample_count) return false;
  const durations = [...benchmark.durations_ms];
  if (durations.some((duration) => !finiteTiming(duration))) return false;
  const sorted = durations.sort((left, right) => left - right);
  return benchmark.median_ms === percentile(sorted, 0.5)
    && benchmark.p95_ms === percentile(sorted, 0.95)
    && finiteTiming(benchmark.median_ms) && finiteTiming(benchmark.p95_ms);
}

function exactRecord(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function report(request: OfflineCodeV2KdfEvidencePreconditions, startedAt: string, completedAt: string,
  resultClass: OfflineCodeV2KdfEvidenceReport["result_class"], median: number | null,
  p95: number | null, samples: number): OfflineCodeV2KdfEvidenceReport {
  if (completedAt < startedAt) fail("clock");
  return {
    build_profile: request.build_profile,
    completed_at: completedAt,
    device_tier: request.device_tier,
    measurement_complete: resultClass === "measured",
    median_ms: median,
    p95_ms: p95,
    platform: request.platform,
    production_approved: false,
    profile_id: "argon2id-synthetic-test-v2",
    protocol: "sanduqkin:claim:offline-code:v2:kdf-evidence:v1",
    purpose: "representative_device_measurement",
    result_class: resultClass,
    run_id: request.run_id,
    sample_count: samples,
    started_at: startedAt,
    synthetic_only: true,
  };
}

function timestamp(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    || Number.isNaN(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) fail("clock");
  return value;
}
function finiteTiming(value: number): boolean {
  const hundredths = value * 100;
  return Number.isFinite(value) && value > 0 && value <= 60_000
    && Math.abs(hundredths - Math.round(hundredths)) < 1e-8;
}
function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? Number.NaN;
}
function fail(kind: "clock" | "fields" | "preconditions"): never {
  const message = kind === "fields" ? "Offline-code KDF evidence contains missing or prohibited fields."
    : kind === "clock" ? "Offline-code KDF evidence clock is invalid."
      : "Offline-code KDF evidence preconditions are not satisfied.";
  throw new Error(message);
}
