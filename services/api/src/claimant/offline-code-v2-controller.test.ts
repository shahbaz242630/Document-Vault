import { createHash, generateKeyPairSync, sign } from "node:crypto";

import { canonicalJson } from "@vault/shared-types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { app as mountedApp } from "../index.js";
import { CLAIMANT_OFFLINE_CODE_V2_CONTROLLER_APPROVED,
  createOfflineCodeV2BoundaryIndexer, createOfflineCodeV2Controller,
  createOfflineCodeV2PreflightController, type OfflineCodeV2ControllerAction }
  from "./offline-code-v2-controller.js";
import type { OfflineCodeV2ChallengeResult, OfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const apiOrigin = "https://api.sanduqkin.test";
const claimantOrigin = "https://app.sanduqkin.test";
const locator = "SK2-L-M6HA-7955-MTKT-HADA-NEPA-VBNF-P0-F";

describe("offline-code V2 controller", () => {
  it("keeps both mounted routes concealed before configuration or dependencies are touched", async () => {
    expect(CLAIMANT_OFFLINE_CODE_V2_CONTROLLER_APPROVED).toBe(false);
    const getConfig = vi.fn(); const getTrustedSignals = vi.fn();
    const response = await routeApp("issueChallenge", { getConfig, getTrustedSignals })
      .request(challengeUrl(), request({ locator }));
    expect(response.status).toBe(404); expect(getConfig).not.toHaveBeenCalled();
    expect(getTrustedSignals).not.toHaveBeenCalled();
    expect((await mountedApp.request(challengeUrl(), request({ locator }))).status).toBe(404);
    expect((await mountedApp.request(proofUrl(id("02")), request({}))).status).toBe(404);
  });

  it("issues only a possession challenge from server-derived trusted signals", async () => {
    const deps = approved();
    const response = await routeApp("issueChallenge", deps).request(challengeUrl(),
      request({ locator }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { status: "challenge_issued",
      authority: "route_possession_only", identity_verified: false,
      claim_created: false, release_authorized: false } });
    expect(deps.getTrustedSignals).toHaveBeenCalledOnce();
    expect(deps.indexer.derive).toHaveBeenCalledWith({ normalizedLocator: "M6HA7955MTKTHADANEPAVBNFP0",
      networkSignal: "trusted-network", deviceSignal: "trusted-device" });
    expect(deps.persistence.issueChallenge).toHaveBeenCalledWith({ ...digests(),
      origin: claimantOrigin, idempotencyKey: id("13") });

    const hostile = await routeApp("issueChallenge", approved()).request(challengeUrl(),
      request({ locator, networkSignal: "client-selected" }));
    expect(hostile.status).toBe(400);
  });

  it("fails closed without a trusted signal adapter before creating persistence", async () => {
    const deps = approved(); delete (deps as { getTrustedSignals?: unknown }).getTrustedSignals;
    const response = await routeApp("issueChallenge", deps).request(challengeUrl(),
      request({ locator }));
    expect(response.status).toBe(503); expect(deps.createPersistence).not.toHaveBeenCalled();
  });

  it("verifies a path-bound proof and returns possession authority only", async () => {
    const fixture = signedFixture(); const deps = approved();
    deps.persistence.recordAttempt.mockResolvedValueOnce(attemptResult("verified"));
    const response = await routeApp("verifyProof", deps).request(proofUrl(id("02")),
      request(fixture.body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: { status: "proof_verified",
      authority: "route_possession_only", route_possession_asserted: true,
      identity_verified: false, claim_created: false, release_authorized: false } });
    expect(deps.persistence.recordAttempt).toHaveBeenCalledWith(expect.objectContaining({
      challengeId: id("02"), locatorRecordId: id("01"), verificationOutcome: "verified" }));
  });

  it("returns one rejection for invalid real and unavailable synthetic challenges", async () => {
    const fixture = signedFixture(); fixture.body.possession_proof.signature =
      Buffer.alloc(64, 7).toString("base64url");
    for (const outcome of ["recorded", "unavailable"] as const) {
      const deps = approved();
      if (outcome === "recorded") {
        deps.persistence.recordAttempt.mockResolvedValueOnce(attemptResult("invalid"));
      } else deps.persistence.recordAttempt.mockRejectedValueOnce(new Error("unavailable"));
      const response = await routeApp("verifyProof", deps).request(proofUrl(id("02")),
        request(fixture.body));
      expect(response.status).toBe(401);
      expect(await response.text()).toBe('{"result":{"status":"proof_rejected",'
        + '"route_possession_asserted":false,"identity_verified":false,'
        + '"claim_created":false,"release_authorized":false}}');
    }
  });

  it("conceals origin/capability failures and enforces media, size, path, and UUIDv4", async () => {
    const deps = approved();
    expect((await routeApp("issueChallenge", deps).request(challengeUrl(),
      request({ locator }, { Origin: "https://hostile.test" }))).status).toBe(404);
    expect((await routeApp("issueChallenge", { ...deps,
      runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test" }) }).request(challengeUrl(),
      request({ locator }))).status).toBe(404);
    expect((await routeApp("issueChallenge", deps).request(challengeUrl(),
      request({ locator }, { "Content-Type": "text/plain" }))).status).toBe(415);
    expect((await routeApp("issueChallenge", deps).request(challengeUrl(),
      request({ locator }, { Authorization: "Bearer prohibited" }))).status).toBe(404);
    expect((await routeApp("issueChallenge", deps).request(challengeUrl(),
      request({ locator }, { Cookie: "session=prohibited" }))).status).toBe(404);
    expect((await routeApp("issueChallenge", deps).request(challengeUrl(),
      request({ locator }, { "Content-Length": "20000" }))).status).toBe(413);
    expect((await routeApp("issueChallenge", deps).request(challengeUrl(),
      request({ locator }, { "Idempotency-Key": id("13").replace("-4", "-1") }))).status)
      .toBe(400);
    const fixture = signedFixture();
    const mismatch = await routeApp("verifyProof", deps).request(proofUrl(id("99")),
      request(fixture.body));
    expect(mismatch.status).toBe(400); expect(deps.createPersistence).not.toHaveBeenCalled();
  });

  it("allows only the exact preflight and maps rate limiting without challenge material", async () => {
    const deps = approved(); const headers = { Origin: claimantOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type, Idempotency-Key" };
    const preflight = await routeApp("issueChallenge", deps).request(challengeUrl(),
      { method: "OPTIONS", headers });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(claimantOrigin);
    expect((await routeApp("issueChallenge", deps).request(challengeUrl(), { method: "OPTIONS",
      headers: { ...headers, "Access-Control-Request-Headers": "Content-Type, Authorization" } })).status)
      .toBe(404);

    deps.persistence.issueChallenge.mockResolvedValueOnce({ rateLimited: true,
      retryAfterSeconds: 300, identityVerified: false, claimCreated: false,
      releaseAuthorized: false, replayed: false });
    const limited = await routeApp("issueChallenge", deps).request(challengeUrl(),
      request({ locator }));
    expect(limited.status).toBe(429); expect(limited.headers.get("Retry-After")).toBe("300");
    expect(await limited.text()).not.toContain("challenge");
  });

  it("domain-separates stable locator, network, device, and global boundary digests", async () => {
    const indexer = createOfflineCodeV2BoundaryIndexer(config());
    const first = await indexer.derive({ normalizedLocator: "LOCATOR", networkSignal: "NETWORK",
      deviceSignal: "DEVICE" });
    const replay = await indexer.derive({ normalizedLocator: "LOCATOR", networkSignal: "NETWORK",
      deviceSignal: "DEVICE" });
    expect(replay).toEqual(first); expect(new Set(Object.values(first)).size).toBe(4);
    const changed = await indexer.derive({ normalizedLocator: "OTHER", networkSignal: "NETWORK" });
    expect(changed.locatorIndexDigest).not.toBe(first.locatorIndexDigest);
    expect(changed.networkBucketDigest).toBe(first.networkBucketDigest);
    expect(changed.globalBucketDigest).toBe(first.globalBucketDigest);
  });
});

function routeApp(action: OfflineCodeV2ControllerAction,
  deps: Parameters<typeof createOfflineCodeV2Controller>[1]) {
  const app = new Hono(); const path = action === "issueChallenge"
    ? "/claimant/offline-code/v2/challenges"
    : "/claimant/offline-code/v2/challenges/:challengeId/proofs";
  app.post(path, createOfflineCodeV2Controller(action, deps));
  app.options(path, createOfflineCodeV2PreflightController(deps)); return app;
}

function approved() {
  const persistence = {
    register: vi.fn<OfflineCodeV2PersistenceTransactionClient["register"]>(),
    issueChallenge: vi.fn<OfflineCodeV2PersistenceTransactionClient["issueChallenge"]>(
      async () => issued()),
    recordAttempt: vi.fn<OfflineCodeV2PersistenceTransactionClient["recordAttempt"]>(),
    revoke: vi.fn<OfflineCodeV2PersistenceTransactionClient["revoke"]>(),
  };
  const indexer = { derive: vi.fn(async () => digests()) };
  return { approved: true, runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test",
    CLAIMANT_RUNTIME_ENABLED: "true", CLAIMANT_AUTHENTICATION_ENABLED: "true",
    CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true" }), getConfig: vi.fn(() => config()),
    getTrustedSignals: vi.fn(async () => ({ networkSignal: "trusted-network",
      deviceSignal: "trusted-device" })), createIndexer: vi.fn(() => indexer),
    createPersistence: vi.fn(() => persistence), indexer, persistence };
}

function config() { return { apiOrigin, claimantOrigin, locatorIndexKey: digest(Buffer.from("locator-key")),
  rateLimitKey: digest(Buffer.from("rate-key")), serviceRoleKey: "synthetic-service-role",
  supabaseUrl: "https://synthetic.supabase.test" }; }
function request(body: unknown, overrides: Record<string, string> = {}) { return { method: "POST",
  headers: { Origin: claimantOrigin, "Content-Type": "application/json",
    "Idempotency-Key": id("13"), ...overrides }, body: JSON.stringify(body) }; }
function challengeUrl() { return `${apiOrigin}/claimant/offline-code/v2/challenges`; }
function proofUrl(challengeId: string) {
  return `${challengeUrl()}/${challengeId}/proofs`;
}
function digests() { return { locatorIndexDigest: digest(Buffer.from("locator")),
  networkBucketDigest: digest(Buffer.from("network")),
  deviceBucketDigest: digest(Buffer.from("device")),
  globalBucketDigest: digest(Buffer.from("global")) }; }
function issued(): OfflineCodeV2ChallengeResult { return { rateLimited: false, challenge: { authority: "route_possession_only",
  challenge_id: id("02"), expires_at: "2026-08-30T10:05:00.000Z",
  issued_at: "2026-08-30T10:00:00.000Z", locator_commitment: digest(Buffer.from("commitment")),
  locator_record_id: id("01"), locator_version: 2 as const,
  nonce: digest(Buffer.from("nonce")), origin: claimantOrigin, proof_key_version: 1 as const,
  proof_public_key: digest(Buffer.from("proof-key")),
  protocol: "sanduqkin:claim:offline-code:v2" as const,
  purpose: "possession_challenge" as const,
  record_binding_digest: digest(Buffer.from("binding")) }, challengeBytesBase64url: "Q".repeat(80),
  challengeBytesDigest: digest(Buffer.from("challenge")), kdfProfile: { algorithm: "argon2id" as const,
    memlimit_bytes: 67_108_864 as const, opslimit: 2 as const, output_bytes: 32 as const,
    production_approved: false as const, profile_id: "argon2id-synthetic-test-v2" as const,
    protocol: "sanduqkin:claim:offline-code:v2" as const, purpose: "client_secret_root" as const,
    salt: `${"K".repeat(21)}A` }, identityVerified: false as const, claimCreated: false as const,
  releaseAuthorized: false as const, replayed: false }; }

function signedFixture() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const proofPublicKey = publicKey.export({ format: "der", type: "spki" }).subarray(-32)
    .toString("base64url");
  const challenge = { authority: "route_possession_only" as const, challenge_id: id("02"),
    expires_at: "2026-08-30T10:05:00.000Z", issued_at: "2026-08-30T10:00:00.000Z",
    locator_commitment: digest(Buffer.from("commitment")), locator_record_id: id("01"),
    locator_version: 2, nonce: digest(Buffer.from("nonce")), origin: claimantOrigin,
    proof_key_version: 1, proof_public_key: proofPublicKey,
    protocol: "sanduqkin:claim:offline-code:v2" as const,
    purpose: "possession_challenge" as const,
    record_binding_digest: digest(Buffer.from("binding")) };
  const message = Buffer.from(canonicalJson({ protocol: "sanduqkin:claim:offline-code:v2",
    purpose: "possession_proof", label: "sanduqkin:claim:offline-code:v2:possession-proof",
    challenge }));
  const possessionProof = { protocol: "sanduqkin:claim:offline-code:v2" as const,
    purpose: "possession_proof" as const, authority: "route_possession_only" as const,
    challenge_id: challenge.challenge_id, locator_record_id: challenge.locator_record_id,
    locator_version: 2, proof_key_version: 1, proof_public_key: proofPublicKey,
    record_binding_digest: challenge.record_binding_digest,
    signature: sign(null, message, privateKey).toString("base64url") };
  return { body: { challenge, challenge_bytes_base64url:
    Buffer.from(canonicalJson(challenge)).toString("base64url"), possession_proof: possessionProof } };
}
function attemptResult(outcome: "invalid" | "verified") { return { challengeId: id("02"),
  locatorRecordId: id("01"), verificationOutcome: outcome,
  routePossessionAsserted: outcome === "verified", locatorLocked: false,
  identityVerified: false as const, claimCreated: false as const,
  releaseAuthorized: false as const, replayed: false }; }
function digest(value: Buffer) { return createHash("sha256").update(value).digest("base64url"); }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
