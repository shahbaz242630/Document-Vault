import type {
  AppAttestAssertionChallengeV1,
  AppAttestAssertionResponseV1,
  AppAttestEnvironmentV1,
  AppAttestRegistrationChallengeV1,
  AppAttestRegistrationResponseV1,
  AppAttestSyntheticFixtureV1,
  AppAttestValidationCategoryV1,
} from "./app-attest-contracts";
import {
  APP_ATTEST_ASSERTION_PROTOCOL_V1,
  APP_ATTEST_CHALLENGE_TTL_SECONDS_V1,
  APP_ATTEST_REGISTRATION_PROTOCOL_V1,
} from "./app-attest-protocol";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const base64Url32Pattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
const appAttestKeyIdPattern = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/u;
const opaqueBase64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const bundleVersionPattern = /^[0-9]+(?:\.[0-9]+){0,2}$/u;

export function assertAppAttestSyntheticFixtureV1(value: unknown): AppAttestSyntheticFixtureV1 {
  const record = assertRecord(value, [
    "assertion_challenge", "assertion_response", "registration_challenge", "registration_response",
  ]);
  const registrationChallenge = assertRegistrationChallenge(record.registration_challenge);
  const registrationResponse = assertRegistrationResponse(record.registration_response);
  const assertionChallenge = assertAssertionChallenge(record.assertion_challenge);
  const assertionResponse = assertAssertionResponse(record.assertion_response);

  for (const [left, right, label] of [
    [registrationChallenge.challenge_id, registrationResponse.challenge_id, "registration challenge"],
    [assertionChallenge.challenge_id, assertionResponse.challenge_id, "assertion challenge"],
    [registrationResponse.app_attest_key_id, assertionResponse.app_attest_key_id, "App Attest key"],
    [registrationChallenge.claimant_id, assertionChallenge.claimant_id, "claimant"],
    [registrationChallenge.portal_session_id, assertionChallenge.portal_session_id, "portal session"],
    [registrationChallenge.app_attest_key_id_digest, assertionChallenge.app_attest_key_id_digest, "key digest"],
    [registrationChallenge.app_id_hash, assertionChallenge.app_id_hash, "App ID"],
    [registrationChallenge.environment, assertionChallenge.environment, "environment"],
    [registrationChallenge.api_audience, assertionChallenge.api_audience, "API audience"],
    [registrationChallenge.required_bundle_version, assertionChallenge.required_bundle_version, "bundle version"],
    [registrationChallenge.required_validation_category, assertionChallenge.required_validation_category, "validation category"],
  ] as const) {
    if (left !== right) throw new Error(`App Attest ${label} binding is invalid.`);
  }

  return {
    assertion_challenge: assertionChallenge,
    assertion_response: assertionResponse,
    registration_challenge: registrationChallenge,
    registration_response: registrationResponse,
  };
}

export function assertAppAttestRegistrationChallengeV1(value: unknown): AppAttestRegistrationChallengeV1 {
  return assertRegistrationChallenge(value);
}

export function assertAppAttestRegistrationResponseV1(value: unknown): AppAttestRegistrationResponseV1 {
  return assertRegistrationResponse(value);
}

export function assertAppAttestAssertionChallengeV1(value: unknown): AppAttestAssertionChallengeV1 {
  return assertAssertionChallenge(value);
}

export function assertAppAttestAssertionResponseV1(value: unknown): AppAttestAssertionResponseV1 {
  return assertAssertionResponse(value);
}

function assertRegistrationChallenge(value: unknown): AppAttestRegistrationChallengeV1 {
  const record = assertRecord(value, [
    "api_audience", "app_attest_key_id_digest", "app_id_hash", "challenge_id", "claimant_id", "environment",
    "required_bundle_version", "required_validation_category", "expires_at", "issued_at", "nonce",
    "portal_session_id", "protocol",
  ]);
  requireProtocol(record.protocol, APP_ATTEST_REGISTRATION_PROTOCOL_V1);
  requireUuidV4(record.challenge_id, "challenge");
  requireUuidV4(record.claimant_id, "claimant");
  requireUuidV4(record.portal_session_id, "portal session");
  requireBase64Url32(record.app_attest_key_id_digest, "key identifier digest");
  requireBase64Url32(record.app_id_hash, "App ID hash");
  requireEnvironment(record.environment);
  requireBundleVersion(record.required_bundle_version);
  requireValidationCategory(record.required_validation_category, record.environment);
  requireAbsoluteHttpsOrigin(record.api_audience);
  requireWindow(record.issued_at, record.expires_at);
  requireBase64Url32(record.nonce, "nonce");
  return record as unknown as AppAttestRegistrationChallengeV1;
}

function assertRegistrationResponse(value: unknown): AppAttestRegistrationResponseV1 {
  const record = assertRecord(value, [
    "app_attest_key_id", "attestation_object", "challenge_id", "protocol",
  ]);
  requireProtocol(record.protocol, APP_ATTEST_REGISTRATION_PROTOCOL_V1);
  requireUuidV4(record.challenge_id, "challenge");
  requireAppAttestKeyId(record.app_attest_key_id);
  requireOpaqueObject(record.attestation_object, "attestation");
  return record as unknown as AppAttestRegistrationResponseV1;
}

