import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseOfflineCodeSheetV2 } from "@vault/shared-types";
import sodium from "libsodium-wrappers-sumo";
import { describe, expect, it, vi } from "vitest";

import { createOfflineCodeV2PlatformProofProducer } from "./offline-code-v2-proof-producer";
import {
  generateOfflineCodeV2EmergencySheet,
  type OfflineCodeV2SheetCrypto,
} from "./offline-code-v2-sheet-generator";

const vector = JSON.parse(readFileSync(resolve(process.cwd(),
  "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8"));
const range = (start: number, length: number) => Uint8Array.from({ length }, (_, index) => (start + index) & 0xff);
const b64 = (value: string) => Uint8Array.from(Buffer.from(value, "base64url"));
const ids = { owner: vector.record_binding.owner_id, grant: vector.record_binding.grant_id,
  locator: vector.record_binding.locator_record_id };
const createdAt = vector.wrap.envelope.created_at as string;
const expiresAt = new Date(Date.parse(createdAt) + 30 * 86_400_000).toISOString();
const unavailable = { name: "OfflineCodeV2SheetGeneratorError", message: "Offline-code emergency sheet could not be generated." };

function sheetCrypto(random: (length: number) => Uint8Array): OfflineCodeV2SheetCrypto & { wipe: ReturnType<typeof vi.fn> } {
  const concat = (...values: Uint8Array[]) => Uint8Array.from(values.flatMap((value) => [...value]));
  return {
    ready: async () => { await sodium.ready; },
    argon2id: (input, salt, opslimit, memlimit, output) =>
      sodium.crypto_pwhash(output, input, salt, opslimit, memlimit, sodium.crypto_pwhash_ALG_ARGON2ID13),
    sha256: async (input) => sodium.crypto_hash_sha256(input),
    hkdfSha256: (inputKey, salt, info, length) => {
      const prk = sodium.crypto_auth_hmacsha256(inputKey, salt);
      let previous: Uint8Array = new Uint8Array(); let output: Uint8Array = new Uint8Array();
      for (let counter = 1; output.length < length; counter += 1) {
        previous = sodium.crypto_auth_hmacsha256(concat(previous, info, Uint8Array.of(counter)), prk);
        output = concat(output, previous);
      }
      return output.slice(0, length);
    },
    seedKeyPair: (seed) => sodium.crypto_sign_seed_keypair(seed),
    sign: (message, privateKey) => sodium.crypto_sign_detached(message, privateKey),
    wipe: vi.fn((value: Uint8Array) => { value.fill(0); }),
    randomBytes: random,
    xchacha20poly1305Encrypt: (message, associatedData, nonce, key) =>
      sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(message, associatedData, null, nonce, key),
  };
}

/** Replays the fixed byte ranges the vector generator used: locator, secret, KDF salt, wrap nonce. */
function vectorRandom() {
  const queue = [range(161, 16), range(177, 24), range(201, 16), range(25, 24)];
  return (length: number) => { const next = queue.shift(); if (!next || next.length !== length) throw new Error(); return next; };
}

const generate = (crypto: OfflineCodeV2SheetCrypto, overrides: Record<string, unknown> = {}) =>
  generateOfflineCodeV2EmergencySheet({ approved: true, syntheticOnly: true, crypto, ownerId: ids.owner,
    grantId: ids.grant, locatorRecordId: ids.locator, mek: b64(vector.wrap.mek), createdAt, expiresAt, ...overrides });

describe("owner offline-code V2 emergency sheet generator", () => {
  it("is disabled by default", async () => {
    await expect(generateOfflineCodeV2EmergencySheet({ syntheticOnly: true, crypto: sheetCrypto(vectorRandom()),
      ownerId: ids.owner, grantId: ids.grant, locatorRecordId: ids.locator, mek: b64(vector.wrap.mek),
      createdAt, expiresAt })).rejects.toMatchObject(unavailable);
  });

  it("reproduces the published synthetic vector byte for byte", async () => {
    const crypto = sheetCrypto(vectorRandom());
    const result = await generate(crypto);
    const sheet = parseOfflineCodeSheetV2(result.sheetPayload);
    expect(sheet.publicLocator).toEqual(vector.public_locator);
    expect(sheet.clientSecret).toEqual(vector.synthetic_client_secret);
    expect(sheet.kdfProfile).toEqual(vector.kdf_profile);
    expect(sheet.recordBinding).toEqual(vector.record_binding);
    expect(result.printedLocator).toBe(vector.public_locator.locator);
    expect(result.printedSecret).toBe(vector.synthetic_client_secret.secret);
    expect(result.registration).toEqual({
      locatorRecordId: ids.locator, ownerUserId: ids.owner, grantId: ids.grant,
      publicLocator: vector.public_locator.locator, locatorCommitment: vector.record_binding.locator_commitment,
      proofPublicKey: vector.record_binding.proof_public_key, recordBindingDigest: vector.record_binding_digest,
      kdfSalt: vector.kdf_profile.salt, wrapNonce: vector.wrap.envelope.nonce,
      wrapCiphertext: vector.wrap.envelope.ciphertext,
      wrapAssociatedDataDigest: createHash("sha256").update(b64(vector.wrap.associated_data_canonical)).digest("base64url"),
      issuedAt: createdAt, expiresAt,
    });
    expect(JSON.stringify(result)).not.toContain(vector.wrap.mek);
    expect(crypto.wipe.mock.calls.length).toBeGreaterThanOrEqual(6);
  });

  it("produces a sheet the claimant proof producer accepts for the matching challenge", async () => {
    const sheet = parseOfflineCodeSheetV2((await generate(sheetCrypto(vectorRandom()))).sheetPayload);
    const proof = await createOfflineCodeV2PlatformProofProducer(true).produce({ ...sheet,
      challenge: vector.challenge, expectedOrigin: vector.challenge.origin,
      now: () => new Date(Date.parse(vector.challenge.issued_at) + 1_000) });
    expect(proof).toEqual(vector.possession_proof);
  });

  it("creates distinct material from fresh randomness", async () => {
    const random = (length: number) => sodium.randombytes_buf(length);
    const first = await generate(sheetCrypto(random));
    const second = await generate(sheetCrypto(random));
    expect(first.printedSecret).not.toBe(second.printedSecret);
    expect(first.registration.proofPublicKey).not.toBe(second.registration.proofPublicKey);
    expect(() => parseOfflineCodeSheetV2(first.sheetPayload)).not.toThrow();
  });

  it.each([
    ["a non-UUID owner", { ownerId: "owner" }],
    ["the owner id reused as the grant id", { grantId: ids.owner }],
    ["a short vault key", { mek: new Uint8Array(31) }],
    ["an expiry before creation", { expiresAt: createdAt }],
    ["an expiry beyond a year", { expiresAt: new Date(Date.parse(createdAt) + 366 * 86_400_000).toISOString() }],
    ["a non-canonical timestamp", { createdAt: "2026-07-28T08:00:00Z" }],
  ])("rejects %s with one generic error", async (_label, overrides) => {
    await expect(generate(sheetCrypto(vectorRandom()), overrides)).rejects.toMatchObject(unavailable);
  });

  it("fails closed when the randomness source misbehaves", async () => {
    await expect(generate(sheetCrypto((length) => new Uint8Array(length - 1)))).rejects.toMatchObject(unavailable);
  });
});
