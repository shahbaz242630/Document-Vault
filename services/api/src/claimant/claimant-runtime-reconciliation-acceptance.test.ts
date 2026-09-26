/// <reference path="../../../../apps/mobile/src/types/libsodium-wrappers-sumo.d.ts" />

import { createHash, createPrivateKey, randomBytes, randomUUID, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, encodeOfflineCodeSheetV2, type OfflineCodeChallengeV2,
  type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClaimFlow, type ClaimFlowSnapshot } from "../../../../apps/mobile/src/features/claimant-journey/claim-flow";
import { createClaimSheetScan } from "../../../../apps/mobile/src/features/claimant-journey/claim-sheet-scan";
import { createClaimantRuntimeBootstrap } from "../../../../apps/mobile/src/features/claimant-journey/runtime-bootstrap";
import { createClaimantRuntimeFoundation } from "../../../../apps/mobile/src/features/claimant-journey/runtime-foundation";
import type { OfflineCodeV2SyntheticAttempt } from "../../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-coordinator";
import type { OfflineCodeV2ProofInput } from "../../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-proof-core";
import { createOfflineCodeV2PlatformProofProducer } from "../../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-proof-producer";
import type { OwnerOfflineCodeSheet } from "../../../../apps/mobile/src/features/claimant-offline-code/owner-offline-code-sheet-factory";
import { renderOwnerSheetHtml } from "../../../../apps/mobile/src/features/claimant-offline-code/owner-sheet-html";
import { createOfflineCodeV2Controller } from "./offline-code-v2-controller.js";
import { createOfflineCodeV2HandoffRoute } from "./offline-code-v2-handoff-routes.js";
import { createOfflineCodeV2HandoffTransactionClient } from "./offline-code-v2-handoff-transaction-client.js";
import { createOfflineCodeV2PersistenceTransactionClient } from "./offline-code-v2-persistence-transaction-client.js";
import { ClaimantPortalSessionError, type ClaimantPortalSessionClient } from "./portal-session-client.js";
import { createClaimantPortalSessionRoute } from "./portal-session-routes.js";
import { decodePrintedSheetQr } from "./printed-sheet-qr.fixtures.test.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

/*
 * Slice 6D: the real mobile claimant runtime (6A bootstrap -> 5Z foundation -> 5T/5S/5R/handoff) talks to the
 * actual mounted Hono portal-session, offline-code V2 and handoff routes. Only the database is replaced, by a
 * synthetic in-memory store. The store implements exactly the idempotency, replay, displacement and single-use
 * rules of the cited migrations; any divergence from that SQL is a defect in this store. It does NOT model
 * PostgreSQL locking, RLS, rate-limit windows or concurrent transactions.
 */

const fixture = JSON.parse(readFileSync(resolve(process.cwd(),
  "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as {
    public_locator: OfflineCodeV2SyntheticAttempt["publicLocator"];
    synthetic_client_secret: OfflineCodeV2SyntheticAttempt["clientSecret"];
    kdf_profile: OfflineCodeV2SyntheticAttempt["kdfProfile"];
    record_binding: OfflineCodeV2SyntheticAttempt["recordBinding"];
    challenge: OfflineCodeChallengeV2; possession_proof: OfflineCodePossessionProofV2;
    derivation: { proof_seed: string };
  };
const apiOrigin = "https://api.sanduqkin.test";
const claimantOrigin = fixture.challenge.origin;
const issuer = "https://identity.sanduqkin.test";
const start = Date.parse(fixture.challenge.issued_at) + 1_000;
const unavailable = { name: "ClaimantRuntimeFoundationUnavailableError",
  message: "Claimant runtime foundation is unavailable." };
const handoffPrivateKey = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"),
  Buffer.from(fixture.derivation.proof_seed, "base64url")]), format: "der", type: "pkcs8" });
const b64digest = (value: string | Buffer) => createHash("sha256").update(value).digest("base64url");
const uuid = () => randomUUID();
const denyNetwork = vi.fn(() => { throw new Error("External networking is prohibited in acceptance tests."); });
const disposals: (() => Promise<void>)[] = [];

type RpcResult = Promise<{ data: unknown; error: { code: string } | null }>;
class SqlError extends Error { constructor(readonly code: string) { super(code); } }

/** Timestamps as PostgreSQL renders timestamptz, with microseconds. */
function pgTime(ms: number, micros: number) {
  const iso = new Date(ms).toISOString().slice(0, 19);
  const fraction = String(ms % 1000).padStart(3, "0") + String(micros).padStart(3, "0");
  return { text: `${iso}.${fraction}+00:00`, epoch: Number(`${Math.floor(ms / 1000)}.${fraction}`) };
}

