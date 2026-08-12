import type {
  NativeEnrollmentCapabilityV1,
  NativeEnrollmentChallengeRequestV1,
  NativeEnrollmentChallengeV1,
  NativeEnrollmentIssuedChallengeV1,
  NativeEnrollmentPossessionProofV1,
  NativeEnrollmentSyntheticFixtureV1,
} from "./contracts";
import { canonicalJsonBytes } from "../canonical-json";
import { NATIVE_ENROLLMENT_CHALLENGE_TTL_SECONDS_V1 } from "./protocol";

const protocol = "sanduqkin:claim:native-enrollment:v1";
const digestPattern = /^[0-9a-f]{64}$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const base64Url32Pattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
const x963P256Pattern = /^B[A-P][A-Za-z0-9_-]{84}[AEIMQUYcgkosw048]$/u;

export function assertNativeEnrollmentFixtureV1(value: unknown): NativeEnrollmentSyntheticFixtureV1 {
  const record = assertRecord(value, ["challenge", "challenge_bytes", "challenge_request", "possession_proof"]);
  const challengeRequest = assertChallengeRequest(record.challenge_request);
  const challenge = assertChallenge(record.challenge);
  const proof = assertProof(record.possession_proof);
  for (const [left, right, label] of [
    [challengeRequest.invitation_reference, challenge.invitation_reference, "invitation"],
    [challengeRequest.policy_pack_id, challenge.policy_pack_id, "policy pack"],
    [challenge.challenge_id, proof.challenge_id, "challenge"],
    [challenge.claimant_id, proof.claimant_id, "claimant"],
    [challenge.claimant_key_id, proof.claimant_key_id, "claimant key"],
    [challenge.invitation_reference, proof.invitation_reference, "proof invitation"],
    [challenge.public_key_fingerprint, proof.public_key_fingerprint, "proof fingerprint"],
    [challenge.device_binding_digest, proof.device_binding_digest, "proof device binding"],
  ] as const) {
    if (left !== right) throw new Error(`Native enrollment ${label} binding is invalid.`);
  }
  if (challenge.claimant_key_version !== proof.claimant_key_version) {
    throw new Error("Native enrollment key-version binding is invalid.");
  }
  if (challengeRequest.policy_pack_version !== challenge.policy_pack_version) {
    throw new Error("Native enrollment policy-version binding is invalid.");
  }
  requireOpaqueChallengeBytes(record.challenge_bytes, challenge);
  return { challenge, challenge_bytes: record.challenge_bytes as string, challenge_request: challengeRequest, possession_proof: proof };
}

export function assertNativeEnrollmentChallengeRequestV1(value: unknown): NativeEnrollmentChallengeRequestV1 {
  return assertChallengeRequest(value);
}

export function assertNativeEnrollmentChallengeV1(value: unknown): NativeEnrollmentChallengeV1 {
  return assertChallenge(value);
}

export function assertNativeEnrollmentIssuedChallengeV1(value: unknown): NativeEnrollmentIssuedChallengeV1 {
  const record = assertRecord(value, ["challenge", "challenge_bytes"]);
  const challenge = assertChallenge(record.challenge);
  requireOpaqueChallengeBytes(record.challenge_bytes, challenge);
  return { challenge, challenge_bytes: record.challenge_bytes as string };
}

export function assertNativeEnrollmentPossessionProofV1(value: unknown): NativeEnrollmentPossessionProofV1 {
  return assertProof(value);
}

function assertChallengeRequest(value: unknown): NativeEnrollmentChallengeRequestV1 {
  const record = assertRecord(value, [
    "capability", "invitation_reference", "policy_pack_id",
    "policy_pack_version", "protocol", "public_key",
  ]);
  const capability = assertCapability(record.capability);
  requireProtocol(record.protocol);
  requireUuidV4(record.invitation_reference, "invitation reference");
  if (typeof record.public_key !== "string" || !x963P256Pattern.test(record.public_key)) {
    throw new Error("Native enrollment public key must be canonical uncompressed P-256 Base64URL.");
  }
  requirePolicyPack(record.policy_pack_id);
  requireVersion(record.policy_pack_version, "policy");
  return { ...record, capability } as unknown as NativeEnrollmentChallengeRequestV1;
}

function assertChallenge(value: unknown): NativeEnrollmentChallengeV1 {
  const record = assertRecord(value, [
    "challenge_id", "claimant_id", "claimant_key_id", "claimant_key_version",
    "device_binding_digest", "eligibility_version", "expires_at", "invitation_reference",
    "invitation_version", "issued_at", "kdf_salt", "nonce", "origin", "policy_pack_id",
    "policy_pack_version", "protocol", "public_key_fingerprint", "server_ephemeral_public_key",
  ]);
  requireProtocol(record.protocol);
  for (const [field, label] of [
    [record.challenge_id, "challenge"], [record.claimant_id, "claimant"],
    [record.claimant_key_id, "claimant key"],
  ] as const) requireUuidV4(field, label);
  requireUuidV4(record.invitation_reference, "invitation reference");
  requireDigest(record.device_binding_digest, "device binding");
  requireBase64Url32(record.public_key_fingerprint, "public key fingerprint");
  for (const [field, label] of [
    [record.claimant_key_version, "key"], [record.eligibility_version, "eligibility"],
    [record.invitation_version, "invitation"], [record.policy_pack_version, "policy"],
  ] as const) requireVersion(field, label);
  requireBase64Url32(record.nonce, "nonce");
  requireBase64Url32(record.kdf_salt, "KDF salt");
  if (typeof record.server_ephemeral_public_key !== "string" || !x963P256Pattern.test(record.server_ephemeral_public_key)) {
    throw new Error("Native enrollment server public key is invalid.");
  }
  requireAbsoluteHttpsOrigin(record.origin);
  requireTimestamp(record.issued_at, "issuance");
  requireTimestamp(record.expires_at, "expiry");
  if (Date.parse(record.expires_at as string) - Date.parse(record.issued_at as string) !==
      NATIVE_ENROLLMENT_CHALLENGE_TTL_SECONDS_V1 * 1_000) {
    throw new Error("Native enrollment challenge window is invalid.");
  }
  requirePolicyPack(record.policy_pack_id);
  return record as unknown as NativeEnrollmentChallengeV1;
}

