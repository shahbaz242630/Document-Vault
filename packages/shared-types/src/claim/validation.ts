import {
  claimProtocolVersions,
  claimRouteProfiles,
  claimantActorRoles,
  claimantStates,
} from "./constants";
import type {
  ClaimTransitionRequestV1,
  OfflineCodeChallengeV2,
  OfflineCodeKdfProfileV2,
  OfflineCodeWrappedMekV2,
  RecipientGrantEnvelopeV1,
  RecipientGrantPlaintextV1,
  ReleaseManifestV1,
  SignedReleasePackageV1,
} from "./contracts";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

export function assertRecipientGrantPlaintextV1(
  value: unknown,
): asserts value is RecipientGrantPlaintextV1 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "grant_id",
    "grant_nonce",
    "issued_at",
    "mek",
    "owner_id",
    "protocol",
    "recipient_id",
    "recipient_key_fingerprint",
    "recipient_key_id",
  ]);
  assertProtocol(record.protocol, claimProtocolVersions.recipientGrant);
  ["grant_id", "owner_id", "recipient_id", "recipient_key_id"].forEach((key) =>
    assertUuid(record[key], key),
  );
  assertTimestamp(record.issued_at, "issued_at");
  assertBase64Url(record.grant_nonce, "grant_nonce", 16);
  assertBase64Url(record.mek, "mek", 32);
  assertBase64Url(record.recipient_key_fingerprint, "recipient_key_fingerprint", 32);
}

export function assertRecipientGrantEnvelopeV1(
  value: unknown,
): asserts value is RecipientGrantEnvelopeV1 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "algorithm",
    "ciphertext",
    "created_at",
    "grant_id",
    "grant_version",
    "protocol",
    "recipient_id",
    "recipient_key_id",
    "recipient_key_version",
    "revoked_at",
  ]);
  assertProtocol(record.protocol, claimProtocolVersions.recipientGrant);
  if (record.algorithm !== "crypto_box_seal") {
    throw new Error("Recipient grant algorithm is unsupported.");
  }
  ["grant_id", "recipient_id", "recipient_key_id"].forEach((key) =>
    assertUuid(record[key], key),
  );
  ["grant_version", "recipient_key_version"].forEach((key) =>
    assertPositiveInteger(record[key], key),
  );
  assertTimestamp(record.created_at, "created_at");
  if (record.revoked_at !== null) {
    assertTimestamp(record.revoked_at, "revoked_at");
  }
  assertBase64UrlMinimum(record.ciphertext, "ciphertext", 48);
}

export function assertOfflineCodeChallengeV2(
  value: unknown,
): asserts value is OfflineCodeChallengeV2 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "challenge_id",
    "expires_at",
    "locator_hash",
    "nonce",
    "origin",
    "protocol",
  ]);
  assertProtocol(record.protocol, claimProtocolVersions.offlineCode);
  assertUuid(record.challenge_id, "challenge_id");
  assertTimestamp(record.expires_at, "expires_at");
  assertBase64Url(record.locator_hash, "locator_hash", 32);
  assertBase64Url(record.nonce, "nonce", 32);
  assertHttpsOrigin(record.origin, "origin");
}

export function assertOfflineCodeKdfProfileV2(
  value: unknown,
): asserts value is OfflineCodeKdfProfileV2 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "algorithm",
    "memlimit_bytes",
    "opslimit",
    "output_bytes",
    "production_approved",
    "profile_id",
    "salt",
  ]);
  if (record.algorithm !== "argon2id") {
    throw new Error("Offline-code KDF algorithm is unsupported.");
  }
  if (
    typeof record.profile_id !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(record.profile_id)
  ) {
    throw new Error("Offline-code KDF profile_id is invalid.");
  }
  if (typeof record.production_approved !== "boolean") {
    throw new Error("Offline-code KDF approval flag is invalid.");
  }
  assertPositiveInteger(record.opslimit, "opslimit");
  assertPositiveInteger(record.memlimit_bytes, "memlimit_bytes");
  if (record.output_bytes !== 32) {
    throw new Error("Offline-code KDF output length is unsupported.");
  }
  assertBase64Url(record.salt, "salt", 16);
}

