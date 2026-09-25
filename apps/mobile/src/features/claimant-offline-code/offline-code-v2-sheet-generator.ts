import {
  OFFLINE_CODE_PROTOCOL_V2,
  OFFLINE_CODE_V2_LABELS,
  OFFLINE_CODE_V2_LOCATOR_BYTES,
  OFFLINE_CODE_V2_SECRET_BYTES,
  OFFLINE_CODE_V2_SYNTHETIC_KDF_MEMLIMIT_BYTES,
  OFFLINE_CODE_V2_SYNTHETIC_KDF_OPSLIMIT,
  OFFLINE_CODE_V2_SYNTHETIC_KDF_PROFILE_ID,
  canonicalJsonBytes,
  encodeOfflineCodeSheetV2,
  formatOfflineCodeClientSecretV2,
  formatOfflineCodePublicLocatorV2,
  normalizeOfflineCodeClientSecretV2,
  normalizeOfflineCodePublicLocatorV2,
  type OfflineCodeKdfProfileV2,
  type OfflineCodeRecordBindingV2,
} from "@vault/shared-types";

import type { OfflineCodeV2ProofCrypto } from "./offline-code-v2-proof-core";

export const CLAIMANT_OFFLINE_CODE_V2_SHEET_GENERATOR_APPROVED = false as const;

/** The proof crypto plus the two primitives only the owner needs: fresh randomness and the release wrap. */
export type OfflineCodeV2SheetCrypto = OfflineCodeV2ProofCrypto & Readonly<{
  randomBytes(length: number): Uint8Array;
  xchacha20poly1305Encrypt(message: Uint8Array, associatedData: Uint8Array, nonce: Uint8Array,
    key: Uint8Array): Uint8Array;
}>;

type Input = Readonly<{
  approved?: boolean;
  syntheticOnly: true;
  crypto: OfflineCodeV2SheetCrypto;
  ownerId: string;
  grantId: string;
  locatorRecordId: string;
  /** The owner's 32-byte vault master key, wrapped for release and never returned. */
  mek: Uint8Array;
  createdAt: string;
  expiresAt: string;
}>;

/** Exactly the inputs `claimant_register_offline_code_v2_locator` needs, except the server-keyed locator index. */
export type OfflineCodeV2LocatorRegistration = Readonly<{
  locatorRecordId: string; ownerUserId: string; grantId: string; publicLocator: string;
  locatorCommitment: string; proofPublicKey: string; recordBindingDigest: string; kdfSalt: string;
  wrapNonce: string; wrapCiphertext: string; wrapAssociatedDataDigest: string;
  issuedAt: string; expiresAt: string;
}>;

export type OfflineCodeV2EmergencySheet = Readonly<{
  /** The QR payload printed on the owner's emergency sheet. */
  sheetPayload: string;
  /** Also printed for reference; the proof needs the QR payload. */
  printedLocator: string;
  printedSecret: string;
  registration: OfflineCodeV2LocatorRegistration;
}>;

