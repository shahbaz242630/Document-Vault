import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  APP_ATTEST_ASSERTION_PROTOCOL_V1,
  APP_ATTEST_KEY_ID_DIGEST_LABEL_V1,
  APP_ATTEST_REGISTRATION_PROTOCOL_V1,
  type AppAttestAssertionChallengeV1,
  type AppAttestRegistrationChallengeV1,
} from "@vault/shared-types";

import { verifyAppAttestAssertionV1, verifyAppAttestRegistrationV1 } from "./app-attest-verifier.js";
import { decodeStrictCbor } from "./strict-cbor.js";

const keyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = keyPair.publicKey.export({ format: "jwk" });
const point = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x!, "base64url"), Buffer.from(jwk.y!, "base64url")]);
const keyId = sha256(point);
const keyIdBase64 = keyId.toString("base64");
const keyDigest = createHash("sha256").update(APP_ATTEST_KEY_ID_DIGEST_LABEL_V1).update(Buffer.from([0])).update(keyId).digest("base64url");
const appIdHash = sha256(Buffer.from("ABCDE12345.com.sanduqkin.synthetic")).toString("base64url");
const challengeBytes = Buffer.from("server-owned one-time challenge bytes");

const registrationChallenge: AppAttestRegistrationChallengeV1 = {
  api_audience: "https://api.sanduqkin.test", app_attest_key_id_digest: keyDigest,
  app_id_hash: appIdHash, challenge_id: "71000000-0000-4000-8000-000000000001",
  claimant_id: "21000000-0000-4000-8000-000000000002", environment: "production",
  expires_at: "2026-08-12T12:05:00.000Z", issued_at: "2026-08-12T12:00:00.000Z",
  nonce: "UVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3A", portal_session_id: "81000000-0000-4000-8000-000000000018",
  protocol: APP_ATTEST_REGISTRATION_PROTOCOL_V1, required_bundle_version: "1", required_validation_category: 2,
};

const assertionChallenge: AppAttestAssertionChallengeV1 = {
  ...registrationChallenge, challenge_id: "71000000-0000-4000-8000-000000000002",
  claimant_key_id: "31000000-0000-4000-8000-000000000013", claimant_key_version: 1,
  invitation_reference: "51000000-0000-4000-8000-000000000005", invitation_version: 2,
  native_enrollment_challenge_digest: "AEBArphRs3mWVrpsUwgLY2SMA1hGNqriJmtDDYGAJvA",
  protocol: APP_ATTEST_ASSERTION_PROTOCOL_V1, public_key_fingerprint: "Vg3N0myu8j92y2q7HRooneBJYEGM7xeUbabp2liJ42M",
};

