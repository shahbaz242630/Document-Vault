import { describe, expect, it } from "vitest";

import {
  appAttestSyntheticFixtureV1,
  assertAppAttestSyntheticFixtureV1,
} from "@vault/shared-types";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

describe("API App Attest runtime-disconnected contract", () => {
  it("validates server-owned bindings without mounting attestation or assertion routes", () => {
    const fixture = assertAppAttestSyntheticFixtureV1(appAttestSyntheticFixtureV1);
    expect(fixture.assertion_challenge.app_attest_key_id_digest).toBe(
      fixture.registration_challenge.app_attest_key_id_digest,
    );
    expect(fixture.assertion_challenge.native_enrollment_challenge_digest).toHaveLength(43);
    expect(getClaimantRuntimeConfig({ NODE_ENV: "test" }).effective.authentication).toBe(false);
  });

  it("rejects a client-supplied assertion counter", () => {
    const fixture = structuredClone(appAttestSyntheticFixtureV1) as unknown as {
      assertion_response: Record<string, unknown>;
    };
    fixture.assertion_response.counter = 1;
    expect(() => assertAppAttestSyntheticFixtureV1(fixture)).toThrow("missing or prohibited fields");
  });
});
