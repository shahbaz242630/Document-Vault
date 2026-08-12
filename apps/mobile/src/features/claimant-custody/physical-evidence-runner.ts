import {
  createClaimantCustodyProbe,
  type CustodyProbeAdapter,
  type CustodyProbeReport,
} from "./custody-probe";

export const CLAIMANT_PHYSICAL_EVIDENCE_APP_ENTRY_ENABLED = false as const;

export type ClaimantPhysicalEvidenceRequest = Readonly<{
  build_profile: "claimant_custody_probe";
  operator_confirmed: true;
  passcode_set_confirmed: true;
  physical_device_confirmed: true;
  platform: "ios";
  production_runtime: false;
  run_id: string;
  value_free_capture: true;
}>;

export type ClaimantPhysicalEvidenceReport = Readonly<{
  build_profile: "claimant_custody_probe";
  capability_result_class: string;
  cleanup_result_class: string;
  completed_at: string;
  creation_result_class: string;
  exercise_result_class: string;
  fingerprint_continuity: boolean;
  passed: boolean;
  platform: "ios";
  protocol: "sanduqkin:claim:custody-physical-evidence:v1";
  result_class: "passed" | "failed" | "probe_error";
  run_id: string;
  started_at: string;
  test_alias_only: true;
}>;

type EvidenceClock = () => string;

const requestKeys = [
  "build_profile",
  "operator_confirmed",
  "passcode_set_confirmed",
  "physical_device_confirmed",
  "platform",
  "production_runtime",
  "run_id",
  "value_free_capture",
] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function createClaimantPhysicalEvidenceRunner(
  adapter: CustodyProbeAdapter,
  clock: EvidenceClock,
) {
  return {
    async run(value: unknown): Promise<ClaimantPhysicalEvidenceReport> {
      const request = assertRequest(value);
      const startedAt = assertTimestamp(clock());
      try {
        const report = await createClaimantCustodyProbe(adapter).run();
        return evidenceFromReport(request, report, startedAt, assertTimestamp(clock()));
      } catch {
        return {
          build_profile: request.build_profile,
          capability_result_class: "unavailable",
          cleanup_result_class: "unconfirmed_after_error",
          completed_at: assertTimestamp(clock()),
          creation_result_class: "unavailable",
          exercise_result_class: "unavailable",
          fingerprint_continuity: false,
          passed: false,
          platform: "ios",
          protocol: "sanduqkin:claim:custody-physical-evidence:v1",
          result_class: "probe_error",
          run_id: request.run_id,
          started_at: startedAt,
          test_alias_only: true,
        };
      }
    },
  };
}

function assertRequest(value: unknown): ClaimantPhysicalEvidenceRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Claimant physical evidence request must be an object.");
  }
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  const expectedKeys = [...requestKeys].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("Claimant physical evidence request contains missing or prohibited fields.");
  }
  if (
    record.build_profile !== "claimant_custody_probe" ||
    record.operator_confirmed !== true ||
    record.passcode_set_confirmed !== true ||
    record.physical_device_confirmed !== true ||
    record.platform !== "ios" ||
    record.production_runtime !== false ||
    record.value_free_capture !== true ||
    typeof record.run_id !== "string" ||
    !uuidPattern.test(record.run_id)
  ) {
    throw new Error("Claimant physical evidence preconditions are not satisfied.");
  }
  return record as unknown as ClaimantPhysicalEvidenceRequest;
}

function evidenceFromReport(
  request: ClaimantPhysicalEvidenceRequest,
  report: CustodyProbeReport,
  startedAt: string,
  completedAt: string,
): ClaimantPhysicalEvidenceReport {
  const fingerprintContinuity =
    report.creation?.public_key_fingerprint !== undefined &&
    report.creation.public_key_fingerprint === report.exercise?.public_key_fingerprint;
  return {
    build_profile: request.build_profile,
    capability_result_class: report.capability.result_class,
    cleanup_result_class: report.cleanup.result_class,
    completed_at: completedAt,
    creation_result_class: report.creation?.result_class ?? "not_run",
    exercise_result_class: report.exercise?.result_class ?? "not_run",
    fingerprint_continuity: fingerprintContinuity,
    passed: report.passed && fingerprintContinuity,
    platform: "ios",
    protocol: "sanduqkin:claim:custody-physical-evidence:v1",
    result_class: report.passed && fingerprintContinuity ? "passed" : "failed",
    run_id: request.run_id,
    started_at: startedAt,
    test_alias_only: true,
  };
}

function assertTimestamp(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error("Claimant physical evidence clock is invalid.");
  }
  return value;
}
