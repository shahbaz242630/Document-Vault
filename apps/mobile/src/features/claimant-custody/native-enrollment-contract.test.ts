import { describe, expect, it } from "vitest";

import {
  assertNativeEnrollmentFixtureV1,
  nativeEnrollmentSyntheticFixtureV1,
} from "@vault/shared-types";
import { CLAIMANT_CUSTODY_PROBE_ENABLED } from "./custody-probe";

describe("mobile native enrollment contract consumer", () => {
  it("consumes only the public runtime-disconnected fixture while custody stays disabled", () => {
    expect(CLAIMANT_CUSTODY_PROBE_ENABLED).toBe(false);
    const fixture = assertNativeEnrollmentFixtureV1(nativeEnrollmentSyntheticFixtureV1);
    expect(fixture.challenge_request.capability.claimed_private_key_exportable).toBe(false);
    expect(fixture.challenge_request.public_key).toMatch(/^B[A-Za-z0-9_-]{86}$/u);
    expect(JSON.stringify(fixture)).not.toMatch(/"private_key"|shared_secret|proof_key/iu);
  });

  it("rejects a proof rebound to another device", () => {
    const fixture = structuredClone(nativeEnrollmentSyntheticFixtureV1) as unknown as {
      possession_proof: { device_binding_digest: string };
    };
    fixture.possession_proof.device_binding_digest = "99".repeat(32);
    expect(() => assertNativeEnrollmentFixtureV1(fixture)).toThrow("proof device binding");
  });
});
