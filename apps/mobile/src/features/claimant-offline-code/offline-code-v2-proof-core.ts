import {
  OFFLINE_CODE_PROTOCOL_V2,
  OFFLINE_CODE_V2_AUTHORITY,
  OFFLINE_CODE_V2_LABELS,
  assertOfflineCodeChallengeV2,
  assertOfflineCodeClientSecretV2,
  assertOfflineCodeKdfProfileV2,
  assertOfflineCodePossessionProofV2,
  assertOfflineCodePublicLocatorV2,
  assertOfflineCodeRecordBindingV2,
  canonicalJsonBytes,
  normalizeOfflineCodeClientSecretV2,
  normalizeOfflineCodePublicLocatorV2,
  type OfflineCodeChallengeV2,
  type OfflineCodeClientSecretV2,
  type OfflineCodeKdfProfileV2,
  type OfflineCodePossessionProofV2,
  type OfflineCodePublicLocatorV2,
  type OfflineCodeRecordBindingV2,
} from "@vault/shared-types";

export const CLAIMANT_OFFLINE_CODE_V2_CLIENT_PROOF_APPROVED = false as const;

export type OfflineCodeV2ProofCrypto = Readonly<{
  ready(): Promise<void>;
  argon2id(input: Uint8Array, salt: Uint8Array, opslimit: number,
    memlimitBytes: number, outputBytes: number): Uint8Array;
  sha256(input: Uint8Array): Promise<Uint8Array>;
  hkdfSha256(inputKey: Uint8Array, salt: Uint8Array, info: Uint8Array,
    outputBytes: number): Uint8Array;
  seedKeyPair(seed: Uint8Array): Readonly<{ publicKey: Uint8Array; privateKey: Uint8Array }>;
  sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array;
  wipe(value: Uint8Array): void;
}>;

export type OfflineCodeV2ProofInput = Readonly<{
  publicLocator: OfflineCodePublicLocatorV2;
  clientSecret: OfflineCodeClientSecretV2;
  kdfProfile: OfflineCodeKdfProfileV2;
  recordBinding: OfflineCodeRecordBindingV2;
  challenge: OfflineCodeChallengeV2;
  expectedOrigin: string;
  now?: () => Date;
}>;

export type OfflineCodeV2BenchmarkDevice = Readonly<{
  platform: "android" | "ios" | "desktop_reference";
  evidenceClass: "physical" | "simulator" | "desktop_reference";
  model: string;
  osVersion: string;
  cryptoRuntime: "react-native-libsodium" | "libsodium-wasm";
}>;

export type OfflineCodeV2KdfBenchmark = Readonly<{
  protocol: typeof OFFLINE_CODE_PROTOCOL_V2;
  purpose: "synthetic_kdf_benchmark";
  profile_id: string;
  synthetic_only: true;
  production_approved: false;
  representative_device: boolean;
  sample_count: number;
  durations_ms: readonly number[];
  median_ms: number;
  p95_ms: number;
  device: OfflineCodeV2BenchmarkDevice;
}>;

export class OfflineCodeV2ClientProofError extends Error {
  constructor(readonly kind: "disabled" | "failed") {
    super("Offline-code proof production is unavailable.");
    this.name = "OfflineCodeV2ClientProofError";
  }
}

type OfflineCodeV2BenchmarkInput = Omit<OfflineCodeV2ProofInput, "challenge" | "expectedOrigin" | "now"> & Readonly<{
  device: OfflineCodeV2BenchmarkDevice;
  sampleCount: number;
  clock?: () => number;
}>;

export function createOfflineCodeV2ClientProofProducer(input: Readonly<{
  approved?: boolean;
  crypto: OfflineCodeV2ProofCrypto;
}>) {
  const enabled = input.approved ?? CLAIMANT_OFFLINE_CODE_V2_CLIENT_PROOF_APPROVED;
  return {
    produce: (value: OfflineCodeV2ProofInput) => produceProof(input.crypto, enabled, value),
    benchmark: (value: OfflineCodeV2BenchmarkInput) => benchmarkKdf(input.crypto, enabled, value),
  };
}