export function assertOfflineCodeWrappedMekV2(
  value: unknown,
): asserts value is OfflineCodeWrappedMekV2 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "algorithm",
    "ciphertext",
    "created_at",
    "grant_id",
    "kdf_profile_id",
    "locator_record_id",
    "locator_version",
    "nonce",
    "owner_id",
    "proof_key_version",
    "protocol",
  ]);
  assertProtocol(record.protocol, claimProtocolVersions.offlineCode);
  if (record.algorithm !== "xchacha20poly1305_ietf") {
    throw new Error("Offline-code wrapping algorithm is unsupported.");
  }
  ["locator_record_id", "grant_id", "owner_id"].forEach((key) =>
    assertUuid(record[key], key),
  );
  assertPositiveInteger(record.locator_version, "locator_version");
  assertPositiveInteger(record.proof_key_version, "proof_key_version");
  if (
    typeof record.kdf_profile_id !== "string" ||
    record.kdf_profile_id.length === 0
  ) {
    throw new Error("kdf_profile_id is invalid.");
  }
  assertTimestamp(record.created_at, "created_at");
  assertBase64Url(record.nonce, "nonce", 24);
  assertBase64UrlMinimum(record.ciphertext, "ciphertext", 48);
}

export function assertClaimTransitionRequestV1(
  value: unknown,
): asserts value is ClaimTransitionRequestV1 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "actor_role",
    "assurance_level",
    "expected_version",
    "predicates",
    "previous_state",
    "protocol",
    "requested_state",
    "server_time",
  ]);
  assertProtocol(record.protocol, claimProtocolVersions.claimState);
  if (
    record.previous_state !== null &&
    !claimantStates.includes(record.previous_state as never)
  ) {
    throw new Error("previous_state is unsupported.");
  }
  if (!claimantStates.includes(record.requested_state as never)) {
    throw new Error("requested_state is unsupported.");
  }
  if (!claimantActorRoles.includes(record.actor_role as never)) {
    throw new Error("actor_role is unsupported.");
  }
  if (!["aal1", "aal2"].includes(String(record.assurance_level))) {
    throw new Error("assurance_level is unsupported.");
  }
  if (!Number.isSafeInteger(record.expected_version) || Number(record.expected_version) < 0) {
    throw new Error("expected_version is invalid.");
  }
  assertTimestamp(record.server_time, "server_time");
  const predicates = asRecord(record.predicates);
  assertExactKeys(predicates, [
    "account_active",
    "approvals_current",
    "authorization_rechecked",
    "claimant_binding_valid",
    "cooldown_expired",
    "evidence_policy_satisfied",
    "grant_or_code_current",
    "hold_disposition_recorded",
    "hold_reviewable",
    "intake_enabled",
    "no_cancellation_or_hold",
    "notice_enqueued",
    "notice_verified_delivered",
    "package_build_enabled",
    "package_current",
    "policy_accepted",
    "policy_deadline_exceeded",
    "release_material_current",
    "release_retrieval_enabled",
    "retention_scheduled",
    "review_result_recorded",
    "route_profile_valid",
    "session_unexpired",
    "supported_jurisdiction",
    "two_independent_approvals",
  ]);
  for (const [key, predicate] of Object.entries(predicates)) {
    if (typeof predicate !== "boolean") {
      throw new Error(`${key} must be boolean.`);
    }
  }
}