describe("App Attest verifier", () => {
  it("binds a registration to Apple trust output, RP ID, key, AAGUID and iOS 27 extensions", async () => {
    const authData = registrationAuthData();
    const expectedNonce = sha256(Buffer.concat([authData, sha256(challengeBytes)]));
    const trust = { verifyCertificateChain: vi.fn(async ({ expectedNonce: actual }: { expectedNonce: Uint8Array }) => {
      expect(Buffer.from(actual)).toEqual(expectedNonce);
      return { leafPublicKeyX963: point };
    }) };
    const attestation = cbor(new Map<unknown, unknown>([
      ["fmt", "apple-appattest"],
      ["attStmt", new Map<unknown, unknown>([["x5c", [Buffer.from([1]), Buffer.from([2])]], ["receipt", Buffer.from([3, 4])]])],
      ["authData", authData],
    ]));
    const result = await verifyAppAttestRegistrationV1({
      challenge: registrationChallenge, challengeBytes,
      response: { app_attest_key_id: keyIdBase64, attestation_object: attestation.toString("base64"), challenge_id: registrationChallenge.challenge_id, protocol: APP_ATTEST_REGISTRATION_PROTOCOL_V1 },
      trust, now: new Date("2026-08-12T12:01:00.000Z"),
    });
    expect(result).toMatchObject({ appAttestKeyIdDigest: keyDigest, bundleVersion: "1", environment: "production", validationCategory: 2 });
    expect(trust.verifyCertificateChain).toHaveBeenCalledOnce();
  });

  it("verifies an assertion signature and rejects replay, changed extensions, and malformed CBOR", () => {
    const authData = assertionAuthData(7);
    const signature = sign("sha256", Buffer.concat([authData, sha256(challengeBytes)]), keyPair.privateKey);
    const assertion = cbor(new Map([["signature", signature], ["authenticatorData", authData]])).toString("base64");
    const input = {
      challenge: assertionChallenge, challengeBytes, previousCounter: 6,
      publicKeySpkiBase64: keyPair.publicKey.export({ format: "der", type: "spki" }).toString("base64"),
      response: { app_attest_key_id: keyIdBase64, assertion_object: assertion, challenge_id: assertionChallenge.challenge_id, protocol: APP_ATTEST_ASSERTION_PROTOCOL_V1 },
      now: new Date("2026-08-12T12:01:00.000Z"),
    } as const;
    expect(verifyAppAttestAssertionV1(input)).toEqual({ bundleVersion: "1", counter: 7, validationCategory: 2 });
    expect(() => verifyAppAttestAssertionV1({ ...input, previousCounter: 7 })).toThrow("verification failed");
    expect(() => verifyAppAttestAssertionV1({ ...input, challenge: { ...assertionChallenge, required_bundle_version: "2" } })).toThrow("verification failed");
    expect(() => decodeStrictCbor(Buffer.from([0xbf, 0xff]))).toThrow("CBOR is invalid");
  });

  it("fails closed when either mandatory extension is absent or duplicated", async () => {
    for (const extensions of [
      new Map<string, unknown>([["apple_bundle_version_01", "1"]]),
      new Map<string, unknown>([["apple_validation_category_01", 2]]),
    ]) {
      const authData = registrationAuthData(extensions);
      const attestation = cbor(new Map<unknown, unknown>([
        ["fmt", "apple-appattest"], ["attStmt", new Map<unknown, unknown>([["x5c", [Buffer.from([1]), Buffer.from([2])]], ["receipt", Buffer.from([3])]])], ["authData", authData],
      ])).toString("base64");
      await expect(verifyAppAttestRegistrationV1({ challenge: registrationChallenge, challengeBytes, response: {
        app_attest_key_id: keyIdBase64, attestation_object: attestation, challenge_id: registrationChallenge.challenge_id, protocol: APP_ATTEST_REGISTRATION_PROTOCOL_V1,
      }, trust: { verifyCertificateChain: async () => ({ leafPublicKeyX963: point }) }, now: new Date("2026-08-12T12:01:00.000Z") })).rejects.toThrow("verification failed");
    }
    expect(() => decodeStrictCbor(Buffer.from([0xa2, 0x01, 0x01, 0x01, 0x02]))).toThrow("CBOR is invalid");
  });

  it("rejects expired and not-yet-valid challenges before invoking certificate trust", async () => {
    const trust = { verifyCertificateChain: vi.fn(async () => ({ leafPublicKeyX963: point })) };
    await expect(verifyAppAttestRegistrationV1({
      challenge: registrationChallenge, challengeBytes,
      response: { app_attest_key_id: keyIdBase64, attestation_object: cbor(new Map()).toString("base64"), challenge_id: registrationChallenge.challenge_id, protocol: APP_ATTEST_REGISTRATION_PROTOCOL_V1 },
      trust, now: new Date("2026-08-12T12:05:00.000Z"),
    })).rejects.toThrow("verification failed");
    expect(trust.verifyCertificateChain).not.toHaveBeenCalled();
  });
});

function registrationAuthData(extensions: Map<string, unknown> = extensionMap()): Buffer {
  const cose = new Map<number, unknown>([[1, 2], [3, -7], [-1, 1], [-2, point.subarray(1, 33)], [-3, point.subarray(33)]]);
  return Buffer.concat([Buffer.from(appIdHash, "base64url"), Buffer.from([0xc0]), uint32(0), Buffer.concat([Buffer.from("appattest"), Buffer.alloc(7)]), Buffer.from([0, 32]), keyId, cbor(cose), cbor(extensions)]);
}

function assertionAuthData(counter: number): Buffer {
  return Buffer.concat([Buffer.from(appIdHash, "base64url"), Buffer.from([0x80]), uint32(counter), cbor(extensionMap())]);
}

function extensionMap() { return new Map<string, unknown>([["apple_validation_category_01", 2], ["apple_bundle_version_01", "1"]]); }
function uint32(value: number) { const output = Buffer.alloc(4); output.writeUInt32BE(value); return output; }
function sha256(value: Uint8Array) { return createHash("sha256").update(value).digest(); }

function cbor(value: unknown): Buffer {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.concat([head(2, value.byteLength), Buffer.from(value)]);
  if (typeof value === "string") { const bytes = Buffer.from(value); return Buffer.concat([head(3, bytes.byteLength), bytes]); }
  if (typeof value === "number") return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (Array.isArray(value)) return Buffer.concat([head(4, value.length), ...value.map(cbor)]);
  if (value instanceof Map) return Buffer.concat([head(5, value.size), ...[...value].flatMap(([key, item]) => [cbor(key), cbor(item)])]);
  throw new Error("unsupported test CBOR");
}
function head(major: number, value: number): Buffer {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value <= 0xff) return Buffer.from([(major << 5) | 24, value]);
  if (value <= 0xffff) { const output = Buffer.alloc(3); output[0] = (major << 5) | 25; output.writeUInt16BE(value, 1); return output; }
  const output = Buffer.alloc(5); output[0] = (major << 5) | 26; output.writeUInt32BE(value, 1); return output;
}
