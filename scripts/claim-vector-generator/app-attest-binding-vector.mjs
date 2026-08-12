import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

const REGISTRATION_PROTOCOL = "sanduqkin:claim:native-enrollment:app-attest-registration:v1";
const ASSERTION_PROTOCOL = "sanduqkin:claim:native-enrollment:app-attest-assertion:v1";
const KEY_ID_DIGEST_LABEL = "sanduqkin:claim:native-enrollment:app-attest-key-id:v1";

export function createAppAttestBindingVector({
  base64url,
  canonicalJson,
  nativeEnrollmentProofVector,
  syntheticMeta,
}) {
  const keyIdBytes = bytesFromRange(1, 32);
  const keyId = Buffer.from(keyIdBytes).toString("base64");
  const keyIdDigest = sha256(concat(utf8(KEY_ID_DIGEST_LABEL), Uint8Array.of(0), keyIdBytes));
  const syntheticAppId = "ABCDE12345.com.sanduqkin.synthetic";
  const appIdHash = sha256(utf8(syntheticAppId));
  const registrationChallenge = {
    protocol: REGISTRATION_PROTOCOL,
    api_audience: nativeEnrollmentProofVector.challenge.origin,
    challenge_id: "71000000-0000-4000-8000-000000000001",
    claimant_id: nativeEnrollmentProofVector.challenge.claimant_id,
    portal_session_id: "81000000-0000-4000-8000-000000000018",
    app_attest_key_id_digest: base64url(keyIdDigest),
    app_id_hash: base64url(appIdHash),
    environment: "production",
    required_bundle_version: "1",
    required_validation_category: 2,
    issued_at: "2026-07-28T08:00:00.000Z",
    expires_at: "2026-07-28T08:05:00.000Z",
    nonce: base64url(bytesFromRange(81, 32)),
  };
  const assertionChallenge = {
    protocol: ASSERTION_PROTOCOL,
    challenge_id: "71000000-0000-4000-8000-000000000002",
    claimant_id: nativeEnrollmentProofVector.challenge.claimant_id,
    claimant_key_id: nativeEnrollmentProofVector.challenge.claimant_key_id,
    claimant_key_version: nativeEnrollmentProofVector.challenge.claimant_key_version,
    public_key_fingerprint: nativeEnrollmentProofVector.challenge.public_key_fingerprint,
    invitation_reference: nativeEnrollmentProofVector.challenge.invitation_reference,
    invitation_version: nativeEnrollmentProofVector.challenge.invitation_version,
    portal_session_id: registrationChallenge.portal_session_id,
    app_attest_key_id_digest: registrationChallenge.app_attest_key_id_digest,
    app_id_hash: registrationChallenge.app_id_hash,
    environment: registrationChallenge.environment,
    required_bundle_version: registrationChallenge.required_bundle_version,
    required_validation_category: registrationChallenge.required_validation_category,
    native_enrollment_challenge_digest: nativeEnrollmentProofVector.challenge_digest,
    api_audience: nativeEnrollmentProofVector.challenge.origin,
    issued_at: "2026-07-28T08:10:00.000Z",
    expires_at: "2026-07-28T08:15:00.000Z",
    nonce: base64url(bytesFromRange(113, 32)),
  };
  const registrationBytes = utf8(canonicalJson(registrationChallenge));
  const assertionBytes = utf8(canonicalJson(assertionChallenge));

  return {
    meta: {
      ...syntheticMeta,
      warning: "Opaque objects are synthetic bytes, not Apple attestations or assertions.",
    },
    app_attest_key_id_digest_label: KEY_ID_DIGEST_LABEL,
    synthetic_inputs: {
      app_id: syntheticAppId,
      app_attest_key_id_bytes: base64url(keyIdBytes),
      opaque_objects_are_apple_issued: false,
    },
    registration_challenge: registrationChallenge,
    registration_client_data: base64url(registrationBytes),
    registration_client_data_hash: base64url(sha256(registrationBytes)),
    registration_response: {
      protocol: REGISTRATION_PROTOCOL,
      challenge_id: registrationChallenge.challenge_id,
      app_attest_key_id: keyId,
      attestation_object: Buffer.from(bytesFromRange(145, 64)).toString("base64"),
    },
    assertion_challenge: assertionChallenge,
    assertion_client_data: base64url(assertionBytes),
    assertion_client_data_hash: base64url(sha256(assertionBytes)),
    assertion_response: {
      protocol: ASSERTION_PROTOCOL,
      challenge_id: assertionChallenge.challenge_id,
      app_attest_key_id: keyId,
      assertion_object: Buffer.from(bytesFromRange(209, 48)).toString("base64"),
    },
    negative_cases: [
      "changed_native_enrollment_challenge_digest", "changed_claimant_key_fingerprint",
      "changed_claimant_or_session", "changed_invitation_or_version", "changed_app_id_hash",
      "changed_environment", "changed_bundle_version", "changed_validation_category",
      "changed_api_audience", "changed_nonce_or_expiry", "wrong_app_attest_key_id",
      "replayed_or_non_increasing_assertion_counter", "invalid_certificate_chain",
      "wrong_rp_id_or_aaguid", "malformed_cbor", "unsupported_device_fail_closed",
    ],
  };
}

function sha256(value) { return new Uint8Array(createHash("sha256").update(value).digest()); }
function utf8(value) { return new TextEncoder().encode(value); }
function bytesFromRange(start, length) {
  return Uint8Array.from({ length }, (_, index) => (start + index) & 0xff);
}
function concat(...values) {
  const result = new Uint8Array(values.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of values) { result.set(value, offset); offset += value.length; }
  return result;
}
