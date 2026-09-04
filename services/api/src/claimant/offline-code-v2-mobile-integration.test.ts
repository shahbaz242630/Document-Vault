/// <reference path="../../../../apps/mobile/src/types/libsodium-wrappers-sumo.d.ts" />

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OfflineCodeV2SyntheticAttempt } from "../../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-coordinator";
import { createOfflineCodeV2Lifecycle } from "../../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-lifecycle";
import type { OfflineCodeV2ProofInput } from "../../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-proof-core";
import { createOfflineCodeV2PlatformProofProducer } from "../../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-proof-producer";
import { app as mountedApp } from "../index.js";
import { createOfflineCodeV2Controller } from "./offline-code-v2-controller.js";
import { createOfflineCodeV2PersistenceTransactionClient } from "./offline-code-v2-persistence-transaction-client.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const unavailable = { name: "OfflineCodeV2UnavailableError", message: "Offline-code request is unavailable." };
const apiOrigin = "https://api.sanduqkin.test";
const challengePath = "/claimant/offline-code/v2/challenges";
const issueRpc = "claimant_issue_offline_code_v2_challenge";
const proofRpc = "claimant_record_offline_code_v2_attempt";
const success = { status: "proof_verified", authority: "route_possession_only", route_possession_asserted: true,
  identity_verified: false, claim_created: false, release_authorized: false } as const;
const denyNetwork = vi.fn(() => { throw new Error("External networking is prohibited in acceptance tests."); });
const disposals: (() => Promise<void>)[] = [];

