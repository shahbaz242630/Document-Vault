import { describe, expect, it } from "vitest";

import { nativeEnrollmentSyntheticFixtureV1 } from "./fixtures";
import { assertNativeEnrollmentFixtureV1, assertNativeEnrollmentIssuedChallengeV1 } from "./validation";

describe("native enrollment boundary validation", () => {
  it("accepts the strict deterministic iOS Secure Enclave fixture", () => {
    expect(assertNativeEnrollmentFixtureV1(nativeEnrollmentSyntheticFixtureV1)).toEqual(
      nativeEnrollmentSyntheticFixtureV1,
    );
  });

  it("requires clients to authenticate the exact opaque server-issued challenge bytes", () => {
    expect(assertNativeEnrollmentIssuedChallengeV1({
      challenge: nativeEnrollmentSyntheticFixtureV1.challenge,
      challenge_bytes: nativeEnrollmentSyntheticFixtureV1.challenge_bytes,
    })).toEqual({
      challenge: nativeEnrollmentSyntheticFixtureV1.challenge,
      challenge_bytes: nativeEnrollmentSyntheticFixtureV1.challenge_bytes,
    });
    expect(() => assertNativeEnrollmentIssuedChallengeV1({
      challenge: nativeEnrollmentSyntheticFixtureV1.challenge,
      challenge_bytes: `${nativeEnrollmentSyntheticFixtureV1.challenge_bytes}A`,
    })).toThrow("challenge-byte binding");
  });

  it("rejects client actor, address, eligibility, acceptance, and private material", () => {
    for (const prohibited of [
      ["user_id", "11111111-1111-4111-8111-111111111111"],
      ["recipient_address_digest", "aa".repeat(32)],
      ["email", "synthetic@example.com"],
      ["eligible", true],
      ["accepted", true],
      ["private_key", "prohibited"],
      ["shared_secret", "prohibited"],
      ["proof_key", "prohibited"],
    ] as const) {
      const fixture = structuredClone(nativeEnrollmentSyntheticFixtureV1) as unknown as Record<string, Record<string, unknown>>;
      fixture.challenge_request[prohibited[0]] = prohibited[1];
      expect(() => assertNativeEnrollmentFixtureV1(fixture)).toThrow("missing or prohibited fields");
    }
  });

  it("rejects altered cross-object bindings and unsupported Android/software capability", () => {
    const altered = structuredClone(nativeEnrollmentSyntheticFixtureV1) as unknown as {
      possession_proof: { public_key_fingerprint: string };
    };
    altered.possession_proof.public_key_fingerprint = `${"G".repeat(42)}Q`;
    expect(() => assertNativeEnrollmentFixtureV1(altered)).toThrow("proof fingerprint binding");

    const android = structuredClone(nativeEnrollmentSyntheticFixtureV1) as unknown as {
      challenge_request: { capability: Record<string, unknown> };
    };
    Object.assign(android.challenge_request.capability, {
      claimed_hardware_security_level: "trusted_environment",
      platform: "android",
      claimed_user_presence_binding: "unavailable",
    });
    expect(() => assertNativeEnrollmentFixtureV1(android)).toThrow("not eligible");
  });

  it("rejects non-canonical encodings, non-v4 invitation locators, unsafe versions, and non-300-second windows", () => {
    type MutableFixture = {
      challenge: Record<string, unknown>;
      challenge_request: Record<string, unknown>;
    };
    const cases: ((fixture: MutableFixture) => void)[] = [
      (fixture) => { fixture.challenge_request.public_key = `BQ${"A".repeat(85)}`; },
      (fixture) => { fixture.challenge.public_key_fingerprint = `${"A".repeat(42)}B`; },
      (fixture) => { fixture.challenge.invitation_reference = "11111111-1111-1111-8111-111111111111"; },
      (fixture) => { fixture.challenge.policy_pack_version = Number.MAX_SAFE_INTEGER + 1; },
      (fixture) => { fixture.challenge.expires_at = "2030-01-01T00:04:59.999Z"; },
    ];

    for (const mutate of cases) {
      const fixture = structuredClone(nativeEnrollmentSyntheticFixtureV1) as unknown as MutableFixture;
      mutate(fixture);
      expect(() => assertNativeEnrollmentFixtureV1(fixture)).toThrow();
    }
  });
});