async function produceProof(crypto: OfflineCodeV2ProofCrypto, enabled: boolean,
  value: OfflineCodeV2ProofInput): Promise<OfflineCodePossessionProofV2> {
  if (!enabled) throw new OfflineCodeV2ClientProofError("disabled");
  let root: Uint8Array | null = null;
  let proofSeed: Uint8Array | null = null;
  let privateKey: Uint8Array | null = null;
  try {
    const material = await prepare(crypto, value);
    root = material.root;
    const proofContext = canonical({
      protocol: OFFLINE_CODE_PROTOCOL_V2,
      purpose: "possession_proof_seed",
      label: OFFLINE_CODE_V2_LABELS.proofSeed,
      binding_digest: encodeBase64Url(material.provisionalDigest),
    });
    proofSeed = crypto.hkdfSha256(root, await crypto.sha256(proofContext), proofContext, 32);
    const keys = crypto.seedKeyPair(proofSeed);
    privateKey = keys.privateKey;
    equalBytes(keys.publicKey, decodeBase64Url(value.recordBinding.proof_public_key));
    bindChallenge(value.challenge, value.recordBinding, material.recordBindingDigest,
      value.expectedOrigin, value.now?.() ?? new Date());
    const message = canonical({
      protocol: OFFLINE_CODE_PROTOCOL_V2,
      purpose: "possession_proof",
      label: OFFLINE_CODE_V2_LABELS.possessionProof,
      challenge: value.challenge,
    });
    return assertOfflineCodePossessionProofV2({
      protocol: OFFLINE_CODE_PROTOCOL_V2,
      purpose: "possession_proof",
      authority: OFFLINE_CODE_V2_AUTHORITY,
      challenge_id: value.challenge.challenge_id,
      locator_record_id: value.recordBinding.locator_record_id,
      locator_version: value.recordBinding.locator_version,
      proof_key_version: value.recordBinding.proof_key_version,
      proof_public_key: value.recordBinding.proof_public_key,
      record_binding_digest: encodeBase64Url(material.recordBindingDigest),
      signature: encodeBase64Url(crypto.sign(message, privateKey)),
    });
  } catch (error) {
    if (error instanceof OfflineCodeV2ClientProofError) throw error;
    throw new OfflineCodeV2ClientProofError("failed");
  } finally {
    if (privateKey) crypto.wipe(privateKey);
    if (proofSeed) crypto.wipe(proofSeed);
    if (root) crypto.wipe(root);
  }
}

async function benchmarkKdf(crypto: OfflineCodeV2ProofCrypto, enabled: boolean,
  value: OfflineCodeV2BenchmarkInput): Promise<OfflineCodeV2KdfBenchmark> {
  if (!enabled) throw new OfflineCodeV2ClientProofError("disabled");
  try {
    assertDevice(value.device);
    if (!Number.isSafeInteger(value.sampleCount) || value.sampleCount < 1 || value.sampleCount > 10) fail();
    const clock = value.clock ?? (() => globalThis.performance.now());
    await crypto.ready();
    const prepared = validateMaterial(value);
    const durations: number[] = [];
    for (let sample = 0; sample < value.sampleCount; sample += 1) {
      const started = clock();
      const root = crypto.argon2id(prepared.rootInput, prepared.salt,
        value.kdfProfile.opslimit, value.kdfProfile.memlimit_bytes, value.kdfProfile.output_bytes);
      const ended = clock();
      crypto.wipe(root);
      const duration = Math.round((ended - started) * 100) / 100;
      if (!Number.isFinite(duration) || duration < 0) fail();
      durations.push(duration);
    }
    const sorted = [...durations].sort((left, right) => left - right);
    return {
      protocol: OFFLINE_CODE_PROTOCOL_V2,
      purpose: "synthetic_kdf_benchmark",
      profile_id: value.kdfProfile.profile_id,
      synthetic_only: true,
      production_approved: false,
      representative_device: value.device.evidenceClass === "physical",
      sample_count: durations.length,
      durations_ms: durations,
      median_ms: percentile(sorted, 0.5),
      p95_ms: percentile(sorted, 0.95),
      device: value.device,
    };
  } catch (error) {
    if (error instanceof OfflineCodeV2ClientProofError) throw error;
    throw new OfflineCodeV2ClientProofError("failed");
  }
}

async function prepare(crypto: OfflineCodeV2ProofCrypto, value: OfflineCodeV2ProofInput) {
  await crypto.ready();
  const material = validateMaterial(value);
  const locatorCommitment = await crypto.sha256(canonical({
    protocol: OFFLINE_CODE_PROTOCOL_V2,
    purpose: "public_locator_commitment",
    label: OFFLINE_CODE_V2_LABELS.locatorCommitment,
    locator_record_id: value.recordBinding.locator_record_id,
    locator_version: value.recordBinding.locator_version,
    normalized_locator: material.normalizedLocator,
  }));
  equalBytes(locatorCommitment, decodeBase64Url(value.recordBinding.locator_commitment));
  const provisional = {
    protocol: OFFLINE_CODE_PROTOCOL_V2,
    purpose: "record_binding",
    locator_record_id: value.recordBinding.locator_record_id,
    locator_version: value.recordBinding.locator_version,
    locator_commitment: value.recordBinding.locator_commitment,
    grant_id: value.recordBinding.grant_id,
    owner_id: value.recordBinding.owner_id,
    kdf_profile_id: value.recordBinding.kdf_profile_id,
    proof_key_version: value.recordBinding.proof_key_version,
  } as const;
  const provisionalDigest = await labelledDigest(crypto, OFFLINE_CODE_V2_LABELS.recordBinding, provisional);
  const recordBindingDigest = await labelledDigest(crypto, OFFLINE_CODE_V2_LABELS.recordBinding, value.recordBinding);
  return {
    ...material,
    provisionalDigest,
    recordBindingDigest,
    root: crypto.argon2id(material.rootInput, material.salt, value.kdfProfile.opslimit,
      value.kdfProfile.memlimit_bytes, value.kdfProfile.output_bytes),
  };
}

