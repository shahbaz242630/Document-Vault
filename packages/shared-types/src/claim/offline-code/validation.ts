import type {
  OfflineCodeChallengeV2,
  OfflineCodeClientSecretV2,
  OfflineCodeKdfProfileV2,
  OfflineCodePossessionProofV2,
  OfflineCodeProtocolBundleV2,
  OfflineCodePublicLocatorV2,
  OfflineCodeRecordBindingV2,
  OfflineCodeWrappedMekV2,
} from "./contracts";
import {
  normalizeOfflineCodeClientSecretV2,
  normalizeOfflineCodePublicLocatorV2,
} from "./material";
import {
  OFFLINE_CODE_PROTOCOL_V2,
  OFFLINE_CODE_V2_AUTHORITY,
  OFFLINE_CODE_V2_CHALLENGE_TTL_SECONDS,
  OFFLINE_CODE_V2_SYNTHETIC_KDF_MEMLIMIT_BYTES,
  OFFLINE_CODE_V2_SYNTHETIC_KDF_OPSLIMIT,
  OFFLINE_CODE_V2_SYNTHETIC_KDF_PROFILE_ID,
} from "./protocol";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const base64Url16Pattern = /^[A-Za-z0-9_-]{21}[AQgw]$/u;
const base64Url32Pattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
const base64Url24Pattern = /^[A-Za-z0-9_-]{32}$/u;
const base64Url64Pattern = /^[A-Za-z0-9_-]{85}[AQgw]$/u;

export function assertOfflineCodePublicLocatorV2(value: unknown): OfflineCodePublicLocatorV2 {
  const record = exactRecord(value, ["encoding", "locator", "protocol", "purpose"]);
  protocol(record.protocol);
  literal(record.purpose, "public_locator", "locator purpose");
  literal(record.encoding, "crockford_base32_checksum", "locator encoding");
  normalizeOfflineCodePublicLocatorV2(record.locator);
  return record as unknown as OfflineCodePublicLocatorV2;
}

export function assertOfflineCodeClientSecretV2(value: unknown): OfflineCodeClientSecretV2 {
  const record = exactRecord(value, ["encoding", "protocol", "purpose", "secret"]);
  protocol(record.protocol);
  literal(record.purpose, "client_held_secret", "secret purpose");
  literal(record.encoding, "crockford_base32_checksum", "secret encoding");
  normalizeOfflineCodeClientSecretV2(record.secret);
  return record as unknown as OfflineCodeClientSecretV2;
}

export function assertOfflineCodeKdfProfileV2(value: unknown): asserts value is OfflineCodeKdfProfileV2 {
  const record = exactRecord(value, [
    "algorithm", "memlimit_bytes", "opslimit", "output_bytes", "production_approved",
    "profile_id", "protocol", "purpose", "salt",
  ]);
  protocol(record.protocol);
  literal(record.purpose, "client_secret_root", "KDF purpose");
  literal(record.algorithm, "argon2id", "KDF algorithm");
  if (record.production_approved !== false) throw new Error("Offline-code V2 KDF profile is not approved in this slice.");
  profileId(record.profile_id);
  positiveInteger(record.opslimit, "KDF opslimit");
  positiveInteger(record.memlimit_bytes, "KDF memory limit");
  if (record.profile_id !== OFFLINE_CODE_V2_SYNTHETIC_KDF_PROFILE_ID ||
      record.opslimit !== OFFLINE_CODE_V2_SYNTHETIC_KDF_OPSLIMIT ||
      record.memlimit_bytes !== OFFLINE_CODE_V2_SYNTHETIC_KDF_MEMLIMIT_BYTES) {
    throw new Error("Offline-code V2 KDF profile is unsupported in this slice.");
  }
  if (record.output_bytes !== 32) throw new Error("Offline-code V2 KDF output length is invalid.");
  base64(record.salt, base64Url16Pattern, "KDF salt");
}

export function assertOfflineCodeRecordBindingV2(value: unknown): OfflineCodeRecordBindingV2 {
  const record = exactRecord(value, [
    "grant_id", "kdf_profile_id", "locator_commitment", "locator_record_id",
    "locator_version", "owner_id", "proof_key_version", "proof_public_key", "protocol", "purpose",
  ]);
  protocol(record.protocol);
  literal(record.purpose, "record_binding", "record-binding purpose");
  for (const [field, label] of [[record.grant_id, "grant"], [record.locator_record_id, "locator record"], [record.owner_id, "owner"]] as const) uuid(field, label);
  positiveInteger(record.locator_version, "locator version");
  positiveInteger(record.proof_key_version, "proof-key version");
  base64(record.proof_public_key, base64Url32Pattern, "proof public key");
  profileId(record.kdf_profile_id);
  base64(record.locator_commitment, base64Url32Pattern, "locator commitment");
  return record as unknown as OfflineCodeRecordBindingV2;
}