function assertProof(value: unknown): NativeEnrollmentPossessionProofV1 {
  const record = assertRecord(value, [
    "challenge_id", "claimant_id", "claimant_key_id", "claimant_key_version",
    "device_binding_digest", "invitation_reference", "proof_mac", "protocol",
    "public_key_fingerprint",
  ]);
  requireProtocol(record.protocol);
  requireUuidV4(record.challenge_id, "challenge");
  requireUuidV4(record.claimant_id, "claimant");
  requireUuidV4(record.claimant_key_id, "claimant key");
  requireUuidV4(record.invitation_reference, "invitation reference");
  requireDigest(record.device_binding_digest, "device binding");
  requireBase64Url32(record.public_key_fingerprint, "public key fingerprint");
  requireVersion(record.claimant_key_version, "proof key");
  requireBase64Url32(record.proof_mac, "possession proof");
  return record as unknown as NativeEnrollmentPossessionProofV1;
}

function assertCapability(value: unknown): NativeEnrollmentCapabilityV1 {
  const record = assertRecord(value, [
    "claimed_hardware_security_level", "claimed_private_key_exportable", "claimed_user_presence_binding",
    "key_algorithm", "platform", "protocol", "public_key_encoding",
  ]);
  requireProtocol(record.protocol);
  // These are advisory client claims only. Server authorization must rest on
  // independently verified App Attest and native possession evidence.
  if (record.platform !== "ios" || record.claimed_hardware_security_level !== "secure_enclave" ||
      record.key_algorithm !== "p256_ecdh" || record.public_key_encoding !== "ansi_x9_63_uncompressed" ||
      record.claimed_private_key_exportable !== false || record.claimed_user_presence_binding !== "transaction_bound") {
    throw new Error("Native enrollment capability is not eligible for the current slice.");
  }
  return record as unknown as NativeEnrollmentCapabilityV1;
}

function assertRecord(value: unknown, exactKeys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Native enrollment value must be an object.");
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  const expectedKeys = [...exactKeys].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("Native enrollment value contains missing or prohibited fields.");
  }
  return record;
}

function requireProtocol(value: unknown): void {
  if (value !== protocol) throw new Error("Native enrollment protocol is invalid.");
}

function requireUuidV4(value: unknown, label: string): void {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) throw new Error(`Native enrollment ${label} is invalid.`);
}

function requireDigest(value: unknown, label: string): void {
  if (typeof value !== "string" || !digestPattern.test(value)) throw new Error(`Native enrollment ${label} digest is invalid.`);
}

function requireBase64Url32(value: unknown, label: string): void {
  if (typeof value !== "string" || !base64Url32Pattern.test(value)) throw new Error(`Native enrollment ${label} is invalid.`);
}

function requirePolicyPack(value: unknown): void {
  if (typeof value !== "string" || value.length > 200 ||
      !/^[a-z0-9](?:[a-z0-9._:-]{0,198}[a-z0-9])?$/u.test(value)) {
    throw new Error("Native enrollment policy pack is invalid.");
  }
}

function requireVersion(value: unknown, label: string): void {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`Native enrollment ${label} version is invalid.`);
}

function requireTimestamp(value: unknown, label: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`Native enrollment ${label} is invalid.`);
  }
}

function requireAbsoluteHttpsOrigin(value: unknown): void {
  if (typeof value !== "string") throw new Error("Native enrollment origin is invalid.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Native enrollment origin is invalid."); }
  if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) {
    throw new Error("Native enrollment origin is invalid.");
  }
}

function requireOpaqueChallengeBytes(value: unknown, challenge: NativeEnrollmentChallengeV1): void {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("Native enrollment challenge bytes are invalid.");
  }
  const expected = encodeBase64Url(canonicalJsonBytes(challenge as never));
  if (value !== expected) throw new Error("Native enrollment challenge-byte binding is invalid.");
}

function encodeBase64Url(value: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let index = 0; index < value.length; index += 3) {
    const first = value[index] ?? 0;
    const second = value[index + 1] ?? 0;
    const third = value[index + 2] ?? 0;
    const block = (first << 16) | (second << 8) | third;
    output += alphabet[(block >>> 18) & 63] + alphabet[(block >>> 12) & 63];
    if (index + 1 < value.length) output += alphabet[(block >>> 6) & 63];
    if (index + 2 < value.length) output += alphabet[block & 63];
  }
  return output;
}
