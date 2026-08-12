import {
  createClaimantAppAttestProbe,
  type AppAttestNativeAdapter,
} from "./app-attest-adapter";

const registrationBytes = "c2FuZHVxa2luOnN5bnRoZXRpYzphcHAtYXR0ZXN0OnJlZ2lzdHJhdGlvbjp2MQ";
const assertionBytes = "c2FuZHVxa2luOnN5bnRoZXRpYzphcHAtYXR0ZXN0OmFzc2VydGlvbjp2MQ";

export const CLAIMANT_APP_ATTEST_EVIDENCE_ENTRY_ENABLED = false as const;

export type AppAttestEvidencePreconditions = {
  build_profile: "claimant_app_attest_probe";
  ios_27_or_later_confirmed: true;
  operator_confirmed: true;
  physical_device_confirmed: true;
  platform: "ios";
  production_runtime: false;
  run_id: string;
  value_free_capture: true;
};

export type AppAttestEvidenceReport = {
  assertion_result_class: string;
  cleanup_result_class: string;
  completed_at: string;
  passed: boolean;
  registration_result_class: string;
  run_id: string;
  started_at: string;
};

export function createClaimantAppAttestEvidenceRunner(
  adapter: AppAttestNativeAdapter,
  now: () => string,
) {
  return {
    async run(preconditions: AppAttestEvidencePreconditions): Promise<AppAttestEvidenceReport> {
      assertPreconditions(preconditions);
      const startedAt = now();
      const probe = createClaimantAppAttestProbe(adapter);
      let registrationResultClass = "not_attempted";
      let assertionResultClass = "not_attempted";
      let registrationPassed = false;
      let assertionPassed = false;
      let cleanupResultClass = "not_attempted";
      let cleanupPassed = false;

      try {
        const registration = await probe.register(registrationBytes);
        registrationResultClass = registration.result_class;
        registrationPassed = registration.passed;
        if (registrationPassed) {
          const assertion = await probe.assert(assertionBytes);
          assertionResultClass = assertion.result_class;
          assertionPassed = assertion.passed;
        }
      } finally {
        const cleanup = await probe.clearIdentifier();
        cleanupResultClass = cleanup.result_class;
        cleanupPassed = cleanup.passed;
      }

      return {
        assertion_result_class: assertionResultClass,
        cleanup_result_class: cleanupResultClass,
        completed_at: now(),
        passed: registrationPassed && assertionPassed && cleanupPassed,
        registration_result_class: registrationResultClass,
        run_id: preconditions.run_id,
        started_at: startedAt,
      };
    },
  };
}

function assertPreconditions(value: AppAttestEvidencePreconditions): void {
  if (value.build_profile !== "claimant_app_attest_probe" ||
      value.ios_27_or_later_confirmed !== true || value.operator_confirmed !== true ||
      value.physical_device_confirmed !== true || value.platform !== "ios" ||
      value.production_runtime !== false || value.value_free_capture !== true ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value.run_id)) {
    throw new Error("App Attest evidence preconditions are invalid.");
  }
}
