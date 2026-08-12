import { describe, expect, it } from "vitest";

import { appAttestSyntheticFixtureV1 } from "@vault/shared-types";
import {
  CLAIMANT_APP_ATTEST_RUNTIME_ENABLED,
  inspectAppAttestContractV1,
} from "./app-attest-contract";

describe("mobile App Attest runtime-disconnected contract", () => {
  it("consumes only the synthetic public contract while runtime remains disabled", () => {
    const result = inspectAppAttestContractV1(appAttestSyntheticFixtureV1);
    expect(CLAIMANT_APP_ATTEST_RUNTIME_ENABLED).toBe(false);
    expect(result.production_runtime_enabled).toBe(false);
    expect(result.protocol_profile).toBe("app_attest_binding_v1");
    expect(JSON.stringify(result)).not.toMatch(/private_key|certificate_chain|receipt|counter/iu);
  });

  it("rejects a client-added App Attest validity assertion", () => {
    const fixture = structuredClone(appAttestSyntheticFixtureV1) as unknown as {
      assertion_response: Record<string, unknown>;
    };
    fixture.assertion_response.valid = true;
    expect(() => inspectAppAttestContractV1(fixture)).toThrow("missing or prohibited fields");
  });
});