function assertAssertionChallenge(value: unknown): AppAttestAssertionChallengeV1 {
  const record = assertRecord(value, [
    "api_audience", "app_attest_key_id_digest", "app_id_hash", "challenge_id", "claimant_id",
    "claimant_key_id", "claimant_key_version", "environment", "required_bundle_version",
    "required_validation_category", "expires_at", "invitation_reference", "invitation_version",
    "issued_at", "native_enrollment_challenge_digest", "nonce", "portal_session_id", "protocol",
    "public_key_fingerprint",
  ]);
  requireProtocol(record.protocol, APP_ATTEST_ASSERTION_PROTOCOL_V1);
  requireUuidV4(record.challenge_id, "challenge");
  requireUuidV4(record.claimant_id, "claimant");
  requireUuidV4(record.claimant_key_id, "claimant key");
  requireUuidV4(record.portal_session_id, "portal session");
  requireUuidV4(record.invitation_reference, "invitation reference");
  requireVersion(record.claimant_key_version, "claimant key");
  requireVersion(record.invitation_version, "invitation");
  for (const [field, label] of [
    [record.app_attest_key_id_digest, "key identifier digest"],
    [record.app_id_hash, "App ID hash"],
    [record.native_enrollment_challenge_digest, "native enrollment challenge digest"],
    [record.nonce, "nonce"],
    [record.public_key_fingerprint, "public key fingerprint"],
  ] as const) requireBase64Url32(field, label);
  requireEnvironment(record.environment);
  requireBundleVersion(record.required_bundle_version);
  requireValidationCategory(record.required_validation_category, record.environment);
  requireWindow(record.issued_at, record.expires_at);
  requireAbsoluteHttpsOrigin(record.api_audience);
  return record as unknown as AppAttestAssertionChallengeV1;
}

function assertAssertionResponse(value: unknown): AppAttestAssertionResponseV1 {
  const record = assertRecord(value, [
    "app_attest_key_id", "assertion_object", "challenge_id", "protocol",
  ]);
  requireProtocol(record.protocol, APP_ATTEST_ASSERTION_PROTOCOL_V1);
  requireUuidV4(record.challenge_id, "challenge");
  requireAppAttestKeyId(record.app_attest_key_id);
  requireOpaqueObject(record.assertion_object, "assertion");
  return record as unknown as AppAttestAssertionResponseV1;
}

function assertRecord(value: unknown, exactKeys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("App Attest value must be an object.");
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...exactKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error("App Attest value contains missing or prohibited fields.");
  }
  return record;
}

function requireProtocol(value: unknown, expected: string): void {
  if (value !== expected) throw new Error("App Attest protocol is invalid.");
}

function requireUuidV4(value: unknown, label: string): void {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) throw new Error(`App Attest ${label} is invalid.`);
}

function requireBase64Url32(value: unknown, label: string): void {
  if (typeof value !== "string" || !base64Url32Pattern.test(value)) throw new Error(`App Attest ${label} is invalid.`);
}

function requireAppAttestKeyId(value: unknown): void {
  if (typeof value !== "string" || !appAttestKeyIdPattern.test(value)) {
    throw new Error("App Attest key identifier is invalid.");
  }
}

function requireOpaqueObject(value: unknown, label: string): void {
  if (typeof value !== "string" || value.length < 24 || value.length > 131_072 ||
      value.length % 4 !== 0 || !opaqueBase64Pattern.test(value)) {
    throw new Error(`App Attest ${label} object is invalid.`);
  }
}

function requireEnvironment(value: unknown): asserts value is AppAttestEnvironmentV1 {
  if (value !== "development" && value !== "production") throw new Error("App Attest environment is invalid.");
}

function requireValidationCategory(
  value: unknown,
  environment: unknown,
): asserts value is AppAttestValidationCategoryV1 {
  if (value !== 2 && value !== 3 && value !== 4) throw new Error("App Attest validation category is invalid.");
  if ((value === 2 || value === 4) && environment !== "production") {
    throw new Error("App Attest distributed build must use the production environment.");
  }
}

function requireBundleVersion(value: unknown): void {
  if (typeof value !== "string" || value.length > 18 || !bundleVersionPattern.test(value)) {
    throw new Error("App Attest bundle version is invalid.");
  }
}

function requireVersion(value: unknown, label: string): void {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`App Attest ${label} version is invalid.`);
}

function requireWindow(issuedAt: unknown, expiresAt: unknown): void {
  requireTimestamp(issuedAt, "issuance");
  requireTimestamp(expiresAt, "expiry");
  if (Date.parse(expiresAt as string) - Date.parse(issuedAt as string) !==
      APP_ATTEST_CHALLENGE_TTL_SECONDS_V1 * 1_000) {
    throw new Error("App Attest challenge window is invalid.");
  }
}

function requireTimestamp(value: unknown, label: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`App Attest ${label} is invalid.`);
  }
}

function requireAbsoluteHttpsOrigin(value: unknown): void {
  if (typeof value !== "string") throw new Error("App Attest API audience is invalid.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("App Attest API audience is invalid."); }
  if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) {
    throw new Error("App Attest API audience is invalid.");
  }
}