/** Mirrors jsonb::text: keys ordered by length then bytewise, with ", " and ": " separators. */
function jsonbText(value: Record<string, unknown>): string {
  const keys = Object.keys(value).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  return `{${keys.map((key) => `${JSON.stringify(key)}: ${JSON.stringify(value[key])}`).join(", ")}}`;
}

class SyntheticClaimantStore {
  readonly eligible = new Set<string>();
  readonly portalControls = new Map<string, { activeSessionId: string; status: "active" | "revoked";
    version: number; authenticatedAt: number }>();
  readonly portalEvents: { type: string; userId: string; sessionId: string }[] = [];
  readonly idempotency = new Map<string, { digest: string; result: Record<string, unknown> }>();
  readonly challenges = new Map<string, { challenge: OfflineCodeChallengeV2; status: "issued" | "verified" | "failed" | "expired";
    terminalAt: number | null }>();
  readonly proofFacts: string[] = [];
  readonly handoffs = new Map<string, { id: string; userId: string; sessionId: string; sessionVersion: number;
    sourceChallengeId: string; caseId: string; issueKey: string; transcript: string; transcriptDigest: string;
    expiresAt: { text: string; epoch: number }; consumeKey?: string; signatureDigest?: string;
    result?: Record<string, unknown> }>();
  readonly cases = new Map<string, string>();
  private micros = 101;

  constructor(private readonly now: () => number) {}

  private clock() { this.micros = (this.micros + 37) % 1000; return pgTime(this.now(), this.micros); }

  private replay(operation: string, scope: string, key: string, digest: string) {
    const prior = this.idempotency.get(`${operation}|${scope}|${key}`);
    if (!prior) return null;
    if (prior.digest !== digest) throw new SqlError("22023");
    return { ...prior.result, replayed: true };
  }

  private remember(operation: string, scope: string, key: string, digest: string, result: Record<string, unknown>) {
    const { replayed: _ignored, ...stored } = result;
    this.idempotency.set(`${operation}|${scope}|${key}`, { digest, result: structuredClone(stored) });
  }

  // 20260804210000_claimant_portal_session_boundary.sql — claimant_activate_portal_session
  activate(userId: string, sessionId: string, authenticatedAt: string, key: string) {
    if (!this.eligible.has(userId)) throw new SqlError("42501");
    const authMs = Date.parse(authenticatedAt);
    if (authMs < this.now() - 600_000 || authMs > this.now() + 60_000) throw new SqlError("28000");
    const digest = [userId, sessionId, authenticatedAt, "1"].join("|");
    const replayed = this.replay("activate_claimant_portal_session", userId, key, digest);
    if (replayed) return replayed;
    const control = this.portalControls.get(userId);
    const displaced = control?.status === "active" && control.activeSessionId !== sessionId;
    const version = (control?.version ?? 0) + 1;
    this.portalControls.set(userId, { activeSessionId: sessionId, status: "active", version, authenticatedAt: authMs });
    this.portalEvents.push({ type: displaced ? "portal_session_displaced" : "portal_session_activated", userId, sessionId });
    const result = { context: "claimant_portal", session_version: version, displaced_previous: displaced, replayed: false };
    this.remember("activate_claimant_portal_session", userId, key, digest, result);
    return result;
  }

  // claimant_assert_portal_session
  assert(userId: string, sessionId: string) {
    if (!this.eligible.has(userId)) throw new SqlError("42501");
    const control = this.portalControls.get(userId);
    if (!control || control.status !== "active" || control.activeSessionId !== sessionId) throw new SqlError("28000");
    return { context: "claimant_portal", session_version: control.version };
  }

  // claimant_revoke_portal_session
  revoke(userId: string, sessionId: string, key: string) {
    const digest = `${userId}|${sessionId}`;
    const replayed = this.replay("revoke_claimant_portal_session", userId, key, digest);
    if (replayed) return replayed;
    const control = this.portalControls.get(userId);
    if (!control || control.activeSessionId !== sessionId || control.status !== "active") throw new SqlError("28000");
    control.status = "revoked"; control.version += 1;
    this.portalEvents.push({ type: "portal_session_revoked", userId, sessionId });
    const result = { context: "claimant_portal", session_version: control.version, revoked: true, replayed: false };
    this.remember("revoke_claimant_portal_session", userId, key, digest, result);
    return result;
  }

