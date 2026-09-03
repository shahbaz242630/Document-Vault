const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const coordinator = readFileSync(join(root,
  "apps/mobile/src/features/claimant-retrieval/native-package-open-coordinator.ts"), "utf8");
const adapter = readFileSync(join(root,
  "apps/mobile/src/features/claimant-retrieval/native-package-open-adapter.ts"), "utf8");

test("keeps native package opening immutable-false", () => {
  assert.match(coordinator, /CLAIMANT_NATIVE_PACKAGE_OPEN_APPROVED = false as const/u);
  assert.match(adapter, /CLAIMANT_NATIVE_PACKAGE_OPEN_ADAPTER_APPROVED = false as const/u);
});

test("requires a served encrypted package while retrieval remains incomplete", () => {
  assert.match(coordinator, /deliveryStatus: z\.literal\("served"\)/u);
  assert.match(coordinator, /packageServed: z\.literal\(true\)/u);
  assert.match(coordinator, /retrievalCompleted: z\.literal\(false\)/u);
  assert.match(coordinator, /retrievalCompleted: false as const/u);
});

test("cross-binds the canonical manifest, package, grant, key, expiry, and ordered assets", () => {
  for (const token of ["canonicalJson(manifest as never)",
    "manifest.claim_id !== payload.case_id",
    "manifest.release_package_id !== payload.release_package_id",
    "material.grant_id !== payload.release_material.grant_id",
    "material.recipient_key_id !== payload.release_material.recipient_key_id",
    "Date.parse(manifest.expires_at) <= now.getTime()", "!contiguousAssets(payload.assets)",
    "hexDigestToBase64url(ciphertext_digest)"])
    assert.ok(coordinator.includes(token), token);
});

test("delegates exact digest and Ed25519 verification only to the native-shaped adapter", () => {
  for (const token of ["expectedPayloadDigest: request.data.payloadDigest",
    "expectedPayloadBytes: request.data.payloadBytes",
    "expectedManifestDigest: payload.data.signed_manifest.manifest_digest",
    "detachedSignature: payload.data.signed_manifest.detached_signature",
    "trustedSigningKey: key.data"])
    assert.ok(coordinator.includes(token), token);
  assert.match(adapter, /signing_public_key: value\.trustedSigningKey\.publicKey/u);
  assert.match(adapter, /signing_key_id: value\.trustedSigningKey\.signingKeyId/u);
  assert.match(adapter, /delivery_key: value\.deliveryKey/u);
  assert.match(adapter, /receipt_ref: value\.receiptRef/u);
});

test("returns only an opaque local-open reference with export fixed false", () => {
  assert.match(coordinator, /openSessionReference: opened\.data\.open_session_reference/u);
  assert.match(coordinator, /plaintextExported: opened\.data\.plaintext_exported/u);
  assert.match(coordinator, /plaintext_exported: z\.literal\(false\)/u);
  const result = coordinator.slice(coordinator.indexOf("return { assetCount"),
    coordinator.indexOf("} catch (error)"));
  assert.doesNotMatch(result, /deliveryPayload|ciphertext|canonicalManifest|detachedSignature/u);
});