beforeEach(() => { denyNetwork.mockClear(); vi.stubGlobal("fetch", denyNetwork); });
afterEach(async () => {
  try {
    await Promise.all(disposals.splice(0).map((dispose) => dispose()));
    expect(denyNetwork).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});

describe("offline-code V2 mobile/API integration acceptance", () => {
  it("keeps the real mounted API concealed and disabled composition side-effect free", async () => {
    const h = harness({ approved: false });
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.getConfig).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
    for (const path of [challengePath, `${challengePath}/${h.fixture.challenge.challenge_id}/proofs`]) {
      const response = await mountedApp.request(`${apiOrigin}${path}`, { method: "POST",
        headers: { Origin: h.fixture.challenge.origin, "Content-Type": "application/json" }, body: "{}" });
      expect(response.status).toBe(404);
    }
  });

  it("runs actual mobile crypto, HTTP controllers, signature verification, and RPC decoding with possession-only output", async () => {
    const h = harness(); await expect(h.runtime.start(h.attempt)).resolves.toEqual(success);
    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual([issueRpc, proofRpc]);
    expect(h.wire.map((request) => request.status)).toEqual([200, 200]);
    expect(h.produce).toHaveBeenCalledOnce(); expect(h.recorded.size).toBe(1);
    const issue = h.rpc.mock.calls[0][1];
    expect(Object.keys(issue).sort()).toEqual(["p_device_bucket_digest", "p_global_bucket_digest", "p_idempotency_key",
      "p_locator_index_digest", "p_network_bucket_digest", "p_origin"]);
    expect(new Set([issue.p_locator_index_digest, issue.p_network_bucket_digest,
      issue.p_device_bucket_digest, issue.p_global_bucket_digest]).size).toBe(4);
    const proof = h.rpc.mock.calls[1][1];
    expect(Object.keys(proof).sort()).toEqual(["p_challenge_id", "p_idempotency_key", "p_locator_record_id",
      "p_proof_signature_digest", "p_verification_outcome", "p_verified_challenge_bytes_digest", "p_verified_record_binding_digest"]);
    expect(proof.p_verification_outcome).toBe("verified");
    expect(proof.p_verified_challenge_bytes_digest === digest(Buffer.from(h.bytes, "base64url"))).toBe(true);
    expect(proof.p_proof_signature_digest === digest(Buffer.from(h.fixture.possession_proof.signature, "base64url"))).toBe(true);
    const trace = JSON.stringify({ wire: h.wire, rpc: h.rpc.mock.calls });
    for (const forbidden of [h.attempt.clientSecret.secret, "owner_id", "grant_id", "private_key", "wrapped_mek"])
      expect(trace.includes(forbidden)).toBe(false);
    expect(h.wire.every((request) => !request.headers.has("authorization") && !request.headers.has("cookie"))).toBe(true);
    expect(h.runtime.snapshot()).toEqual({ status: "completed", identity_verified: false, claim_created: false, release_authorized: false });
  });

  it("replays identical proof bytes after a lost committed response without new crypto or a second synthetic fact", async () => {
    const h = harness(); h.control.dropProofResponses = 1;
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.recorded.size).toBe(1);
    await expect(h.runtime.retryProof()).resolves.toEqual(success);
    expect(h.produce).toHaveBeenCalledOnce(); expect(h.recorded.size).toBe(1);
    const proofCalls = h.rpc.mock.calls.filter(([name]) => name === proofRpc);
    expect(proofCalls.length).toBe(2);
    expect(JSON.stringify(proofCalls[0]) === JSON.stringify(proofCalls[1])).toBe(true);
    expect(h.wire[1].body === h.wire[2].body).toBe(true);
    expect(h.wire[1].headers.get("idempotency-key") === h.wire[2].headers.get("idempotency-key")).toBe(true);
  });

  it("bounds ambiguous proof retries through the actual server path", async () => {
    const h = harness(); h.control.dropProofResponses = 10;
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    for (let index = 0; index < 4; index += 1) await expect(h.runtime.retryProof()).rejects.toMatchObject(unavailable);
    expect(h.rpc.mock.calls.filter(([name]) => name === proofRpc)).toHaveLength(3);
    expect(h.recorded.size).toBe(1); expect(h.produce).toHaveBeenCalledOnce();
  });

  it.each(["background", "locked", "session_ended", "disabled"])("suppresses local success after server acceptance followed by %s", async (state) => {
    const h = harness(); h.control.afterProofResponse = () => h.emit({ sequence: 1, state });
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    // Cancellation cannot undo a server fact already recorded; it still conveys no claim/release authority.
    expect(h.recorded.size).toBe(1);
    expect([...h.recorded.values()][0].result.release_authorized).toBe(false);
    expect(h.runtime.snapshot().status).toBe(state === "background" ? "suspended" : "closed");
    h.emit({ sequence: 2, state: "foreground" });
    await expect(h.runtime.retryProof()).rejects.toMatchObject(unavailable);
    expect(h.rpc.mock.calls.filter(([name]) => name === proofRpc)).toHaveLength(1);
  });

  it("stops after challenge receipt when lifecycle changes before proof production", async () => {
    const h = harness(); h.control.afterChallengeResponse = () => h.emit({ sequence: 1, state: "inactive" });
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.produce).not.toHaveBeenCalled(); expect(h.recorded.size).toBe(0);
    expect(h.rpc).toHaveBeenCalledOnce();
  });

  it("rejects a corrupted signature in the real server verifier and never reports possession", async () => {
    const h = harness(); const producer = createOfflineCodeV2PlatformProofProducer(true);
    h.produce.mockImplementationOnce(async (value) => {
      const proof = await producer.produce(value); const bytes = Buffer.from(proof.signature, "base64url"); bytes[0] ^= 1;
      return { ...proof, signature: bytes.toString("base64url") };
    });
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.wire.at(-1)?.status).toBe(401);
    expect(h.rpc.mock.calls.at(-1)?.[1].p_verification_outcome).toBe("invalid");
    expect([...h.recorded.values()][0].result.route_possession_asserted).toBe(false);
    await expect(h.runtime.retryProof()).rejects.toMatchObject(unavailable);
    expect(h.rpc).toHaveBeenCalledTimes(2);
  });

  it("returns the same client failure for unavailable-record challenges and invalid proofs", async () => {
    const h = harness({ unavailableRecord: true });
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.wire[0].status).toBe(200); expect(h.produce).not.toHaveBeenCalled();
    expect(h.recorded.size).toBe(0);
    const active = harness(); await active.runtime.start(active.attempt);
    const unknownBody = JSON.parse(h.wire[0].responseBody).result;
    const activeBody = JSON.parse(active.wire[0].responseBody).result;
    expect(Object.keys(unknownBody).sort()).toEqual(Object.keys(activeBody).sort());
    expect(h.wire[0].responseBody.length).toBe(active.wire[0].responseBody.length);
    expect(unknownBody.identity_verified).toBe(false); expect(unknownBody.claim_created).toBe(false);
  });

  it("handles the actual 429 response without crypto or a proof request", async () => {
    const h = harness({ rateLimited: true });
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.wire[0].status).toBe(429); expect(h.produce).not.toHaveBeenCalled();
    expect(h.rpc).toHaveBeenCalledOnce(); expect(h.recorded.size).toBe(0);
  });

  it("fails before persistence when the synthetic trusted-edge signal is absent", async () => {
    const h = harness({ trustedSignals: false });
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.wire[0].status).toBe(503); expect(h.rpc).not.toHaveBeenCalled();
    expect(h.createPersistence).not.toHaveBeenCalled(); expect(h.produce).not.toHaveBeenCalled();
  });

  it.each(["controller", "capability"])("keeps the %s kill switch effective through the composed client", async (gate) => {
    const h = harness(gate === "controller" ? { controllerApproved: false } : { capability: false });
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.wire[0].status).toBe(404); expect(h.getConfig).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each(["authorization", "cookie", "origin", "idempotency", "extra-body"])("rejects hostile %s wire input before persistence", async (kind) => {
    const h = harness(); h.control.mutateRequest = (body, headers) => {
      if (kind === "authorization") headers.set("Authorization", "Bearer synthetic-not-an-identity");
      if (kind === "cookie") headers.set("Cookie", "synthetic=not-an-identity");
      if (kind === "origin") headers.set("Origin", "https://hostile.test");
      if (kind === "idempotency") headers.set("Idempotency-Key", "invalid");
      if (kind === "extra-body") body.networkSignal = "client-must-not-set-this";
    };
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.rpc).not.toHaveBeenCalled(); expect(h.produce).not.toHaveBeenCalled();
  });

  it.each(["challenge_id", "canonical-bytes", "route"])("rejects a substituted proof %s without granting possession", async (kind) => {
    const h = harness(); h.control.mutateRequest = (body, _headers, proof) => {
      if (!proof) return;
      if (kind === "challenge_id") (body.possession_proof as Record<string, unknown>).challenge_id = otherId;
      if (kind === "canonical-bytes") body.challenge_bytes_base64url = `${body.challenge_bytes_base64url}A`;
    };
    if (kind === "route") h.control.proofRoute = `${challengePath}/${otherId}/proofs`;
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    if (kind === "challenge_id") {
      // Structurally valid cross-binding failures are recorded only as invalid attempts.
      expect(h.rpc.mock.calls.at(-1)?.[1].p_verification_outcome).toBe("invalid");
      expect(h.wire.at(-1)?.status).toBe(401);
    } else {
      expect(h.rpc).toHaveBeenCalledOnce(); expect(h.wire.at(-1)?.status).toBe(400);
    }
  });

  it.each(["challenge-digest", "challenge-extra", "proof-authority", "proof-binding", "proof-extra"])("fails closed on malformed RPC %s output", async (kind) => {
    const h = harness(); h.control.mutateRpcResult = (name, value) => {
      if (name === issueRpc && kind === "challenge-digest") value.challenge_bytes_digest = digest("wrong-digest");
      if (name === issueRpc && kind === "challenge-extra") value.owner_id = otherId;
      if (name === proofRpc && kind === "proof-authority") value.release_authorized = true;
      if (name === proofRpc && kind === "proof-binding") value.locator_record_id = otherId;
      if (name === proofRpc && kind === "proof-extra") value.private_detail = "must-not-escape";
    };
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.wire.at(-1)?.status).toBe(503);
    expect(h.wire.at(-1)?.responseBody.includes("must-not-escape")).toBe(false);
    expect(h.runtime.snapshot().release_authorized).toBe(false);
  });

  it("retains idempotency across an RPC error, then succeeds on an explicit retry", async () => {
    const h = harness(); h.control.failProofRpc = 1;
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.recorded.size).toBe(0);
    await expect(h.runtime.retryProof()).resolves.toEqual(success);
    expect(h.produce).toHaveBeenCalledOnce(); expect(h.recorded.size).toBe(1);
    const calls = h.rpc.mock.calls.filter(([name]) => name === proofRpc);
    expect(JSON.stringify(calls[0]) === JSON.stringify(calls[1])).toBe(true);
  });

  it("rechecks expiry after an otherwise valid API challenge", async () => {
    const h = harness(); h.control.afterChallengeResponse = () => { h.control.now = new Date(h.fixture.challenge.expires_at); };
    await expect(h.runtime.start(h.attempt)).rejects.toMatchObject(unavailable);
    expect(h.wire[0].status).toBe(200); expect(h.produce).not.toHaveBeenCalled();
    expect(h.recorded.size).toBe(0);
  });
});