  // 20260819084008_offline_code_v2_enumeration_resistant_challenges.sql — claimant_issue_offline_code_v2_challenge
  issueChallenge(value: Record<string, unknown>) {
    const key = String(value.p_idempotency_key);
    const digest = JSON.stringify([value.p_locator_index_digest, value.p_network_bucket_digest,
      value.p_device_bucket_digest, value.p_global_bucket_digest, value.p_origin]);
    const replayed = this.replay("issue_challenge", "locator", key, digest);
    if (replayed) return replayed;
    for (const entry of this.challenges.values()) if (entry.status === "issued") { entry.status = "expired"; entry.terminalAt = this.now(); }
    const first = this.challenges.size === 0;
    const challenge: OfflineCodeChallengeV2 = first ? fixture.challenge : { ...fixture.challenge,
      challenge_id: uuid(), nonce: randomBytes(32).toString("base64url"),
      issued_at: new Date(this.now()).toISOString(), expires_at: new Date(this.now() + 300_000).toISOString() };
    this.challenges.set(challenge.challenge_id, { challenge, status: "issued", terminalAt: null });
    const bytes = Buffer.from(canonicalJson(challenge as never)).toString("base64url");
    const result = { rate_limited: false, challenge, challenge_bytes_base64url: bytes,
      challenge_bytes_digest: b64digest(Buffer.from(bytes, "base64url")), kdf_profile: fixture.kdf_profile,
      identity_verified: false, claim_created: false, release_authorized: false, replayed: false };
    this.remember("issue_challenge", "locator", key, digest, result);
    return result;
  }

  // 20260819080343_claimant_offline_code_v2_persistence.sql — claimant_record_offline_code_v2_attempt
  recordAttempt(value: Record<string, unknown>) {
    const key = String(value.p_idempotency_key); const challengeId = String(value.p_challenge_id);
    const digest = JSON.stringify(value);
    const replayed = this.replay("record_attempt", challengeId, key, digest);
    if (replayed) return replayed;
    const entry = this.challenges.get(challengeId);
    if (!entry || entry.status !== "issued" || Date.parse(entry.challenge.expires_at) <= this.now()) throw new SqlError("40001");
    const verified = value.p_verification_outcome === "verified";
    entry.status = verified ? "verified" : "failed"; entry.terminalAt = this.now();
    if (verified) this.proofFacts.push(challengeId);
    const result = { challenge_id: challengeId, locator_record_id: value.p_locator_record_id,
      verification_outcome: value.p_verification_outcome, route_possession_asserted: verified, locator_locked: false,
      identity_verified: false, claim_created: false, release_authorized: false, replayed: false };
    this.remember("record_attempt", challengeId, key, digest, result);
    return result;
  }

  // 20260903075258_claimant_offline_code_v2_authenticated_handoff.sql — claimant_offline_code_v2_handoff
  handoff(value: Record<string, unknown>) {
    const action = String(value.p_action); const userId = String(value.p_claimant_user_id);
    const sessionId = String(value.p_portal_session_id); const requestId = String(value.p_request_id);
    const key = String(value.p_idempotency_key);
    const control = this.portalControls.get(userId);
    if (!control || control.status !== "active" || control.activeSessionId !== sessionId
      || control.authenticatedAt < this.now() - 600_000 || control.authenticatedAt > this.now() + 60_000
      || !this.eligible.has(userId)) throw new SqlError("28000");
    let handoff = action === "issue" ? undefined : [...this.handoffs.values()].find((entry) =>
      entry.id === requestId && entry.userId === userId && entry.sessionId === sessionId);
    const source = action === "issue" ? requestId : handoff?.sourceChallengeId;
    const proof = source ? this.challenges.get(source) : undefined;
    if (!proof || proof.status !== "verified" || proof.terminalAt === null
      || proof.terminalAt < this.now() - 300_000 || proof.terminalAt > this.now() + 60_000) throw new SqlError("42501");
    const locator = proof.challenge.locator_record_id;
    if (action === "issue") {
      handoff = [...this.handoffs.values()].find((entry) => entry.userId === userId && entry.issueKey === key);
      if (handoff) {
        if (handoff.sourceChallengeId !== requestId || handoff.sessionId !== sessionId) throw new SqlError("22023");
      } else {
        const recent = [...this.handoffs.values()].filter((entry) => entry.userId === userId).length;
        if (this.cases.has(locator) || recent >= 5) throw new SqlError("42501");
        if ([...this.handoffs.values()].some((entry) => entry.sourceChallengeId === requestId
          && entry.userId === userId && entry.sessionId === sessionId)) throw new SqlError("40001");
        const expiresAt = this.clock();
        const expiryMs = Math.min(this.now() + 120_000, proof.terminalAt + 300_000, control.authenticatedAt + 600_000);
        Object.assign(expiresAt, pgTime(expiryMs, Number(expiresAt.text.slice(23, 26))));
        const id = uuid(); const caseId = uuid();
        const transcript = jsonbText({ protocol: "sanduqkin:claim:offline-code:v2", purpose: "authenticated_case_handoff",
          label: "sanduqkin:claim:offline-code:v2:authenticated-handoff:v1", handoff_id: id, case_id: caseId,
          claimant_user_id: userId, portal_session_id: sessionId, portal_session_version: control.version,
          source_challenge_id: requestId, record_binding_digest: proof.challenge.record_binding_digest,
          expires_at_epoch: expiresAt.epoch, nonce: randomBytes(32).toString("hex") });
        handoff = { id, userId, sessionId, sessionVersion: control.version, sourceChallengeId: requestId, caseId,
          issueKey: key, transcript, transcriptDigest: b64digest(Buffer.from(transcript, "utf8")), expiresAt };
        this.handoffs.set(id, handoff);
      }
    }
    if (!handoff || handoff.userId !== userId || handoff.sessionId !== sessionId
      || handoff.sessionVersion !== control.version || handoff.expiresAt.epoch * 1000 <= this.now()) throw new SqlError("42501");
    if (action === "consume") {
      if (value.p_verified_transcript_digest !== handoff.transcriptDigest) throw new SqlError("42501");
      if (handoff.result) {
        if (handoff.consumeKey !== key || handoff.signatureDigest !== value.p_signature_digest) throw new SqlError("22023");
        return { ...handoff.result, replayed: true };
      }
      if (this.cases.has(locator)) throw new SqlError("42501");
      this.cases.set(locator, handoff.caseId);
      handoff.consumeKey = key; handoff.signatureDigest = String(value.p_signature_digest);
      handoff.result = { case_id: handoff.caseId, case_version: 1, state: "draft", route_profile: "offline_code_v2",
        authority: "route_possession_only", claimant_session_bound: true, case_created: true, identity_verified: false,
        relationship_verified: false, intake_started: false, review_started: false, release_authorized: false };
      return { ...handoff.result, replayed: false };
    }
    return { handoff_id: handoff.id, case_id: handoff.caseId, claimant_user_id: userId, portal_session_id: sessionId,
      portal_session_version: control.version, source_challenge_id: handoff.sourceChallengeId,
      proof_public_key: proof.challenge.proof_public_key, expires_at: handoff.expiresAt.text,
      transcript_bytes_base64url: Buffer.from(handoff.transcript, "utf8").toString("base64url"),
      transcript_digest: handoff.transcriptDigest, authority: "route_possession_only", identity_verified: false,
      claim_created: false, release_authorized: false, synthetic_only: true };
  }