export function assertOfflineCodeChallengeV2(value: unknown): asserts value is OfflineCodeChallengeV2 {
  const record = exactRecord(value, [
    "authority", "challenge_id", "expires_at", "issued_at", "locator_commitment",
    "locator_record_id", "locator_version", "nonce", "origin", "proof_key_version",
    "proof_public_key", "protocol", "purpose", "record_binding_digest",
  ]);
  protocol(record.protocol);
  literal(record.purpose, "possession_challenge", "challenge purpose");
  literal(record.authority, OFFLINE_CODE_V2_AUTHORITY, "challenge authority");
  uuid(record.challenge_id, "challenge");
  uuid(record.locator_record_id, "locator record");
  positiveInteger(record.locator_version, "locator version");
  positiveInteger(record.proof_key_version, "proof-key version");
  base64(record.proof_public_key, base64Url32Pattern, "proof public key");
  base64(record.locator_commitment, base64Url32Pattern, "locator commitment");
  base64(record.record_binding_digest, base64Url32Pattern, "record-binding digest");
  base64(record.nonce, base64Url32Pattern, "challenge nonce");
  origin(record.origin);
  timestamp(record.issued_at, "challenge issuance");
  timestamp(record.expires_at, "challenge expiry");
  if (Date.parse(record.expires_at as string) - Date.parse(record.issued_at as string) !== OFFLINE_CODE_V2_CHALLENGE_TTL_SECONDS * 1_000) {
    throw new Error("Offline-code V2 challenge window is invalid.");
  }
}

export function assertOfflineCodePossessionProofV2(value: unknown): OfflineCodePossessionProofV2 {
  const record = exactRecord(value, [
    "authority", "challenge_id", "locator_record_id", "locator_version", "proof_key_version",
    "proof_public_key", "protocol", "purpose", "record_binding_digest", "signature",
  ]);
  protocol(record.protocol);
  literal(record.purpose, "possession_proof", "proof purpose");
  literal(record.authority, OFFLINE_CODE_V2_AUTHORITY, "proof authority");
  uuid(record.challenge_id, "challenge");
  uuid(record.locator_record_id, "locator record");
  positiveInteger(record.locator_version, "locator version");
  positiveInteger(record.proof_key_version, "proof-key version");
  base64(record.proof_public_key, base64Url32Pattern, "proof public key");
  base64(record.record_binding_digest, base64Url32Pattern, "record-binding digest");
  base64(record.signature, base64Url64Pattern, "proof signature");
  return record as unknown as OfflineCodePossessionProofV2;
}

export function assertOfflineCodeWrappedMekV2(value: unknown): asserts value is OfflineCodeWrappedMekV2 {
  const record = exactRecord(value, [
    "algorithm", "ciphertext", "created_at", "grant_id", "kdf_profile_id",
    "locator_commitment", "locator_record_id", "locator_version", "nonce", "owner_id",
    "profile", "proof_key_version", "protocol", "purpose", "record_binding_digest",
  ]);
  protocol(record.protocol);
  literal(record.purpose, "release_material_wrap", "wrap purpose");
  literal(record.profile, "offline_code_v2", "wrap profile");
  literal(record.algorithm, "xchacha20poly1305_ietf", "wrap algorithm");
  for (const [field, label] of [[record.grant_id, "grant"], [record.locator_record_id, "locator record"], [record.owner_id, "owner"]] as const) uuid(field, label);
  positiveInteger(record.locator_version, "locator version");
  positiveInteger(record.proof_key_version, "proof-key version");
  profileId(record.kdf_profile_id);
  base64(record.locator_commitment, base64Url32Pattern, "locator commitment");
  base64(record.record_binding_digest, base64Url32Pattern, "record-binding digest");
  base64(record.nonce, base64Url24Pattern, "wrap nonce");
  if (typeof record.ciphertext !== "string" || !/^[A-Za-z0-9_-]{64}$/u.test(record.ciphertext)) throw new Error("Offline-code V2 ciphertext is invalid.");
  timestamp(record.created_at, "wrap creation");
}