function validateMaterial(value: Omit<OfflineCodeV2ProofInput, "challenge" | "expectedOrigin" | "now">) {
  const publicLocator = assertOfflineCodePublicLocatorV2(value.publicLocator);
  const clientSecret = assertOfflineCodeClientSecretV2(value.clientSecret);
  assertOfflineCodeKdfProfileV2(value.kdfProfile);
  const recordBinding = assertOfflineCodeRecordBindingV2(value.recordBinding);
  if (recordBinding.kdf_profile_id !== value.kdfProfile.profile_id) fail();
  const normalizedLocator = normalizeOfflineCodePublicLocatorV2(publicLocator.locator);
  const normalizedSecret = normalizeOfflineCodeClientSecretV2(clientSecret.secret);
  return {
    normalizedLocator,
    salt: decodeBase64Url(value.kdfProfile.salt),
    rootInput: canonical({
      protocol: OFFLINE_CODE_PROTOCOL_V2,
      purpose: "client_secret_root",
      label: OFFLINE_CODE_V2_LABELS.rootInput,
      locator_record_id: recordBinding.locator_record_id,
      locator_version: recordBinding.locator_version,
      normalized_locator: normalizedLocator,
      normalized_secret: normalizedSecret,
    }),
  };
}

function bindChallenge(challenge: OfflineCodeChallengeV2, binding: OfflineCodeRecordBindingV2,
  bindingDigest: Uint8Array, expectedOrigin: string, now: Date): void {
  assertOfflineCodeChallengeV2(challenge);
  if (challenge.origin !== expectedOrigin || new URL(expectedOrigin).origin !== expectedOrigin) fail();
  if (now.toISOString() < challenge.issued_at || now.toISOString() >= challenge.expires_at) fail();
  if (challenge.locator_record_id !== binding.locator_record_id
    || challenge.locator_version !== binding.locator_version
    || challenge.locator_commitment !== binding.locator_commitment
    || challenge.proof_key_version !== binding.proof_key_version
    || challenge.proof_public_key !== binding.proof_public_key
    || challenge.record_binding_digest !== encodeBase64Url(bindingDigest)) fail();
}

async function labelledDigest(crypto: OfflineCodeV2ProofCrypto, label: string, value: unknown) {
  return crypto.sha256(concat(new TextEncoder().encode(label), Uint8Array.of(0), canonical(value)));
}

function canonical(value: unknown): Uint8Array { return canonicalJsonBytes(value as never); }
function concat(...values: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(values.reduce((length, value) => length + value.length, 0));
  let offset = 0;
  for (const value of values) { output.set(value, offset); offset += value.length; }
  return output;
}

function decodeBase64Url(value: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const output: number[] = [];
  let buffer = 0; let bits = 0;
  for (const character of value) {
    const index = alphabet.indexOf(character); if (index < 0) fail();
    buffer = (buffer << 6) | index; bits += 6;
    if (bits >= 8) { bits -= 8; output.push((buffer >>> bits) & 255); }
  }
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) fail();
  return Uint8Array.from(output);
}

function encodeBase64Url(value: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"; let output = "";
  for (let index = 0; index < value.length; index += 3) {
    const block = ((value[index] ?? 0) << 16) | ((value[index + 1] ?? 0) << 8) | (value[index + 2] ?? 0);
    output += alphabet[(block >>> 18) & 63] + alphabet[(block >>> 12) & 63];
    if (index + 1 < value.length) output += alphabet[(block >>> 6) & 63];
    if (index + 2 < value.length) output += alphabet[block & 63];
  }
  return output;
}

function equalBytes(left: Uint8Array, right: Uint8Array): void {
  if (left.length !== right.length) fail();
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  if (difference !== 0) fail();
}
function assertDevice(value: OfflineCodeV2BenchmarkDevice): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,79}$/u.test(value.model)
    || !/^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,39}$/u.test(value.osVersion)) fail();
  if ((value.platform === "desktop_reference") !== (value.evidenceClass === "desktop_reference")) fail();
  if (value.platform === "desktop_reference" && value.cryptoRuntime !== "libsodium-wasm") fail();
  if (value.platform !== "desktop_reference" && value.cryptoRuntime !== "react-native-libsodium") fail();
}
function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? fail();
}
function fail(): never { throw new Error("invalid"); }