  async rpc(name: string, value: Record<string, unknown>): RpcResult {
    try {
      const data = name === "claimant_issue_offline_code_v2_challenge" ? this.issueChallenge(value)
        : name === "claimant_record_offline_code_v2_attempt" ? this.recordAttempt(value)
          : name === "claimant_offline_code_v2_handoff" ? this.handoff(value) : null;
      if (!data) throw new Error(`Unexpected RPC ${name}`);
      return { data: structuredClone(data), error: null };
    } catch (error) {
      if (error instanceof SqlError) return { data: null, error: { code: error.code } };
      throw error;
    }
  }
}

type Identity = Readonly<{ userId: string; sessionId: string; accessToken: string }>;
type Loss = Readonly<{ path: string; times?: number }>;

function server(store: SyntheticClaimantStore, identities: Map<string, Identity>, now: () => number) {
  const session = (jwt: string) => {
    const identity = identities.get(jwt);
    if (!identity) throw new Error("Unauthorized");
    const seconds = Math.floor(now() / 1000);
    return { userId: identity.userId, sessionId: identity.sessionId, aal: "aal2" as const, issuedAt: seconds - 30,
      expiresAt: seconds + 600, amr: [{ method: "totp", timestamp: seconds }] };
  };
  const call = async <T>(operation: () => T) => {
    try { return operation(); } catch (error) {
      if (error instanceof SqlError) throw new ClaimantPortalSessionError({ code: error.code });
      throw error;
    }
  };
  const decode = (value: Record<string, unknown>) => ({ context: "claimant_portal" as const,
    sessionVersion: Number(value.session_version),
    ...(value.displaced_previous === undefined ? {} : { displacedPrevious: Boolean(value.displaced_previous) }),
    ...(value.replayed === undefined ? {} : { replayed: Boolean(value.replayed) }),
    ...(value.revoked === undefined ? {} : { revoked: Boolean(value.revoked) }) });
  const portalClient: ClaimantPortalSessionClient = {
    getSession: async (jwt) => session(jwt),
    activate: async (input) => decode(await call(() => store.activate(input.userId, input.sessionId,
      input.authenticatedAt, input.idempotencyKey))),
    assert: async (userId, sessionId) => decode(await call(() => store.assert(userId, sessionId))),
    revoke: async (input) => decode(await call(() => store.revoke(input.userId, input.sessionId, input.idempotencyKey))),
  };
  const runtimeConfig = getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
    CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true" });
  const rpc = vi.fn((name: string, value: Record<string, unknown>) => store.rpc(name, value));
  const supabase = { supabaseUrl: "https://synthetic.supabase.test", serviceRoleKey: "unused-synthetic-service-role" };
  const app = new Hono();
  for (const action of ["activate", "assert", "revoke"] as const)
    app.post(`/claimant/portal/session/${action}`, createClaimantPortalSessionRoute(action, { runtimeConfig,
      createClient: () => portalClient, getConfig: () => ({ ...supabase, allowedOrigins: [claimantOrigin],
        freshAssuranceSeconds: 600 }) }));
  const offlineDeps = { approved: true, runtimeConfig,
    createPersistence: () => createOfflineCodeV2PersistenceTransactionClient(rpc),
    getConfig: () => ({ ...supabase, apiOrigin, claimantOrigin, locatorIndexKey: b64digest("synthetic-locator-index-key"),
      rateLimitKey: b64digest("synthetic-rate-index-key") }),
    getTrustedSignals: async () => ({ networkSignal: "synthetic-network", deviceSignal: "synthetic-device" }) };
  app.post("/claimant/offline-code/v2/challenges", createOfflineCodeV2Controller("issueChallenge", offlineDeps));
  app.post("/claimant/offline-code/v2/challenges/:challengeId/proofs", createOfflineCodeV2Controller("verifyProof", offlineDeps));
  const handoffDeps = { approved: true, now, runtimeConfig, getConfig: () => ({ ...supabase, apiOrigin, claimantOrigin }),
    createPortalClient: () => portalClient, createTransactionClient: () => createOfflineCodeV2HandoffTransactionClient(rpc) };
  app.post("/claimant/offline-code/v2/handoffs/issue", createOfflineCodeV2HandoffRoute("issue", handoffDeps));
  app.post("/claimant/offline-code/v2/handoffs/complete", createOfflineCodeV2HandoffRoute("complete", handoffDeps));
  return { app, rpc };
}

