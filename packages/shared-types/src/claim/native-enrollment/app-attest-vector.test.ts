import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { canonicalJson, type CanonicalJsonValue } from "../canonical-json";
import type {
  AppAttestAssertionChallengeV1,
  AppAttestRegistrationChallengeV1,
  AppAttestSyntheticFixtureV1,
} from "./app-attest-contracts";
import { APP_ATTEST_KEY_ID_DIGEST_LABEL_V1 } from "./app-attest-protocol";
import { assertAppAttestSyntheticFixtureV1 } from "./app-attest-validation";

type Vector = AppAttestSyntheticFixtureV1 & {
  meta: { production_data: false; synthetic_only: true };
  assertion_client_data: string;
  assertion_client_data_hash: string;
  registration_client_data: string;
  registration_client_data_hash: string;
  synthetic_inputs: {
    app_attest_key_id_bytes: string;
    opaque_objects_are_apple_issued: false;
  };
};

const vectorPath = fileURLToPath(
  new URL("../../../test-vectors/claim/app-attest-binding-v1.json", import.meta.url),
);
const vector = JSON.parse(readFileSync(vectorPath, "utf8")) as Vector;

describe("App Attest binding V1 vector", () => {
  it("reproduces both canonical clientData hashes and the domain-separated key-ID digest", () => {
    expect(vector.meta).toMatchObject({ production_data: false, synthetic_only: true });
    expect(vector.synthetic_inputs.opaque_objects_are_apple_issued).toBe(false);
    expect(assertAppAttestSyntheticFixtureV1({
      assertion_challenge: vector.assertion_challenge,
      assertion_response: vector.assertion_response,
      registration_challenge: vector.registration_challenge,
      registration_response: vector.registration_response,
    })).toEqual({
      assertion_challenge: vector.assertion_challenge,
      assertion_response: vector.assertion_response,
      registration_challenge: vector.registration_challenge,
      registration_response: vector.registration_response,
    });

    checkClientData(vector.registration_challenge, vector.registration_client_data, vector.registration_client_data_hash);
    checkClientData(vector.assertion_challenge, vector.assertion_client_data, vector.assertion_client_data_hash);

    const keyIdDigest = sha256(concat(
      utf8(APP_ATTEST_KEY_ID_DIGEST_LABEL_V1),
      Uint8Array.of(0),
      decodeUrl(vector.synthetic_inputs.app_attest_key_id_bytes),
    ));
    expect(encodeUrl(keyIdDigest)).toBe(vector.registration_challenge.app_attest_key_id_digest);
    expect(Buffer.from(vector.registration_response.app_attest_key_id, "base64")).toEqual(
      Buffer.from(decodeUrl(vector.synthetic_inputs.app_attest_key_id_bytes)),
    );
  });

  it("changes the assertion clientData hash for every bound field", () => {
    const mutations: Partial<Record<keyof AppAttestAssertionChallengeV1, unknown>>[] = [
      { protocol: "sanduqkin:claim:native-enrollment:app-attest-assertion:v2" },
      { challenge_id: "71000000-0000-4000-8000-000000000003" },
      { claimant_id: "21000000-0000-4000-8000-000000000003" },
      { claimant_key_id: "31000000-0000-4000-8000-000000000014" },
      { claimant_key_version: 2 }, { public_key_fingerprint: `${"A".repeat(42)}A` },
      { invitation_reference: "51000000-0000-4000-8000-000000000006" },
      { invitation_version: 3 }, { portal_session_id: "81000000-0000-4000-8000-000000000019" },
      { app_attest_key_id_digest: `${"A".repeat(42)}A` }, { app_id_hash: `${"B".repeat(42)}E` },
      { environment: "development" }, { required_bundle_version: "2" },
      { required_validation_category: 4 }, { native_enrollment_challenge_digest: `${"C".repeat(42)}I` },
      { api_audience: "https://other.sanduqkin.test" },
      { issued_at: "2026-07-28T08:10:01.000Z" }, { expires_at: "2026-07-28T08:15:01.000Z" },
      { nonce: `${"D".repeat(42)}M` },
    ];
    const expected = vector.assertion_client_data_hash;
    for (const mutation of mutations) {
      const changed = { ...vector.assertion_challenge, ...mutation } as AppAttestAssertionChallengeV1;
      expect(encodeUrl(sha256(utf8(canonicalJson(changed as unknown as CanonicalJsonValue))))).not.toBe(
        expected,
      );
    }
  });

  it("changes the registration clientData hash for every bound field", () => {
    const mutations: Partial<Record<keyof AppAttestRegistrationChallengeV1, unknown>>[] = [
      { protocol: "sanduqkin:claim:native-enrollment:app-attest-registration:v2" },
      { challenge_id: "71000000-0000-4000-8000-000000000003" },
      { claimant_id: "21000000-0000-4000-8000-000000000003" },
      { portal_session_id: "81000000-0000-4000-8000-000000000019" },
      { app_attest_key_id_digest: `${"A".repeat(42)}A` }, { app_id_hash: `${"B".repeat(42)}E` },
      { environment: "development" }, { required_bundle_version: "2" },
      { required_validation_category: 4 }, { issued_at: "2026-07-28T08:00:01.000Z" },
      { expires_at: "2026-07-28T08:05:01.000Z" }, { nonce: `${"D".repeat(42)}M` },
    ];
    const expected = vector.registration_client_data_hash;
    for (const mutation of mutations) {
      const changed = { ...vector.registration_challenge, ...mutation } as AppAttestRegistrationChallengeV1;
      expect(encodeUrl(sha256(utf8(canonicalJson(changed as unknown as CanonicalJsonValue))))).not.toBe(
        expected,
      );
    }
  });
});

function checkClientData(value: object, expectedBytes: string, expectedHash: string): void {
  const bytes = utf8(canonicalJson(value as CanonicalJsonValue));
  expect(encodeUrl(bytes)).toBe(expectedBytes);
  expect(encodeUrl(sha256(bytes))).toBe(expectedHash);
}

function sha256(value: Uint8Array): Uint8Array { return new Uint8Array(createHash("sha256").update(value).digest()); }
function utf8(value: string): Uint8Array { return new TextEncoder().encode(value); }
function encodeUrl(value: Uint8Array): string { return Buffer.from(value).toString("base64url"); }
function decodeUrl(value: string): Uint8Array { return new Uint8Array(Buffer.from(value, "base64url")); }
function concat(...values: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(values.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of values) { output.set(value, offset); offset += value.length; }
  return output;
}
