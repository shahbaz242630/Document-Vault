import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";

import {
  APP_ATTEST_KEY_ID_DIGEST_LABEL_V1,
  type AppAttestAssertionChallengeV1,
  type AppAttestAssertionResponseV1,
  type AppAttestRegistrationChallengeV1,
  type AppAttestRegistrationResponseV1,
} from "@vault/shared-types";

import { assertValidP256PointV1 } from "./native-enrollment-verifier-contract.js";
import { decodeStrictCbor, decodeStrictCborPrefix, type CborValue } from "./strict-cbor.js";

const VALIDATION_CATEGORY_EXTENSION = "apple_validation_category_01";
const BUNDLE_VERSION_EXTENSION = "apple_bundle_version_01";
const MAX_ATTESTATION_OBJECT_BYTES = 65_536;
const MAX_ASSERTION_OBJECT_BYTES = 8_192;
const MAX_RECEIPT_BYTES = 32_768;

export type AppAttestCertificateTrustV1 = Readonly<{
  verifyCertificateChain: (input: Readonly<{
    certificatesDer: readonly Uint8Array[];
    expectedNonce: Uint8Array;
  }>) => Promise<Readonly<{ leafPublicKeyX963: Uint8Array }>>;
}>;

export type VerifiedAppAttestRegistrationV1 = Readonly<{
  appAttestKeyIdDigest: string;
  bundleVersion: string;
  environment: "development" | "production";
  publicKeySpkiBase64: string;
  receiptBase64: string;
  validationCategory: 2 | 3 | 4;
}>;

export type VerifiedAppAttestAssertionV1 = Readonly<{
  bundleVersion: string;
  counter: number;
  validationCategory: 2 | 3 | 4;
}>;

export async function verifyAppAttestRegistrationV1(input: Readonly<{
  challenge: AppAttestRegistrationChallengeV1;
  challengeBytes: Uint8Array;
  response: AppAttestRegistrationResponseV1;
  trust: AppAttestCertificateTrustV1;
  now?: Date;
}>): Promise<VerifiedAppAttestRegistrationV1> {
  assertFreshChallenge(input.challenge.issued_at, input.challenge.expires_at, input.now);
  assertChallengeBytes(input.challengeBytes);
  assertChallengeBinding(input.challenge.challenge_id, input.response.challenge_id);
  const keyId = decodeCanonicalBase64(input.response.app_attest_key_id, 32, 32);
  assertEqual(
    digestLabeledKeyId(keyId),
    Buffer.from(input.challenge.app_attest_key_id_digest, "base64url"),
  );
  const object = requireMap(decodeStrictCbor(
    decodeCanonicalBase64(input.response.attestation_object, 1, MAX_ATTESTATION_OBJECT_BYTES),
  ));
  requireExactMapKeys(object, ["fmt", "attStmt", "authData"]);
  if (object.get("fmt") !== "apple-appattest") fail();
  const statement = requireMap(object.get("attStmt"));
  requireExactMapKeys(statement, ["x5c", "receipt"]);
  const chain = requireArray(statement.get("x5c")).map(requireBytes);
  if (chain.length < 2 || chain.length > 4 || chain.some((certificate) => certificate.byteLength > 8_192)) fail();
  const receipt = requireBytes(statement.get("receipt"));
  if (receipt.byteLength === 0 || receipt.byteLength > MAX_RECEIPT_BYTES) fail();
  const authData = requireBytes(object.get("authData"));
  const parsed = parseRegistrationAuthenticatorData(authData, input.challenge.environment);
  assertAuthenticatorBindings(parsed, input.challenge);
  if (parsed.counter !== 0) fail();
  assertEqual(parsed.credentialId, keyId);

  const clientDataHash = sha256(input.challengeBytes);
  const expectedNonce = sha256(concat(authData, clientDataHash));
  const trusted = await input.trust.verifyCertificateChain({ certificatesDer: chain, expectedNonce });
  assertValidP256PointV1(trusted.leafPublicKeyX963);
  assertEqual(trusted.leafPublicKeyX963, parsed.publicKeyX963);
  assertEqual(sha256(trusted.leafPublicKeyX963), keyId);

  return {
    appAttestKeyIdDigest: input.challenge.app_attest_key_id_digest,
    bundleVersion: parsed.bundleVersion,
    environment: input.challenge.environment,
    publicKeySpkiBase64: exportSpki(trusted.leafPublicKeyX963).toString("base64"),
    receiptBase64: Buffer.from(receipt).toString("base64"),
    validationCategory: parsed.validationCategory,
  };
}

