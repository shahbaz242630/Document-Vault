import { claimProtocolVersions } from "./constants";
import type {
  RecipientGrantEnvelopeV2,
  RecipientGrantPlaintextV2,
  RecipientPossessionChallengeV2,
} from "./contracts";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

export function assertRecipientPossessionChallengeV2(
  value: unknown,
): asserts value is RecipientPossessionChallengeV2 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "challenge_id",
    "expires_at",
    "nonce",
    "origin",
    "protocol",
    "recipient_id",
    "recipient_key_id",
    "recipient_key_version",
    "server_ephemeral_public_key",
  ]);
  assertProtocol(record.protocol);
  ["challenge_id", "recipient_id", "recipient_key_id"].forEach((key) =>
    assertUuid(record[key], key),
  );
  assertPositiveInteger(record.recipient_key_version, "recipient_key_version");
  assertBase64Url(record.server_ephemeral_public_key, "server_ephemeral_public_key", 65);
  assertBase64Url(record.nonce, "nonce", 32);
  assertTimestamp(record.expires_at, "expires_at");
  assertHttpsOrigin(record.origin, "origin");
}

export function assertRecipientGrantPlaintextV2(
  value: unknown,
): asserts value is RecipientGrantPlaintextV2 {
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
    "recipient_key_version",
  ]);
  assertProtocol(record.protocol);
  ["grant_id", "owner_id", "recipient_id", "recipient_key_id"].forEach((key) =>
    assertUuid(record[key], key),
  );
  assertPositiveInteger(record.recipient_key_version, "recipient_key_version");
  assertTimestamp(record.issued_at, "issued_at");
  assertBase64Url(record.grant_nonce, "grant_nonce", 16);
  assertBase64Url(record.mek, "mek", 32);
  assertBase64Url(record.recipient_key_fingerprint, "recipient_key_fingerprint", 32);
}

export function assertRecipientGrantEnvelopeV2(
  value: unknown,
): asserts value is RecipientGrantEnvelopeV2 {
  const record = asRecord(value);
  assertExactKeys(record, [
    "aead",
    "ciphertext",
    "created_at",
    "grant_id",
    "grant_version",
    "kdf",
    "key_agreement",
    "nonce",
    "owner_ephemeral_public_key",
    "profile",
    "protocol",
    "recipient_id",
    "recipient_key_id",
    "recipient_key_version",
    "revoked_at",
  ]);
  assertProtocol(record.protocol);
  if (
    record.profile !== "registered_recipient_v2" ||
    record.key_agreement !== "p256_ecdh" ||
    record.kdf !== "hkdf_sha256" ||
    record.aead !== "xchacha20poly1305_ietf"
  ) {
    throw new Error("Recipient grant V2 algorithm profile is unsupported.");
  }
  ["grant_id", "recipient_id", "recipient_key_id"].forEach((key) =>
    assertUuid(record[key], key),
  );
  ["grant_version", "recipient_key_version"].forEach((key) =>
    assertPositiveInteger(record[key], key),
  );
  assertBase64Url(record.owner_ephemeral_public_key, "owner_ephemeral_public_key", 65);
  assertBase64Url(record.nonce, "nonce", 24);
  assertBase64UrlMinimum(record.ciphertext, "ciphertext", 48);
  assertTimestamp(record.created_at, "created_at");
  if (record.revoked_at !== null) {
    assertTimestamp(record.revoked_at, "revoked_at");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Claim protocol value must be an object.");
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, keys: string[]): void {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("Claim protocol value contains missing or unknown fields.");
  }
}

function assertProtocol(value: unknown): void {
  if (value !== claimProtocolVersions.recipientGrantV2) {
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

function assertBase64Url(value: unknown, field: string, bytes: number): void {
  if (
    typeof value !== "string" ||
    !base64UrlPattern.test(value) ||
    value.includes("=") ||
    value.length !== Math.ceil((bytes * 8) / 6)
  ) {
    throw new Error(`${field} must be unpadded base64url of the required length.`);
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