function world() {
  const store = new SyntheticClaimantStore(() => Date.now());
  const identities = new Map<string, Identity>();
  const { app, rpc } = server(store, identities, () => Date.now());
  const wire: { path: string; status: number; body: string; key: string | null }[] = [];
  const losses: Loss[] = [];
  const send = async (url: string | URL | Request, init?: RequestInit) => {
    const requested = new URL(String(url));
    if (requested.origin !== apiOrigin) throw new Error("Non-fixture URL is prohibited.");
    const response = await app.request(String(url), init);
    wire.push({ path: requested.pathname, status: response.status, body: String(init?.body ?? ""),
      key: new Headers(init?.headers).get("idempotency-key") });
    const loss = losses.find((entry) => requested.pathname.endsWith(entry.path) && (entry.times ?? 1) > 0);
    if (loss && response.status === 200) {
      Object.assign(loss, { times: (loss.times ?? 1) - 1 }); await response.body?.cancel();
      throw new TypeError("synthetic lost response after server commit");
    }
    return response;
  };
  const signIn = (userId: string) => {
    const identity = { userId, sessionId: uuid(), accessToken: `synthetic-access-token-${uuid()}` };
    identities.set(identity.accessToken, identity); store.eligible.add(userId);
    return identity;
  };
  return { store, rpc, wire, losses, send, signIn, app };
}

type World = ReturnType<typeof world>;

function device(w: World, identity: Identity) {
  const lifecycle = new Set<(value: unknown) => void>();
  const signClaimantHandoffAsync = vi.fn(async (input: { transcript_bytes_base64url: string; key_alias_reference: string }) => ({
    synthetic_only: true as const, status: "signed" as const,
    signature: sign(null, Buffer.from(input.transcript_bytes_base64url, "base64url"), handoffPrivateKey).toString("base64url"),
    key_alias_reference: input.key_alias_reference, key_fingerprint: "B".repeat(43),
    user_presence: "verified" as const, private_key_exportable: false as const }));
  const localProducer = createOfflineCodeV2PlatformProofProducer(true);
  const produce = vi.fn((value: OfflineCodeV2ProofInput) => localProducer.produce(value));
  const authenticated = Object.freeze({ syntheticOnly: true as const, status: "authenticated" as const,
    userId: identity.userId, sessionId: identity.sessionId, accessToken: identity.accessToken, aal: "aal2" as const,
    recovery: false as const, expiresAt: Date.now() + 600_000, assuredAt: Date.now(), issuer,
    audience: "authenticated" as const });
  let runtime: ReturnType<typeof createClaimantRuntimeFoundation> | null = null;
  const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true, killSwitchEngaged: false,
    createRuntime: (input) => (runtime = createClaimantRuntimeFoundation(input)),
    runtime: { syntheticOnly: true, productionRuntime: false,
      identity: { expectedIssuer: issuer, now: () => Date.now(), provider: { syntheticOnly: true,
        subscribe(listener) { listener(authenticated); return () => undefined; } } },
      signing: { keyAliasReference: "claimant-handoff.test.v1.synthetic_key_001", keyFingerprint: "B".repeat(43),
        native: { syntheticOnly: true, signClaimantHandoffAsync } },
      journey: { now: () => Date.now(), lifecycle: { subscribe(listener) { lifecycle.add(listener);
        listener({ sequence: 0, state: "foreground" }); return () => { lifecycle.delete(listener); }; } },
      portal: { apiOrigin, claimantOrigin, send: w.send as never },
      bridge: { apiOrigin, claimantOrigin, possessionSend: w.send as never, handoffSend: w.send as never,
        producer: { produce } } } } });
  if (!runtime) throw new Error("synthetic runtime was not constructed");
  const attempt = { possession: { syntheticOnly: true as const, publicLocator: fixture.public_locator,
    clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile, recordBinding: fixture.record_binding,
    challengeIdempotencyKey: uuid(), proofIdempotencyKey: uuid() }, issueIdempotencyKey: uuid(), completionIdempotencyKey: uuid() };
  const r = runtime as ReturnType<typeof createClaimantRuntimeFoundation>;
  disposals.push(() => bootstrap.dispose());
  return { bootstrap, runtime: r, attempt, produce, signClaimantHandoffAsync,
    start: () => r.start({ attempt, sessionAssertionIdempotencyKey: uuid() }) };
}

