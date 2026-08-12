import { z } from "zod";

import {
  decryptVaultPayload,
  encryptVaultPayload,
  fromBase64,
  generateMasterEncryptionKey,
  toBase64,
} from "../../shared/crypto/vault-crypto";

export const CLAIMANT_NATIVE_ENROLLMENT_ATTEMPT_PERSISTENCE_APPROVED = false as const;

const STORAGE_PREFIX = "claimant_native_enrollment_attempt_v1";
const MAX_ENVELOPE_BYTES = 24_000;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const digest = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const keyAlias = z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/u);

export const nativeEnrollmentAttemptSchemaV1 = z.strictObject({
  account_id: uuid,
  app_attest_challenge_id: uuid.nullable(),
  attempt_id: uuid,
  created_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
  idempotency_keys: z.strictObject({ native_complete: uuid, native_issue: uuid,
    registration_complete: uuid, registration_issue: uuid }),
  invitation_reference: uuid,
  key_alias_reference: keyAlias,
  native_challenge_id: uuid.nullable(),
  phase: z.enum(["key_created", "challenge_issued", "finalization_pending", "reconciliation_required"]),
  protocol: z.literal("sanduqkin:claim:native-enrollment-attempt:v1"),
  registration_challenge_id: uuid,
  request_digests: z.strictObject({ native_complete: digest.nullable(), native_issue: digest.nullable(),
    registration_complete: digest, registration_issue: digest }),
  updated_at: z.string().datetime({ offset: true }),
});

export type NativeEnrollmentAttemptV1 = z.infer<typeof nativeEnrollmentAttemptSchemaV1>;

type SecureStorageOptions = Readonly<{ keychainAccessible?: number }>;
export type NativeEnrollmentAttemptSecureStorageV1 = Readonly<{
  WHEN_UNLOCKED_THIS_DEVICE_ONLY?: number;
  deleteItemAsync(key: string, options?: SecureStorageOptions): Promise<void>;
  getItemAsync(key: string, options?: SecureStorageOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStorageOptions): Promise<void>;
}>;

type AttemptCryptoV1 = Readonly<{
  decrypt(input: Readonly<{ associatedData: string; ciphertext: Uint8Array; key: Uint8Array; nonce: Uint8Array }>): Promise<string>;
  encrypt(input: Readonly<{ associatedData: string; key: Uint8Array; plaintext: string }>): Promise<Readonly<{ ciphertext: Uint8Array; nonce: Uint8Array }>>;
  fromBase64(value: string): Promise<Uint8Array>;
  generateKey(): Promise<Uint8Array>;
  toBase64(value: Uint8Array): Promise<string>;
}>;

const defaultCrypto: AttemptCryptoV1 = {
  decrypt: decryptVaultPayload,
  encrypt: encryptVaultPayload,
  fromBase64,
  generateKey: generateMasterEncryptionKey,
  toBase64,
};

export class NativeEnrollmentAttemptStoreError extends Error {
  constructor(readonly kind: "disabled" | "invalid" | "tampered" | "unavailable") {
    super("Native enrollment attempt state is unavailable.");
    this.name = "NativeEnrollmentAttemptStoreError";
  }
}

