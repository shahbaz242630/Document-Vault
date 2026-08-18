import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createEncryptedPackageDeliveryTransactionClientV1 }
  from "./encrypted-package-delivery-transaction-client.js";

describe("encrypted package delivery transaction client", () => {
  it("validates and maps one exact encrypted delivery payload", async () => {
    const rpc = vi.fn(async () => ({ data: preparedResult(), error: null }));
    await expect(createEncryptedPackageDeliveryTransactionClientV1(rpc).prepare(prepareInput()))
      .resolves.toMatchObject({ caseState: "release_ready", deliveryStatus: "prepared_unserved",
        packageServed: false, retrievalCompleted: false, payload: {
          protocol: "sanduqkin:claim:encrypted-delivery:v1" } });
    expect(rpc).toHaveBeenCalledWith("claimant_prepare_encrypted_package_delivery",
      expect.objectContaining({ p_delivery_id: id("05"),
        p_retrieval_session_id: id("06") }));
  });
  it("commits only a safe served result", async () => {
    const rpc = vi.fn(async () => ({ data: committedResult(), error: null }));
    await expect(createEncryptedPackageDeliveryTransactionClientV1(rpc).commit(commitInput()))
      .resolves.toMatchObject({ caseState: "released", packageServed: true,
        retrievalCompleted: false, firstSuccessfulDelivery: true });
    expect(rpc).toHaveBeenCalledWith("claimant_commit_encrypted_package_delivery",
      expect.objectContaining({ p_receipt_digest: "e".repeat(64) }));
  });
  it("rejects database errors, payload tampering, incoherence, and unsafe results", async () => {
    const client = (data: unknown, error: { code?: string } | null = null) =>
      createEncryptedPackageDeliveryTransactionClientV1(async () => ({ data, error }));
    await expect(client(null, { code: "40001" }).prepare(prepareInput()))
      .rejects.toMatchObject({ code: "40001" });
    for (const hostile of [{ ...preparedResult(), payload_digest: "0".repeat(64) },
      { ...preparedResult(), package_served: true },
      { ...preparedResult(), delivery_payload: JSON.stringify({ ...payload(), plaintext: true }) },
      { ...preparedResult(), retrieval_session_id: id("99") }]) {
      await expect(client(hostile).prepare(prepareInput())).rejects.toThrow(/invalid data/u);
    }
    for (const hostile of [{ ...committedResult(), package_served: false },
      { ...committedResult(), retrieval_completed: true },
      { ...committedResult(), case_state: "release_ready" },
      { ...committedResult(), signed_url: "forbidden" }]) {
      await expect(client(hostile).commit(commitInput())).rejects.toThrow(/invalid data/u);
    }
  });
});

function prepareInput() { return { caseId: id("01"), deliveryId: id("05"),
  deliveryKey: "synthetic_package_delivery_slice_4e", expectedCaseVersion: 7,
  idempotencyKey: id("07"), retrievalSessionId: id("06") }; }
function commitInput() { return { completedAt: "2026-08-18T12:01:00.000Z",
  deliveryId: id("05"), deliveryKey: "synthetic_package_delivery_slice_4e",
  idempotencyKey: id("08"), payloadBytes: payloadText().length,
  payloadDigest: createHash("sha256").update(payloadText()).digest("hex"),
  receiptDigest: "e".repeat(64), receiptRef: "synthetic_delivery_receipt_slice_4e" }; }
function preparedResult() { const text = payloadText(); return { case_id: id("01"),
  case_state: "release_ready", case_version: 7, delivery_id: id("05"),
  delivery_key: "synthetic_package_delivery_slice_4e", delivery_payload: text,
  delivery_status: "prepared_unserved", finalization_id: id("02"), grant_id: id("11"),
  lease_expires_at: "2026-08-18T12:02:00.000Z", package_served: false,
  payload_bytes: Buffer.byteLength(text),
  payload_digest: createHash("sha256").update(text).digest("hex"),
  recipient_key_id: id("31"), release_package_id: id("04"), replayed: false,
  retrieval_completed: false, retrieval_session_id: id("06") }; }
function committedResult() { return { case_id: id("01"), case_state: "released",
  case_version: 8, delivery_id: id("05"),
  delivery_key: "synthetic_package_delivery_slice_4e", delivery_status: "served",
  first_successful_delivery: true, package_served: true,
  receipt_ref: "synthetic_delivery_receipt_slice_4e", release_package_id: id("04"),
  replayed: false, retrieval_completed: false, retrieval_session_id: id("06"),
  served_at: "2026-08-18T12:01:00.000Z" }; }
function payloadText() { return JSON.stringify(payload()); }
function payload() { return { assets: [{ asset_type: "document",
  ciphertext: "A".repeat(32), ciphertext_digest: "a".repeat(64), nonce: "B".repeat(32),
  ordinal: 1, source_asset_id: id("41") }], case_id: id("01"),
  finalization_id: id("02"), protocol: "sanduqkin:claim:encrypted-delivery:v1",
  release_material: { aead: "xchacha20poly1305_ietf", ciphertext: "C".repeat(64),
    grant_id: id("11"), grant_version: 1, kdf: "hkdf_sha256",
    key_agreement: "p256_ecdh", nonce: "D".repeat(32),
    owner_ephemeral_public_key: "E".repeat(87), profile: "registered_recipient_v2",
    protocol: "sanduqkin:claim:recipient-grant:v2", recipient_key_id: id("31"),
    recipient_key_version: 1 }, release_package_id: id("04"),
  retrieval_session_id: id("06"), signed_manifest: {
    canonical_manifest: "m".repeat(256), detached_signature: "S".repeat(86),
    manifest_digest: "f".repeat(64), signature_algorithm: "ed25519" } }; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