const otherId = "40000000-0000-4000-8000-000000000099";
type Control = {
  dropProofResponses: number;
  failProofRpc: number;
  now: Date;
  proofRoute?: string;
  afterChallengeResponse?: () => void;
  afterProofResponse?: () => void;
  mutateRequest?: (body: Record<string, unknown>, headers: Headers, proof: boolean) => void;
  mutateRpcResult?: (name: string, result: Record<string, unknown>) => void;
};

function harness(options: { approved?: boolean; controllerApproved?: boolean; capability?: boolean;
  trustedSignals?: boolean; unavailableRecord?: boolean; rateLimited?: boolean } = {}) {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(),
    "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as {
      public_locator: OfflineCodeV2SyntheticAttempt["publicLocator"];
      synthetic_client_secret: OfflineCodeV2SyntheticAttempt["clientSecret"];
      kdf_profile: OfflineCodeV2SyntheticAttempt["kdfProfile"];
      record_binding: OfflineCodeV2SyntheticAttempt["recordBinding"];
      challenge: OfflineCodeChallengeV2; possession_proof: OfflineCodePossessionProofV2;
    };
  const attempt: OfflineCodeV2SyntheticAttempt = { syntheticOnly: true, publicLocator: fixture.public_locator,
    clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile, recordBinding: fixture.record_binding,
    challengeIdempotencyKey: "40000000-0000-4000-8000-000000000081",
    proofIdempotencyKey: "40000000-0000-4000-8000-000000000082" };
  const challenge = options.unavailableRecord ? { ...fixture.challenge, locator_record_id: otherId,
    locator_commitment: digest("unavailable-commitment"), record_binding_digest: digest("unavailable-binding") } : fixture.challenge;
  const bytes = Buffer.from(canonicalJson(challenge as never)).toString("base64url");
  const control: Control = { dropProofResponses: 0, failProofRpc: 0,
    now: new Date(Date.parse(fixture.challenge.issued_at) + 1_000) };
  // Fixture bookkeeping only: this does NOT implement or verify Postgres transactions, RLS, or rate limiting.
  const recorded = new Map<string, { input: string; result: Record<string, unknown> }>();
  const rpc = vi.fn(async (name: string, value: Record<string, unknown>) => {
    let data: Record<string, unknown>;
    if (name === issueRpc) {
      data = options.rateLimited ? { rate_limited: true, retry_after_seconds: 300,
        identity_verified: false, claim_created: false, release_authorized: false, replayed: false } : {
        rate_limited: false, challenge, challenge_bytes_base64url: bytes,
        challenge_bytes_digest: digest(Buffer.from(bytes, "base64url")), kdf_profile: fixture.kdf_profile,
        identity_verified: false, claim_created: false, release_authorized: false, replayed: false,
      };
    } else if (name === proofRpc) {
      if (control.failProofRpc-- > 0) return { data: null, error: { code: "synthetic-unavailable" } };
      const key = String(value.p_idempotency_key); const input = JSON.stringify(value);
      const prior = recorded.get(key);
      if (prior && prior.input !== input) return { data: null, error: { code: "synthetic-conflict" } };
      data = prior ? { ...prior.result, replayed: true } : {
        challenge_id: value.p_challenge_id, locator_record_id: value.p_locator_record_id,
        verification_outcome: value.p_verification_outcome, route_possession_asserted: value.p_verification_outcome === "verified",
        locator_locked: false, identity_verified: false, claim_created: false, release_authorized: false, replayed: false,
      };
      if (!prior) recorded.set(key, { input, result: structuredClone(data) });
    } else throw new Error("Unexpected RPC in synthetic acceptance.");
    const result = structuredClone(data); control.mutateRpcResult?.(name, result);
    return { data: result, error: null };
  });
  const createPersistence = vi.fn(() => createOfflineCodeV2PersistenceTransactionClient(rpc));
  const getConfig = vi.fn(() => ({ apiOrigin, claimantOrigin: fixture.challenge.origin,
    locatorIndexKey: digest("synthetic-locator-index-key"), rateLimitKey: digest("synthetic-rate-index-key"),
    serviceRoleKey: "unused-synthetic-service-role", supabaseUrl: "https://synthetic.supabase.test" }));
  const deps = { approved: options.controllerApproved ?? true, createPersistence, getConfig,
    getTrustedSignals: async () => options.trustedSignals === false ? null : { networkSignal: "synthetic-network", deviceSignal: "synthetic-device" },
    runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_OFFLINE_CODE_V2_ENABLED: options.capability === false ? "false" : "true" }) };
  const server = new Hono();
  server.post(challengePath, createOfflineCodeV2Controller("issueChallenge", deps));
  server.post(`${challengePath}/:challengeId/proofs`, createOfflineCodeV2Controller("verifyProof", deps));
  const wire: { body: string; headers: Headers; status: number; responseBody: string }[] = [];
  const send = vi.fn<typeof fetch>(async (url, init) => {
    const requested = new URL(String(url));
    if (requested.origin !== apiOrigin || requested.search || requested.hash || !requested.pathname.startsWith(challengePath))
      throw new Error("Non-fixture URL is prohibited.");
    const proof = requested.pathname.endsWith("/proofs");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const headers = new Headers(init?.headers); control.mutateRequest?.(body, headers, proof);
    const text = JSON.stringify(body);
    const response = await server.request(`${apiOrigin}${proof && control.proofRoute ? control.proofRoute : requested.pathname}`,
      { ...init, headers, body: text });
    wire.push({ body: text, headers, status: response.status, responseBody: await response.clone().text() });
    if (proof) {
      control.afterProofResponse?.();
      if (control.dropProofResponses-- > 0) throw new Error("Synthetic response loss after server handling.");
    } else control.afterChallengeResponse?.();
    return response;
  });
  let listener: (event: unknown) => void = () => undefined;
  const localProducer = createOfflineCodeV2PlatformProofProducer(true);
  const produce = vi.fn((value: OfflineCodeV2ProofInput) => localProducer.produce(value));
  const runtime = createOfflineCodeV2Lifecycle({ approved: options.approved ?? true,
    syntheticOnly: true, productionRuntime: false, apiOrigin, claimantOrigin: fixture.challenge.origin,
    send, producer: { produce }, now: () => control.now,
    lifecycle: { subscribe(callback) { listener = callback; callback({ sequence: 0, state: "foreground" }); return () => undefined; } } });
  disposals.push(() => runtime.dispose());
  return { fixture, attempt, runtime, control, rpc, recorded, createPersistence, getConfig, send, wire, produce, bytes,
    emit: (event: unknown) => listener(event) };
}
function digest(value: string | Buffer) { return createHash("sha256").update(value).digest("base64url"); }