export function assertReleaseManifestV1(
  value: unknown,
): asserts value is ReleaseManifestV1 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "asset_ciphertext_digests",
    "asset_snapshot_boundary",
    "cancellation_version",
    "claim_id",
    "claim_version",
    "claimant_id",
    "created_at",
    "expires_at",
    "owner_id",
    "policy_decision_version",
    "protocol",
    "release_material",
    "release_package_id",
    "signing_key_id",
  ]);
  assertProtocol(record.protocol, claimProtocolVersions.releasePackage);
  ["claim_id", "release_package_id", "owner_id", "claimant_id"].forEach((key) =>
    assertUuid(record[key], key),
  );
  assertTimestamp(record.created_at, "created_at");
  assertTimestamp(record.expires_at, "expires_at");
  assertTimestamp(record.asset_snapshot_boundary, "asset_snapshot_boundary");
  if (Date.parse(record.expires_at as string) <= Date.parse(record.created_at as string)) {
    throw new Error("Release manifest expiry must follow creation.");
  }
  ["claim_version", "cancellation_version", "policy_decision_version"].forEach(
    (key) => assertPositiveInteger(record[key], key),
  );
  if (
    typeof record.signing_key_id !== "string" ||
    record.signing_key_id.length === 0
  ) {
    throw new Error("signing_key_id is invalid.");
  }
  if (
    !Array.isArray(record.asset_ciphertext_digests) ||
    record.asset_ciphertext_digests.length === 0
  ) {
    throw new Error("asset_ciphertext_digests must be non-empty.");
  }
  record.asset_ciphertext_digests.forEach((digest, index) =>
    assertBase64Url(digest, `asset_ciphertext_digests[${index}]`, 32),
  );
  const material = asRecord(record.release_material);
  if (!claimRouteProfiles.includes(material.profile as never)) {
    throw new Error("release_material profile is unsupported.");
  }
  if (material.profile === "registered_recipient_v1") {
    assertExactKeys(material, [
      "grant_id",
      "grant_version",
      "profile",
      "recipient_id",
      "recipient_key_id",
      "recipient_key_version",
      "sealed_grant_digest",
    ]);
    ["grant_id", "recipient_id", "recipient_key_id"].forEach((key) =>
      assertUuid(material[key], key),
    );
    ["grant_version", "recipient_key_version"].forEach((key) =>
      assertPositiveInteger(material[key], key),
    );
    assertBase64Url(material.sealed_grant_digest, "sealed_grant_digest", 32);
  } else {
    assertExactKeys(material, [
      "kdf_profile_id",
      "locator_record_id",
      "locator_version",
      "profile",
      "proof_key_version",
      "wrapped_mek_digest",
    ]);
    assertUuid(material.locator_record_id, "locator_record_id");
    ["locator_version", "proof_key_version"].forEach((key) =>
      assertPositiveInteger(material[key], key),
    );
    if (
      typeof material.kdf_profile_id !== "string" ||
      material.kdf_profile_id.length === 0
    ) {
      throw new Error("kdf_profile_id is invalid.");
    }
    assertBase64Url(material.wrapped_mek_digest, "wrapped_mek_digest", 32);
  }
}

export function assertSignedReleasePackageV1(
  value: unknown,
): asserts value is SignedReleasePackageV1 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "manifest",
    "manifest_signature",
    "protocol",
    "signature_algorithm",
  ]);
  assertProtocol(record.protocol, claimProtocolVersions.releasePackage);
  if (record.signature_algorithm !== "ed25519") {
    throw new Error("Release signature algorithm is unsupported.");
  }
  assertReleaseManifestV1(record.manifest);
  assertBase64Url(record.manifest_signature, "manifest_signature", 64);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Claim protocol value must be an object.");
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): void {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("Claim protocol value contains missing or unknown fields.");
  }
}

function assertProtocol(value: unknown, expected: string): void {
  if (value !== expected) {
    throw new Error("Claim protocol version is unsupported.");
  }
}

function assertUuid(value: unknown, field: string): void {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error(`${field} must be a UUID.`);
  }
}

function assertTimestamp(value: unknown, field: string): void {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error(`${field} must be a canonical UTC timestamp.`);
  }
}

function assertHttpsOrigin(value: unknown, field: string): void {
  if (
    typeof value !== "string" ||
    new URL(value).origin !== value ||
    !value.startsWith("https://")
  ) {
    throw new Error(`${field} must be an HTTPS origin.`);
  }
}

function assertPositiveInteger(value: unknown, field: string): void {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
}

function assertBase64Url(
  value: unknown,
  field: string,
  expectedBytes: number,
): void {
  if (
    typeof value !== "string" ||
    !base64UrlPattern.test(value) ||
    value.includes("=")
  ) {
    throw new Error(`${field} must be unpadded base64url.`);
  }
  const expectedCharacters = Math.ceil((expectedBytes * 8) / 6);
  if (value.length !== expectedCharacters) {
    throw new Error(`${field} has an invalid byte length.`);
  }
}

function assertBase64UrlMinimum(
  value: unknown,
  field: string,
  minimumBytes: number,
): void {
  if (
    typeof value !== "string" ||
    !base64UrlPattern.test(value) ||
    value.includes("=") ||
    value.length < Math.ceil((minimumBytes * 8) / 6)
  ) {
    throw new Error(`${field} must be unpadded base64url of sufficient length.`);
  }
}