export class OfflineCodeV2SheetGeneratorError extends Error {
  constructor() {
    super("Offline-code emergency sheet could not be generated.");
    this.name = "OfflineCodeV2SheetGeneratorError";
  }
}

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const isoMillis = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export async function generateOfflineCodeV2EmergencySheet(input: Input): Promise<OfflineCodeV2EmergencySheet> {
  if (!(input.approved ?? CLAIMANT_OFFLINE_CODE_V2_SHEET_GENERATOR_APPROVED) || input.syntheticOnly !== true) {
    throw new OfflineCodeV2SheetGeneratorError();
  }
  const secrets: Uint8Array[] = [];
  try {
    const { crypto } = input;
    if (![input.ownerId, input.grantId, input.locatorRecordId].every((value) => uuidV4.test(value))
      || input.ownerId === input.grantId || !(input.mek instanceof Uint8Array) || input.mek.length !== 32
      || !isoMillis.test(input.createdAt) || !isoMillis.test(input.expiresAt)) throw new Error();
    const created = Date.parse(input.createdAt); const expires = Date.parse(input.expiresAt);
    if (!(expires > created) || expires - created > 365 * 86_400_000) throw new Error();
    await crypto.ready();

    const locatorBytes = keep(secrets, crypto.randomBytes(OFFLINE_CODE_V2_LOCATOR_BYTES));
    const secretBytes = keep(secrets, crypto.randomBytes(OFFLINE_CODE_V2_SECRET_BYTES));
    const salt = crypto.randomBytes(16);
    const wrapNonce = crypto.randomBytes(24);
    if (locatorBytes.length !== 16 || secretBytes.length !== 24 || salt.length !== 16 || wrapNonce.length !== 24) {
      throw new Error();
    }
    const printedLocator = formatOfflineCodePublicLocatorV2(locatorBytes);
    const printedSecret = formatOfflineCodeClientSecretV2(secretBytes);
    const normalizedLocator = normalizeOfflineCodePublicLocatorV2(printedLocator);
    const normalizedSecret = normalizeOfflineCodeClientSecretV2(printedSecret);

    const kdfProfile: OfflineCodeKdfProfileV2 = {
      protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "client_secret_root", algorithm: "argon2id",
      profile_id: OFFLINE_CODE_V2_SYNTHETIC_KDF_PROFILE_ID, production_approved: false,
      opslimit: OFFLINE_CODE_V2_SYNTHETIC_KDF_OPSLIMIT, memlimit_bytes: OFFLINE_CODE_V2_SYNTHETIC_KDF_MEMLIMIT_BYTES,
      output_bytes: 32, salt: encodeBase64Url(salt),
    };
    const locatorCommitment = await crypto.sha256(canonical({
      protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "public_locator_commitment",
      label: OFFLINE_CODE_V2_LABELS.locatorCommitment, locator_record_id: input.locatorRecordId,
      locator_version: 2, normalized_locator: normalizedLocator,
    }));
    const root = keep(secrets, crypto.argon2id(canonical({
      protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "client_secret_root", label: OFFLINE_CODE_V2_LABELS.rootInput,
      locator_record_id: input.locatorRecordId, locator_version: 2, normalized_locator: normalizedLocator,
      normalized_secret: normalizedSecret,
    }), salt, kdfProfile.opslimit, kdfProfile.memlimit_bytes, 32));

    const provisional = {
      protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "record_binding", locator_record_id: input.locatorRecordId,
      locator_version: 2, locator_commitment: encodeBase64Url(locatorCommitment), grant_id: input.grantId,
      owner_id: input.ownerId, kdf_profile_id: kdfProfile.profile_id, proof_key_version: 1,
    } as const;
    const proofContext = derivationContext("possession_proof_seed", OFFLINE_CODE_V2_LABELS.proofSeed,
      await labelledDigest(crypto, provisional));
    const proofSeed = keep(secrets, crypto.hkdfSha256(root, await crypto.sha256(proofContext), proofContext, 32));
    const proofKeys = crypto.seedKeyPair(proofSeed);
    keep(secrets, proofKeys.privateKey);
    const recordBinding: OfflineCodeRecordBindingV2 = {
      ...provisional, proof_public_key: encodeBase64Url(proofKeys.publicKey),
    };
    const recordBindingDigest = encodeBase64Url(await labelledDigest(crypto, recordBinding));

    const wrapContext = derivationContext("release_wrap_key", OFFLINE_CODE_V2_LABELS.wrapKey,
      decodeBase64Url(recordBindingDigest));
    const wrapKey = keep(secrets, crypto.hkdfSha256(root, await crypto.sha256(wrapContext), wrapContext, 32));
    const associatedData = canonical({
      protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "release_wrap_associated_data",
      label: OFFLINE_CODE_V2_LABELS.wrapAssociatedData, record_binding: recordBinding,
      record_binding_digest: recordBindingDigest, created_at: input.createdAt,
    });
    const wrapCiphertext = crypto.xchacha20poly1305Encrypt(input.mek, associatedData, wrapNonce, wrapKey);
    if (wrapCiphertext.length !== 48) throw new Error();

    const sheetPayload = encodeOfflineCodeSheetV2({
      publicLocator: { protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "public_locator",
        encoding: "crockford_base32_checksum", locator: printedLocator },
      clientSecret: { protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "client_held_secret",
        encoding: "crockford_base32_checksum", secret: printedSecret },
      kdfProfile, recordBinding,
    });
    return Object.freeze({ sheetPayload, printedLocator, printedSecret, registration: Object.freeze({
      locatorRecordId: input.locatorRecordId, ownerUserId: input.ownerId, grantId: input.grantId,
      publicLocator: printedLocator, locatorCommitment: recordBinding.locator_commitment,
      proofPublicKey: recordBinding.proof_public_key, recordBindingDigest, kdfSalt: kdfProfile.salt,
      wrapNonce: encodeBase64Url(wrapNonce), wrapCiphertext: encodeBase64Url(wrapCiphertext),
      wrapAssociatedDataDigest: encodeBase64Url(await input.crypto.sha256(associatedData)),
      issuedAt: input.createdAt, expiresAt: input.expiresAt,
    }) });
  } catch {
    throw new OfflineCodeV2SheetGeneratorError();
  } finally {
    for (const value of secrets) input.crypto.wipe(value);
  }
}

function keep(secrets: Uint8Array[], value: Uint8Array): Uint8Array { secrets.push(value); return value; }
function canonical(value: unknown): Uint8Array { return canonicalJsonBytes(value as never); }

function derivationContext(purpose: string, label: string, bindingDigest: Uint8Array): Uint8Array {
  return canonical({ protocol: OFFLINE_CODE_PROTOCOL_V2, purpose, label, binding_digest: encodeBase64Url(bindingDigest) });
}

async function labelledDigest(crypto: OfflineCodeV2ProofCrypto, value: unknown): Promise<Uint8Array> {
  const label = new TextEncoder().encode(OFFLINE_CODE_V2_LABELS.recordBinding);
  const body = canonical(value);
  const bytes = new Uint8Array(label.length + 1 + body.length);
  bytes.set(label, 0); bytes.set(body, label.length + 1);
  return crypto.sha256(bytes);
}

const base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function encodeBase64Url(value: Uint8Array): string {
  let output = "";
  for (let index = 0; index < value.length; index += 3) {
    const block = ((value[index] ?? 0) << 16) | ((value[index + 1] ?? 0) << 8) | (value[index + 2] ?? 0);
    output += base64UrlAlphabet[(block >>> 18) & 63] + base64UrlAlphabet[(block >>> 12) & 63];
    if (index + 1 < value.length) output += base64UrlAlphabet[(block >>> 6) & 63];
    if (index + 2 < value.length) output += base64UrlAlphabet[block & 63];
  }
  return output;
}

function decodeBase64Url(value: string): Uint8Array {
  const output: number[] = [];
  let buffer = 0; let bits = 0;
  for (const character of value) {
    const index = base64UrlAlphabet.indexOf(character); if (index < 0) throw new Error();
    buffer = (buffer << 6) | index; bits += 6;
    if (bits >= 8) { bits -= 8; output.push((buffer >>> bits) & 255); }
  }
  return Uint8Array.from(output);
}
