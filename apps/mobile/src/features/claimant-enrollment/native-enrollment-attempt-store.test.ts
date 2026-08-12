import { describe, expect, it } from "vitest";

import {
  CLAIMANT_NATIVE_ENROLLMENT_ATTEMPT_PERSISTENCE_APPROVED,
  createNativeEnrollmentAttemptStoreV1,
  type NativeEnrollmentAttemptSecureStorageV1,
  type NativeEnrollmentAttemptV1,
} from "./native-enrollment-attempt-store";

const account = "21000000-0000-4000-8000-000000000002";
const invitation = "51000000-0000-4000-8000-000000000005";

describe("encrypted native enrollment attempt store", () => {
  it("is hard-disabled before storage access", async () => {
    expect(CLAIMANT_NATIVE_ENROLLMENT_ATTEMPT_PERSISTENCE_APPROVED).toBe(false);
    const storage = secureStorage();
    await expect(createNativeEnrollmentAttemptStoreV1({ storage }).load(account))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(storage.values.size).toBe(0);
  });

  it("encrypts bounded state with device-only storage and restores the exact account binding", async () => {
    const storage = secureStorage(); const store = createNativeEnrollmentAttemptStoreV1({
      approved: true, crypto: fakeCrypto(), storage });
    await store.save(attempt());
    const serialized = [...storage.values.values()].join("\n");
    expect(serialized).not.toContain(invitation); expect(serialized).not.toContain("claimant-key.v1.synthetic");
    expect(storage.options.every((value) => value.keychainAccessible === 7)).toBe(true);
    await expect(store.load(account)).resolves.toEqual(attempt());
  });

  it("fails closed for tamper, cross-account reuse, prohibited fields, and partial state", async () => {
    const storage = secureStorage(); const store = createNativeEnrollmentAttemptStoreV1({
      approved: true, crypto: fakeCrypto(), storage });
    await store.save(attempt());
    const blob = [...storage.values.keys()].find((key) => key.endsWith(":blob"))!;
    const key = [...storage.values.keys()].find((value) => value.endsWith(":key"))!;
    const otherAccount = "22000000-0000-4000-8000-000000000002";
    storage.values.set(`claimant_native_enrollment_attempt_v1:${otherAccount}:blob`, storage.values.get(blob)!);
    storage.values.set(`claimant_native_enrollment_attempt_v1:${otherAccount}:key`, storage.values.get(key)!);
    await expect(store.load(otherAccount)).rejects.toMatchObject({ kind: "tampered" });

    storage.values.set(blob, `${storage.values.get(blob)}A`);
    await expect(store.load(account)).rejects.toMatchObject({ kind: "tampered" });

    const hostile = { ...attempt(), bearer_token: "secret" };
    await expect(store.save(hostile as never)).rejects.toThrow();
    storage.values.clear(); storage.values.set(`claimant_native_enrollment_attempt_v1:${account}:blob`, "{}");
    await expect(store.load(account)).rejects.toMatchObject({ kind: "tampered" });
  });

  it("clears both ciphertext and encryption key after a terminal outcome", async () => {
    const storage = secureStorage(); const store = createNativeEnrollmentAttemptStoreV1({
      approved: true, crypto: fakeCrypto(), storage });
    await store.save(attempt()); await store.clear(account); expect(storage.values.size).toBe(0);
  });
});

function attempt(): NativeEnrollmentAttemptV1 { return {
  account_id: account, app_attest_challenge_id: "71000000-0000-4000-8000-000000000002",
  attempt_id: "91000000-0000-4000-8000-000000000019", created_at: "2026-08-12T12:00:00.000Z",
  expires_at: "2026-08-12T12:05:00.000Z", idempotency_keys: {
    native_complete: "91000000-0000-4000-8000-000000000019",
    native_issue: "91000000-0000-4000-8000-000000000018",
    registration_complete: "91000000-0000-4000-8000-000000000017",
    registration_issue: "91000000-0000-4000-8000-000000000016" },
  invitation_reference: invitation, key_alias_reference: "claimant-key.v1.synthetic",
  native_challenge_id: "71000000-0000-4000-8000-000000000001", phase: "reconciliation_required",
  protocol: "sanduqkin:claim:native-enrollment-attempt:v1",
  registration_challenge_id: "71000000-0000-4000-8000-000000000003",
  request_digests: { native_complete: "A".repeat(43), native_issue: "B".repeat(43),
    registration_complete: "C".repeat(43), registration_issue: "D".repeat(43) },
  updated_at: "2026-08-12T12:01:00.000Z",
}; }

function secureStorage(): NativeEnrollmentAttemptSecureStorageV1 & { values: Map<string, string>;
  options: { keychainAccessible?: number }[] } {
  const values = new Map<string, string>(); const options: { keychainAccessible?: number }[] = [];
  return { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7, values, options,
    async deleteItemAsync(key, value) { options.push(value ?? {}); values.delete(key); },
    async getItemAsync(key, value) { options.push(value ?? {}); return values.get(key) ?? null; },
    async setItemAsync(key, value, setting) { options.push(setting ?? {}); values.set(key, value); } };
}

function fakeCrypto() { const encode = (value: Uint8Array) => Buffer.from(value).toString("base64");
  const decode = (value: string) => new Uint8Array(Buffer.from(value, "base64"));
  const xor = (value: Uint8Array) => value.map((byte, index) => byte ^ ((index * 17 + 91) & 255));
  return { async decrypt(input: { ciphertext: Uint8Array }) { return new TextDecoder().decode(xor(input.ciphertext)); },
    async encrypt(input: { plaintext: string }) { return { ciphertext: xor(new TextEncoder().encode(input.plaintext)), nonce: new Uint8Array(24).fill(3) }; },
    async fromBase64(value: string) { return decode(value); }, async generateKey() { return new Uint8Array(32).fill(9); },
    async toBase64(value: Uint8Array) { return encode(value); } };
}