export function assertOfflineCodeProtocolBundleV2(value: unknown): OfflineCodeProtocolBundleV2 {
  const record = exactRecord(value, ["challenge", "kdf_profile", "possession_proof", "public_locator", "record_binding", "wrapped_mek"]);
  const kdfProfile = record.kdf_profile;
  const challenge = record.challenge;
  const wrappedMek = record.wrapped_mek;
  assertOfflineCodeKdfProfileV2(kdfProfile);
  assertOfflineCodeChallengeV2(challenge);
  assertOfflineCodeWrappedMekV2(wrappedMek);
  const bundle: OfflineCodeProtocolBundleV2 = {
    public_locator: assertOfflineCodePublicLocatorV2(record.public_locator),
    kdf_profile: kdfProfile,
    record_binding: assertOfflineCodeRecordBindingV2(record.record_binding),
    challenge,
    possession_proof: assertOfflineCodePossessionProofV2(record.possession_proof),
    wrapped_mek: wrappedMek,
  };
  const binding = bundle.record_binding;
  for (const candidate of [bundle.challenge, bundle.possession_proof, bundle.wrapped_mek]) {
    equal(candidate.locator_record_id, binding.locator_record_id, "locator-record binding");
    equal(candidate.locator_version, binding.locator_version, "locator-version binding");
    equal(candidate.proof_key_version, binding.proof_key_version, "proof-key-version binding");
  }
  equal(bundle.challenge.locator_commitment, binding.locator_commitment, "challenge locator commitment");
  equal(bundle.challenge.proof_public_key, binding.proof_public_key, "challenge proof-key binding");
  equal(bundle.possession_proof.proof_public_key, binding.proof_public_key, "proof public-key binding");
  equal(bundle.wrapped_mek.locator_commitment, binding.locator_commitment, "wrap locator commitment");
  equal(bundle.wrapped_mek.grant_id, binding.grant_id, "grant binding");
  equal(bundle.wrapped_mek.owner_id, binding.owner_id, "owner binding");
  equal(bundle.wrapped_mek.kdf_profile_id, binding.kdf_profile_id, "wrap KDF binding");
  equal(bundle.kdf_profile.profile_id, binding.kdf_profile_id, "profile binding");
  for (const candidate of [bundle.challenge, bundle.possession_proof, bundle.wrapped_mek]) {
    equal(candidate.record_binding_digest, bundle.challenge.record_binding_digest, "record-digest binding");
  }
  equal(bundle.possession_proof.challenge_id, bundle.challenge.challenge_id, "challenge binding");
  return bundle;
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Offline-code V2 value must be an object.");
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error("Offline-code V2 value contains missing or prohibited fields.");
  return record;
}

function protocol(value: unknown): void { literal(value, OFFLINE_CODE_PROTOCOL_V2, "protocol"); }
function literal(value: unknown, expected: string | false, label: string): void { if (value !== expected) throw new Error(`Offline-code V2 ${label} is invalid or unsupported.`); }
function uuid(value: unknown, label: string): void { if (typeof value !== "string" || !uuidV4Pattern.test(value)) throw new Error(`Offline-code V2 ${label} is invalid.`); }
function positiveInteger(value: unknown, label: string): void { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`Offline-code V2 ${label} is invalid.`); }
function profileId(value: unknown): void { if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9_-]{1,62}[a-z0-9])$/u.test(value)) throw new Error("Offline-code V2 KDF profile id is invalid."); }
function base64(value: unknown, pattern: RegExp, label: string): void { if (typeof value !== "string" || !pattern.test(value)) throw new Error(`Offline-code V2 ${label} is invalid.`); }
function timestamp(value: unknown, label: string): void { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) || Number.isNaN(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`Offline-code V2 ${label} is invalid.`); }
function origin(value: unknown): void { if (typeof value !== "string") throw new Error("Offline-code V2 origin is invalid."); let parsed: URL; try { parsed = new URL(value); } catch { throw new Error("Offline-code V2 origin is invalid."); } if (parsed.protocol !== "https:" || parsed.origin !== value || parsed.username || parsed.password) throw new Error("Offline-code V2 origin is invalid."); }
function equal(left: unknown, right: unknown, label: string): void { if (left !== right) throw new Error(`Offline-code V2 ${label} is invalid.`); }
