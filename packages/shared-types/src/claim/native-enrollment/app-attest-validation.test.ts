import { describe, expect, it } from "vitest";

import { appAttestSyntheticFixtureV1 } from "./app-attest-fixtures";
import { assertAppAttestSyntheticFixtureV1 } from "./app-attest-validation";

describe("App Attest V1 boundary validation", () => {
  it("accepts the strict synthetic production/TestFlight fixture", () => {
    expect(assertAppAttestSyntheticFixtureV1(appAttestSyntheticFixtureV1)).toEqual(
      appAttestSyntheticFixtureV1,
    );
  });

  it("rejects client claims about counters, validity, receipts, certificates, or app authority", () => {
    for (const [field, value] of [
      ["counter", 1], ["valid", true], ["receipt", "prohibited"],
      ["certificate_chain", "prohibited"], ["rp_id_valid", true], ["aaguid", "production"],
      ["claimant_public_key", "prohibited"], ["private_key", "prohibited"],
    ] as const) {
      const fixture = structuredClone(appAttestSyntheticFixtureV1) as unknown as {
        assertion_response: Record<string, unknown>;
      };
      fixture.assertion_response[field] = value;
      expect(() => assertAppAttestSyntheticFixtureV1(fixture)).toThrow("missing or prohibited fields");
    }
  });

  it("rejects cross-key, cross-session, environment, and app-identity rebinding", () => {
    for (const mutate of [
      (fixture: MutableFixture) => { fixture.assertion_response.app_attest_key_id = replacementKeyId; },
      (fixture: MutableFixture) => { fixture.assertion_challenge.portal_session_id = "81000000-0000-4000-8000-000000000019"; },
      (fixture: MutableFixture) => { fixture.assertion_challenge.app_id_hash = `${"A".repeat(42)}A`; },
      (fixture: MutableFixture) => { fixture.assertion_challenge.required_bundle_version = "2"; },
    ]) {
      const fixture = structuredClone(appAttestSyntheticFixtureV1) as unknown as MutableFixture;
      mutate(fixture);
      expect(() => assertAppAttestSyntheticFixtureV1(fixture)).toThrow("binding is invalid");
    }
  });

  it("rejects noncanonical key identifiers, unsafe versions, wrong TTLs, and distributed development mode", () => {
    const cases = [
      (fixture: MutableFixture) => { fixture.assertion_response.app_attest_key_id = `${"A".repeat(42)}B=`; },
      (fixture: MutableFixture) => { fixture.assertion_challenge.claimant_key_version = Number.MAX_SAFE_INTEGER + 1; },
      (fixture: MutableFixture) => { fixture.assertion_challenge.expires_at = "2026-07-28T08:14:59.999Z"; },
      (fixture: MutableFixture) => { fixture.assertion_challenge.environment = "development"; },
      (fixture: MutableFixture) => { fixture.registration_challenge.api_audience = "not a URL"; },
      (fixture: MutableFixture) => { fixture.assertion_challenge.assertion_object = "prohibited"; },
    ];
    for (const mutate of cases) {
      const fixture = structuredClone(appAttestSyntheticFixtureV1) as unknown as MutableFixture;
      mutate(fixture);
      expect(() => assertAppAttestSyntheticFixtureV1(fixture)).toThrow();
    }
  });
});

type MutableFixture = {
  assertion_challenge: Record<string, unknown>;
  assertion_response: Record<string, unknown>;
  registration_challenge: Record<string, unknown>;
  registration_response: Record<string, unknown>;
};

const replacementKeyId = `${"B".repeat(42)}E=`;