const draft = { state: "draft", route_profile: "offline_code_v2", case_version: 1, claimant_session_bound: true,
  case_created: true, identity_verified: false, relationship_verified: false, intake_started: false,
  review_started: false, release_authorized: false };
const replayedOn = (w: World, path: string) => w.wire.filter((entry) => entry.path.endsWith(path) && entry.status === 200);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(start);
  denyNetwork.mockClear(); vi.stubGlobal("fetch", denyNetwork);
});
afterEach(async () => {
  try {
    await Promise.all(disposals.splice(0).map((dispose) => dispose()));
    expect(denyNetwork).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
});

describe("claimant mobile-to-API reconciliation acceptance", () => {
  it("drives the real runtime through the actual routes to exactly one case, then revokes", async () => {
    const w = world(); const d = device(w, w.signIn(uuid()));
    await d.runtime.activatePortal(uuid());
    await expect(d.start()).resolves.toEqual(draft);
    expect(w.wire.map((entry) => [entry.path.split("/").slice(-1)[0], entry.status])).toEqual([
      ["activate", 200], ["assert", 200], ["challenges", 200], ["proofs", 200], ["issue", 200], ["complete", 200]]);
    expect(w.store.proofFacts).toHaveLength(1); expect(w.store.handoffs.size).toBe(1); expect(w.store.cases.size).toBe(1);
    expect(d.produce).toHaveBeenCalledOnce(); expect(d.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    expect(d.runtime.snapshot()).toMatchObject({ status: "draft", draft_available: true, release_authorized: false });
    await expect(d.runtime.revokePortal(uuid())).resolves.toBeUndefined();
    expect(w.store.portalEvents.at(-1)?.type).toBe("portal_session_revoked");
    expect(d.runtime.snapshot().status).toBe("closed");
  });

  describe("lost committed response, then exact retry", () => {
    it("portal activation replays the server's result and records one activation", async () => {
      const w = world(); const identity = w.signIn(uuid()); const d = device(w, identity);
      w.losses.push({ path: "/activate" });
      await expect(d.runtime.activatePortal(uuid())).rejects.toMatchObject(unavailable);
      expect(w.store.portalEvents).toHaveLength(1);
      await expect(d.runtime.retryActivation()).resolves.toBeUndefined();
      const [first, second] = replayedOn(w, "/activate");
      expect(second.key).toBe(first.key); expect(second.body).toBe(first.body);
      expect(w.store.portalEvents).toHaveLength(1); expect(w.store.portalControls.get(identity.userId)?.version).toBe(1);
      await expect(d.start()).resolves.toEqual(draft);
    });

    it("proof submission replays without a second proof fact, derivation or signature", async () => {
      const w = world(); const d = device(w, w.signIn(uuid()));
      await d.runtime.activatePortal(uuid()); w.losses.push({ path: "/proofs" });
      await expect(d.start()).rejects.toMatchObject(unavailable);
      expect(w.store.proofFacts).toHaveLength(1);
      await expect(d.runtime.retryProof(uuid())).resolves.toEqual(draft);
      const [first, second] = replayedOn(w, "/proofs");
      expect(second.key).toBe(first.key); expect(second.body).toBe(first.body);
      expect(w.store.proofFacts).toHaveLength(1); expect(w.store.cases.size).toBe(1);
      expect(d.produce).toHaveBeenCalledOnce(); expect(d.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    });

    it("handoff completion replays the committed case without signing twice", async () => {
      const w = world(); const d = device(w, w.signIn(uuid()));
      await d.runtime.activatePortal(uuid()); w.losses.push({ path: "/complete" });
      await expect(d.start()).rejects.toMatchObject(unavailable);
      expect(w.store.cases.size).toBe(1);
      await expect(d.runtime.retryCompletion(uuid())).resolves.toEqual(draft);
      const [first, second] = replayedOn(w, "/complete");
      expect(second.key).toBe(first.key); expect(second.body).toBe(first.body);
      expect(w.store.cases.size).toBe(1); expect(w.store.handoffs.size).toBe(1);
      expect(d.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    });

    it("portal revoke replays the recorded revocation and closes the device", async () => {
      const w = world(); const identity = w.signIn(uuid()); const d = device(w, identity);
      await d.runtime.activatePortal(uuid()); w.losses.push({ path: "/revoke" });
      await expect(d.runtime.revokePortal(uuid())).rejects.toMatchObject(unavailable);
      expect(w.store.portalControls.get(identity.userId)?.status).toBe("revoked");
      await expect(d.runtime.retryRevoke()).resolves.toBeUndefined();
      const [first, second] = replayedOn(w, "/revoke");
      expect(second.key).toBe(first.key);
      expect(w.store.portalEvents.filter((event) => event.type === "portal_session_revoked")).toHaveLength(1);
      expect(w.store.portalControls.get(identity.userId)?.version).toBe(2);
      expect(d.runtime.snapshot().status).toBe("closed");
    });
  });

  describe("lost committed response, then kill switch or background", () => {
    it.each(["kill switch", "background"])("%s drops device retry authority while the server keeps its record", async (fault) => {
      const w = world(); const d = device(w, w.signIn(uuid()));
      await d.runtime.activatePortal(uuid()); w.losses.push({ path: "/complete" });
      await expect(d.start()).rejects.toMatchObject(unavailable);
      if (fault === "kill switch") d.bootstrap.engageKillSwitch(); else d.bootstrap.handleAppState("background");
      const before = w.wire.length;
      await expect(d.runtime.retryCompletion(uuid())).rejects.toMatchObject(unavailable);
      await expect(d.runtime.retryActivation()).rejects.toMatchObject(unavailable);
      await expect(d.start()).rejects.toMatchObject(unavailable);
      expect(w.wire).toHaveLength(before);
      expect(w.store.cases.size).toBe(1); expect(w.store.handoffs.size).toBe(1);
      expect(d.runtime.snapshot()).toMatchObject({ status: "closed", draft_available: false, release_authorized: false });
      expect(d.bootstrap.snapshot()).toMatchObject({ status: "closed", kill_switch_engaged: true });
    });
  });

  describe("restart after an ambiguous commit", () => {
    it("a restarted device cannot bind a second case after a committed completion was lost", async () => {
      const w = world(); const identity = w.signIn(uuid()); const first = device(w, identity);
      await first.runtime.activatePortal(uuid()); w.losses.push({ path: "/complete" });
      await expect(first.start()).rejects.toMatchObject(unavailable);
      await first.bootstrap.dispose();
      const restarted = device(w, identity);
      await restarted.runtime.activatePortal(uuid());
      expect(w.store.portalControls.get(identity.userId)?.version).toBe(2);
      await expect(restarted.start()).rejects.toMatchObject(unavailable);
      expect(w.wire.at(-1)).toMatchObject({ path: "/claimant/offline-code/v2/handoffs/issue" });
      expect(w.wire.at(-1)?.status).not.toBe(200);
      expect(w.store.cases.size).toBe(1); expect(w.store.proofFacts).toHaveLength(2);
      expect(restarted.signClaimantHandoffAsync).not.toHaveBeenCalled();
      expect(restarted.runtime.snapshot()).toMatchObject({ draft_available: false, release_authorized: false });
    });

    it("a restarted device recovers normally when the lost commit was only a handoff issue", async () => {
      const w = world(); const identity = w.signIn(uuid()); const first = device(w, identity);
      await first.runtime.activatePortal(uuid()); w.losses.push({ path: "/issue" });
      await expect(first.start()).rejects.toMatchObject(unavailable);
      expect(w.store.handoffs.size).toBe(1); expect(w.store.cases.size).toBe(0);
      await first.bootstrap.dispose();
      const restarted = device(w, identity);
      await restarted.runtime.activatePortal(uuid());
      await expect(restarted.start()).resolves.toEqual(draft);
      expect(w.store.handoffs.size).toBe(2); expect(w.store.cases.size).toBe(1);
      expect(restarted.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    });

    it("a new sign-in displaces the stale portal session, which can no longer assert", async () => {
      const w = world(); const userId = uuid(); const stale = w.signIn(userId); const first = device(w, stale);
      await first.runtime.activatePortal(uuid());
      await first.bootstrap.dispose();
      const fresh = w.signIn(userId); const restarted = device(w, fresh);
      await restarted.runtime.activatePortal(uuid());
      expect(w.store.portalEvents.map((event) => event.type)).toEqual(["portal_session_activated", "portal_session_displaced"]);
      const staleAssert = await w.app.request(`${apiOrigin}/claimant/portal/session/assert`, { method: "POST",
        headers: { Authorization: `Bearer ${stale.accessToken}`, Origin: claimantOrigin, "Content-Type": "application/json",
          "Idempotency-Key": uuid() }, body: "{}" });
      expect(staleAssert.status).toBe(401);
      await expect(restarted.start()).resolves.toEqual(draft);
    });
  });

  it.each(["activate", "revoke"] as const)("rejects a reused %s key with a different request as a conflict", async (action) => {
    const w = world(); const userId = uuid(); const one = w.signIn(userId); const two = w.signIn(userId);
    const request = (path: string, identity: Identity, idempotencyKey: string) => w.app.request(
      `${apiOrigin}/claimant/portal/session/${path}`, { method: "POST", headers: { Authorization: `Bearer ${identity.accessToken}`,
        Origin: claimantOrigin, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: "{}" });
    const key = uuid();
    if (action === "activate") {
      expect((await request("activate", one, key)).status).toBe(200);
    } else {
      expect((await request("activate", one, uuid())).status).toBe(200);
      expect((await request("revoke", one, key)).status).toBe(200);
      expect((await request("activate", two, uuid())).status).toBe(200);
    }
    const events = w.store.portalEvents.length;
    const conflict = await request(action, two, key);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "Request conflict" });
    expect(w.store.portalEvents).toHaveLength(events);
  });

  it("sends nothing to the API from any entry point after the kill switch", async () => {
    const w = world(); const d = device(w, w.signIn(uuid()));
    d.bootstrap.engageKillSwitch();
    for (const operation of [() => d.runtime.activatePortal(uuid()), () => d.runtime.retryActivation(), () => d.start(),
      () => d.runtime.retryProof(uuid()), () => d.runtime.retryCompletion(uuid()), () => d.runtime.revokePortal(uuid()),
      () => d.runtime.retryRevoke()]) await expect(operation()).rejects.toMatchObject(unavailable);
    expect(w.wire).toHaveLength(0); expect(w.rpc).not.toHaveBeenCalled();
    expect(d.produce).not.toHaveBeenCalled(); expect(d.signClaimantHandoffAsync).not.toHaveBeenCalled();
  });
});

describe("Slice 6I printed sheet scanned into the claim screen's flow", () => {
  it("reads the printed QR code with the camera handler and starts exactly one claim through the actual routes", async () => {
    const w = world(); const d = device(w, w.signIn(uuid()));
    const printedSheet = { sheetPayload: encodeOfflineCodeSheetV2({ publicLocator: fixture.public_locator,
      clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile,
      recordBinding: fixture.record_binding }), printedLocator: fixture.public_locator.locator,
    printedSecret: fixture.synthetic_client_secret.secret, expiresAt: new Date(start + 86_400_000).toISOString(),
    registration: {} as OwnerOfflineCodeSheet["registration"] } as OwnerOfflineCodeSheet;
    const html = renderOwnerSheetHtml(printedSheet);

    const flow = createClaimFlow({ handle: d.bootstrap.claimFlowRuntime(), newKey: uuid });
    const seen: ClaimFlowSnapshot[] = [];
    flow.subscribe((snapshot) => { seen.push(snapshot); });
    const submitted: Promise<void>[] = [];
    const scan = createClaimSheetScan((text) => { submitted.push(flow.submit(text)); });
    const decoded = decodePrintedSheetQr(html);
    for (let frame = 0; frame < 3; frame += 1) scan.onScan({ type: "qr", data: decoded });
    await Promise.all(submitted);

    expect(submitted).toHaveLength(1);
    expect(seen.map((snapshot) => snapshot.status)).toEqual(["checking", "claim_started"]);
    expect(w.wire.map((entry) => [entry.path.split("/").slice(-1)[0], entry.status])).toEqual([
      ["activate", 200], ["assert", 200], ["challenges", 200], ["proofs", 200], ["issue", 200], ["complete", 200]]);
    expect(w.store.cases.size).toBe(1); expect(d.signClaimantHandoffAsync).toHaveBeenCalledOnce();
    const secret = fixture.synthetic_client_secret.secret;
    expect(JSON.stringify(seen)).not.toContain(secret);
    expect(w.wire.some((entry) => entry.body.includes(secret) || entry.body.includes(decoded))).toBe(false);
  });
});