export function verifyAppAttestAssertionV1(input: Readonly<{
  challenge: AppAttestAssertionChallengeV1;
  challengeBytes: Uint8Array;
  previousCounter: number;
  publicKeySpkiBase64: string;
  response: AppAttestAssertionResponseV1;
  now?: Date;
}>): VerifiedAppAttestAssertionV1 {
  assertFreshChallenge(input.challenge.issued_at, input.challenge.expires_at, input.now);
  assertChallengeBytes(input.challengeBytes);
  assertChallengeBinding(input.challenge.challenge_id, input.response.challenge_id);
  const keyId = decodeCanonicalBase64(input.response.app_attest_key_id, 32, 32);
  assertEqual(digestLabeledKeyId(keyId), Buffer.from(input.challenge.app_attest_key_id_digest, "base64url"));
  const object = requireMap(decodeStrictCbor(
    decodeCanonicalBase64(input.response.assertion_object, 1, MAX_ASSERTION_OBJECT_BYTES),
  ));
  requireExactMapKeys(object, ["signature", "authenticatorData"]);
  const signature = requireBytes(object.get("signature"));
  const authData = requireBytes(object.get("authenticatorData"));
  if (signature.byteLength < 64 || signature.byteLength > 80) fail();
  const parsed = parseAssertionAuthenticatorData(authData);
  assertAuthenticatorBindings(parsed, input.challenge);
  if (!Number.isSafeInteger(input.previousCounter) || input.previousCounter < 0 || parsed.counter <= input.previousCounter) fail();
  const spki = Buffer.from(decodeCanonicalBase64(input.publicKeySpkiBase64, 1, 512));
  const signedData = concat(authData, sha256(input.challengeBytes));
  let valid = false;
  try { valid = verify("sha256", signedData, createPublicKey({ key: spki, format: "der", type: "spki" }), signature); }
  catch { fail(); }
  if (!valid) fail();
  return { bundleVersion: parsed.bundleVersion, counter: parsed.counter, validationCategory: parsed.validationCategory };
}

type AuthenticatorBindings = Readonly<{
  bundleVersion: string;
  counter: number;
  rpIdHash: Uint8Array;
  validationCategory: 2 | 3 | 4;
}>;

function parseRegistrationAuthenticatorData(
  authData: Uint8Array,
  environment: "development" | "production",
): AuthenticatorBindings & Readonly<{
  credentialId: Uint8Array;
  publicKeyX963: Uint8Array;
}> {
  if (authData.byteLength < 55) fail();
  const common = parseCommonAuthenticatorData(authData, true);
  let offset = 37;
  const aaguid = authData.slice(offset, offset + 16); offset += 16;
  const credentialLength = readUint16(authData, offset); offset += 2;
  if (credentialLength !== 32 || offset + credentialLength > authData.byteLength) fail();
  const credentialId = authData.slice(offset, offset + credentialLength); offset += credentialLength;
  const key = decodeStrictCborPrefix(authData, offset); offset = key.offset;
  const publicKeyX963 = parseCoseP256Key(key.value);
  const extensions = decodeStrictCborPrefix(authData, offset); offset = extensions.offset;
  if (offset !== authData.byteLength) fail();
  const expectedAaguid = environment === "development"
    ? Buffer.from("appattestsandbox", "ascii")
    : concat(Buffer.from("appattest", "ascii"), new Uint8Array(7));
  assertEqual(aaguid, expectedAaguid);
  return { ...common, ...parseExtensions(extensions.value), credentialId, publicKeyX963 };
}

function parseAssertionAuthenticatorData(authData: Uint8Array): AuthenticatorBindings {
  if (authData.byteLength <= 37) fail();
  const common = parseCommonAuthenticatorData(authData, false);
  const extensions = decodeStrictCborPrefix(authData, 37);
  if (extensions.offset !== authData.byteLength) fail();
  return { ...common, ...parseExtensions(extensions.value) };
}

function parseCommonAuthenticatorData(authData: Uint8Array, registration: boolean) {
  const flags = authData[32] as number;
  const hasAttestedCredential = (flags & 0x40) !== 0;
  const hasExtensions = (flags & 0x80) !== 0;
  if (hasAttestedCredential !== registration || !hasExtensions) fail();
  return {
    counter: readUint32(authData, 33),
    rpIdHash: authData.slice(0, 32),
  };
}

