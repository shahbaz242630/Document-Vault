import { describe, expect, it } from "vitest";

import {
  assertNativeEnrollmentFixtureV1,
  nativeEnrollmentSyntheticFixtureV1,
} from "@vault/shared-types";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

describe("API native enrollment contract consumer", () => {
  it("validates the same fixture without mounting a challenge route", () => {
    const fixture = assertNativeEnrollmentFixtureV1(nativeEnrollmentSyntheticFixtureV1);
    expect(fixture.possession_proof.challenge_id).toBe(fixture.challenge.challenge_id);
    expect(getClaimantRuntimeConfig({ NODE_ENV: "test" }).effective.authentication).toBe(false);
  });

  it("rejects client/server policy-version drift", () => {
    const fixture = structuredClone(nativeEnrollmentSyntheticFixtureV1) as unknown as {
      challenge: { policy_pack_version: number };
    };
    fixture.challenge.policy_pack_version += 1;
    expect(() => assertNativeEnrollmentFixtureV1(fixture)).toThrow("policy-version binding");
  });
});
