import {
  assertAppAttestSyntheticFixtureV1,
  type AppAttestSyntheticFixtureV1,
} from "@vault/shared-types";

export const CLAIMANT_APP_ATTEST_RUNTIME_ENABLED = false as const;

export function inspectAppAttestContractV1(value: unknown): Readonly<{
  fixture: AppAttestSyntheticFixtureV1;
  production_runtime_enabled: false;
  protocol_profile: "app_attest_binding_v1";
}> {
  return {
    fixture: assertAppAttestSyntheticFixtureV1(value),
    production_runtime_enabled: CLAIMANT_APP_ATTEST_RUNTIME_ENABLED,
    protocol_profile: "app_attest_binding_v1",
  };
}