function parseExtensions(value: CborValue) {
  const extensions = requireMap(value);
  requireExactMapKeys(extensions, [VALIDATION_CATEGORY_EXTENSION, BUNDLE_VERSION_EXTENSION]);
  const category = extensions.get(VALIDATION_CATEGORY_EXTENSION);
  const version = extensions.get(BUNDLE_VERSION_EXTENSION);
  if ((category !== 2 && category !== 3 && category !== 4) || typeof version !== "string" || !/^[0-9]+(?:\.[0-9]+){0,2}$/u.test(version)) fail();
  return { bundleVersion: version, validationCategory: category as 2 | 3 | 4 };
}

function parseCoseP256Key(value: CborValue): Uint8Array {
  const key = requireMap(value);
  requireExactMapKeys(key, [1, 3, -1, -2, -3]);
  if (key.get(1) !== 2 || key.get(3) !== -7 || key.get(-1) !== 1) fail();
  const x = requireBytes(key.get(-2)); const y = requireBytes(key.get(-3));
  if (x.byteLength !== 32 || y.byteLength !== 32) fail();
  const point = concat(Uint8Array.of(4), x, y);
  assertValidP256PointV1(point);
  return point;
}

function assertAuthenticatorBindings(parsed: AuthenticatorBindings, challenge: AppAttestRegistrationChallengeV1 | AppAttestAssertionChallengeV1) {
  assertEqual(parsed.rpIdHash, Buffer.from(challenge.app_id_hash, "base64url"));
  if (parsed.bundleVersion !== challenge.required_bundle_version || parsed.validationCategory !== challenge.required_validation_category) fail();
}

function digestLabeledKeyId(keyId: Uint8Array): Uint8Array {
  return createHash("sha256").update(APP_ATTEST_KEY_ID_DIGEST_LABEL_V1, "utf8").update(Uint8Array.of(0)).update(keyId).digest();
}

function exportSpki(point: Uint8Array): Buffer {
  const x = Buffer.from(point.slice(1, 33)).toString("base64url");
  const y = Buffer.from(point.slice(33)).toString("base64url");
  return createPublicKey({ key: { crv: "P-256", kty: "EC", x, y }, format: "jwk" }).export({ format: "der", type: "spki" });
}

function decodeCanonicalBase64(value: string, minimum: number, maximum: number): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) fail();
  const decoded = Buffer.from(value, "base64");
  if (decoded.byteLength < minimum || decoded.byteLength > maximum || decoded.toString("base64") !== value) fail();
  return decoded;
}

function requireMap(value: CborValue | undefined): ReadonlyMap<string | number, CborValue> {
  if (!(value instanceof Map)) fail();
  return value;
}
function requireArray(value: CborValue | undefined): readonly CborValue[] { if (!Array.isArray(value)) fail(); return value; }
function requireBytes(value: CborValue | undefined): Uint8Array { if (!(value instanceof Uint8Array)) fail(); return value; }
function requireExactMapKeys(map: ReadonlyMap<string | number, CborValue>, expected: readonly (string | number)[]) {
  if (map.size !== expected.length || expected.some((key) => !map.has(key))) fail();
}
function readUint16(value: Uint8Array, offset: number): number { if (offset + 2 > value.byteLength) fail(); return ((value[offset] as number) << 8) | (value[offset + 1] as number); }
function readUint32(value: Uint8Array, offset: number): number { if (offset + 4 > value.byteLength) fail(); return new DataView(value.buffer, value.byteOffset + offset, 4).getUint32(0); }
function concat(...values: readonly Uint8Array[]): Uint8Array { return Buffer.concat(values); }
function sha256(value: Uint8Array): Uint8Array { return createHash("sha256").update(value).digest(); }
function assertEqual(left: Uint8Array, right: Uint8Array) { if (left.byteLength !== right.byteLength || !timingSafeEqual(left, right)) fail(); }
function assertChallengeBinding(expected: string, actual: string) { if (expected !== actual) fail(); }
function assertChallengeBytes(value: Uint8Array) { if (value.byteLength < 16 || value.byteLength > 4_096) fail(); }
function assertFreshChallenge(issuedAt: string, expiresAt: string, now = new Date()) {
  const issued = Date.parse(issuedAt); const expires = Date.parse(expiresAt); const current = now.getTime();
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued || expires - issued > 300_000 || current < issued || current >= expires) fail();
}
function fail(): never { throw new Error("App Attest verification failed."); }