export function createNativeEnrollmentAttemptStoreV1(input: Readonly<{
  approved?: boolean;
  crypto?: AttemptCryptoV1;
  storage: NativeEnrollmentAttemptSecureStorageV1 | null;
}>) {
  const approved = input.approved ?? CLAIMANT_NATIVE_ENROLLMENT_ATTEMPT_PERSISTENCE_APPROVED;
  const crypto = input.crypto ?? defaultCrypto;
  const options: SecureStorageOptions = {
    keychainAccessible: input.storage?.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  return {
    async clear(accountId: string): Promise<void> {
      requireApproved(approved); const account = requireUuid(accountId);
      if (!input.storage) throw new NativeEnrollmentAttemptStoreError("unavailable");
      await Promise.all([
        input.storage.deleteItemAsync(blobKey(account), options),
        input.storage.deleteItemAsync(encryptionKey(account), options),
      ]);
    },

    async load(accountId: string): Promise<NativeEnrollmentAttemptV1 | null> {
      requireApproved(approved); const account = requireUuid(accountId);
      if (!input.storage) throw new NativeEnrollmentAttemptStoreError("unavailable");
      const [rawEnvelope, rawKey] = await Promise.all([
        input.storage.getItemAsync(blobKey(account), options),
        input.storage.getItemAsync(encryptionKey(account), options),
      ]);
      if (!rawEnvelope && !rawKey) return null;
      if (!rawEnvelope || !rawKey || byteLength(rawEnvelope) > MAX_ENVELOPE_BYTES) {
        throw new NativeEnrollmentAttemptStoreError("tampered");
      }
      try {
        const envelope = envelopeSchema.parse(JSON.parse(rawEnvelope));
        const key = await crypto.fromBase64(rawKey);
        const plaintext = await crypto.decrypt({
          associatedData: associatedData(account),
          ciphertext: await crypto.fromBase64(envelope.ciphertext),
          key,
          nonce: await crypto.fromBase64(envelope.nonce),
        });
        if (byteLength(plaintext) > MAX_ENVELOPE_BYTES) throw new Error();
        const attempt = nativeEnrollmentAttemptSchemaV1.parse(JSON.parse(plaintext));
        if (attempt.account_id !== account || attempt.attempt_id !== attempt.idempotency_keys.native_complete) throw new Error();
        return attempt;
      } catch {
        throw new NativeEnrollmentAttemptStoreError("tampered");
      }
    },

    async save(value: NativeEnrollmentAttemptV1): Promise<void> {
      requireApproved(approved);
      const attempt = nativeEnrollmentAttemptSchemaV1.parse(value);
      if (attempt.attempt_id !== attempt.idempotency_keys.native_complete) {
        throw new NativeEnrollmentAttemptStoreError("invalid");
      }
      if (!input.storage) throw new NativeEnrollmentAttemptStoreError("unavailable");
      const plaintext = JSON.stringify(attempt);
      if (byteLength(plaintext) > MAX_ENVELOPE_BYTES) throw new NativeEnrollmentAttemptStoreError("invalid");
      let key = await input.storage.getItemAsync(encryptionKey(attempt.account_id), options);
      if (!key) {
        key = await crypto.toBase64(await crypto.generateKey());
        await input.storage.setItemAsync(encryptionKey(attempt.account_id), key, options);
      }
      const encrypted = await crypto.encrypt({ associatedData: associatedData(attempt.account_id),
        key: await crypto.fromBase64(key), plaintext });
      const envelope = JSON.stringify({ ciphertext: await crypto.toBase64(encrypted.ciphertext),
        nonce: await crypto.toBase64(encrypted.nonce), version: 1 });
      if (byteLength(envelope) > MAX_ENVELOPE_BYTES) throw new NativeEnrollmentAttemptStoreError("invalid");
      await input.storage.setItemAsync(blobKey(attempt.account_id), envelope, options);
    },
  };
}

export type NativeEnrollmentAttemptStoreV1 = ReturnType<typeof createNativeEnrollmentAttemptStoreV1>;

const envelopeSchema = z.strictObject({ ciphertext: z.string().min(24).max(MAX_ENVELOPE_BYTES),
  nonce: z.string().min(24).max(128), version: z.literal(1) });
function associatedData(accountId: string): string { return `${STORAGE_PREFIX}\0${accountId}`; }
function blobKey(accountId: string): string { return `${STORAGE_PREFIX}:${accountId}:blob`; }
function encryptionKey(accountId: string): string { return `${STORAGE_PREFIX}:${accountId}:key`; }
function byteLength(value: string): number { return new TextEncoder().encode(value).byteLength; }
function requireApproved(approved: boolean): void { if (!approved) throw new NativeEnrollmentAttemptStoreError("disabled"); }
function requireUuid(value: string): string {
  const parsed = uuid.safeParse(value); if (!parsed.success) throw new NativeEnrollmentAttemptStoreError("invalid"); return parsed.data;
}
