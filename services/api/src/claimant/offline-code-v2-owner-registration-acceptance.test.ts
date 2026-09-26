/// <reference path="../../../../apps/mobile/src/types/libsodium-wrappers-sumo.d.ts" />

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { canonicalJson, parseOfflineCodeSheetV2, type OfflineCodeChallengeV2 } from "@vault/shared-types";
import { Hono } from "hono";
import sodium from "libsodium-wrappers-sumo";
import { describe, expect, it, vi } from "vitest";

import { createClaimSheetScan } from "../../../../apps/mobile/src/features/claimant-journey/claim-sheet-scan";
import { createOfflineCodeV2PlatformProofProducer } from "../../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-proof-producer";
import { generateOfflineCodeV2EmergencySheet, type OfflineCodeV2SheetCrypto }
  from "../../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-sheet-generator";
import { createOwnerOfflineCodeClient }
  from "../../../../apps/mobile/src/features/claimant-offline-code/owner-offline-code-client";
import { createOwnerOfflineCodeSheet, type OwnerOfflineCodeSheet }
  from "../../../../apps/mobile/src/features/claimant-offline-code/owner-offline-code-sheet-factory";
import { createOwnerSheetFlow } from "../../../../apps/mobile/src/features/claimant-offline-code/owner-sheet-flow";
import { createOwnerSheetListFlow }
  from "../../../../apps/mobile/src/features/claimant-offline-code/owner-sheet-list-flow";
import { renderOwnerSheetHtml } from "../../../../apps/mobile/src/features/claimant-offline-code/owner-sheet-html";
import { createOfflineCodeV2Controller } from "./offline-code-v2-controller.js";
import { createOfflineCodeV2OwnerListRoute, createOfflineCodeV2OwnerRoute } from "./offline-code-v2-owner-routes.js";
import { createOfflineCodeV2OwnerSheetReader, createOfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";
import { decodePrintedSheetQr } from "./printed-sheet-qr.fixtures.test.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

/*
 * Slice 6G acceptance: the 6F owner generator's sheet is registered through the owner route, then the actual
 * claimant challenge route finds it with the printed locator and the claimant proof producer's proof verifies.
 * Only the database is replaced, by an in-memory store that follows the register, revoke, issue and attempt
 * rules of 20260819080343_claimant_offline_code_v2_persistence.sql and
 * 20260819084008_offline_code_v2_enumeration_resistant_challenges.sql. Any divergence from that SQL is a defect
 * in this store. It does not model PostgreSQL locking, RLS, rate limits or the auth.users foreign key.
 */

const apiOrigin = "https://api.sanduqkin.test";
const ownerOrigin = "https://owner.sanduqkin.test";
const claimantOrigin = "https://claimant.sanduqkin.test";
const b64digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("base64url");
const locatorIndexKey = b64digest("synthetic-6g-locator-index-key");
const b32 = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;

class SqlError extends Error { constructor(readonly code: string) { super(code); } }

type Locator = { id: string; ownerUserId: string; indexDigest: string; commitment: string; grantId: string;
  proofPublicKey: string; recordBindingDigest: string; kdfSalt: string; status: "active" | "revoked";
  issuedAt: number; expiresAt: number; revokedAt: number | null };

class SyntheticOfflineCodeStore {
  readonly locators = new Map<string, Locator>();
  readonly challenges = new Map<string, { challenge: OfflineCodeChallengeV2; status: string }>();
  private readonly idempotency = new Map<string, { digest: string; result: Record<string, unknown> }>();

  private replay(operation: string, scope: string, key: string, digest: string) {
    const existing = this.idempotency.get(`${operation}|${scope}|${key}`);
    if (!existing) return null;
    if (existing.digest !== digest) throw new SqlError("22023");
    return { ...existing.result, replayed: true };
  }
  private remember(operation: string, scope: string, key: string, digest: string, result: Record<string, unknown>) {
    this.idempotency.set(`${operation}|${scope}|${key}`, { digest, result });
  }

  // claimant_register_offline_code_v2_locator (20260819084008 redefinition)
  register(value: Record<string, unknown>) {
    const text = (name: string) => String(value[name]);
    const issuedAt = Date.parse(text("p_issued_at")); const expiresAt = Date.parse(text("p_expires_at"));
    if (["p_locator_index_digest", "p_locator_commitment", "p_proof_public_key", "p_record_binding_digest",
      "p_wrap_associated_data_digest"].some((name) => !b32.test(text(name)))
      || !/^[A-Za-z0-9_-]{21}[AQgw]$/u.test(text("p_kdf_salt")) || !/^[A-Za-z0-9_-]{32}$/u.test(text("p_wrap_nonce"))
      || !/^[A-Za-z0-9_-]{64}$/u.test(text("p_wrap_ciphertext"))
      || Math.abs(issuedAt - Date.now()) > 60_000 || expiresAt <= issuedAt
      || expiresAt > issuedAt + 365 * 86_400_000) throw new SqlError("22023");
    const key = text("p_idempotency_key"); const id = text("p_locator_record_id");
    const digest = JSON.stringify(Object.entries(value).filter(([name]) => name !== "p_idempotency_key"));
    const replayed = this.replay("register_locator", id, key, digest); if (replayed) return replayed;
    if (this.locators.has(id) || [...this.locators.values()].some((entry) =>
      entry.grantId === text("p_grant_id") || entry.indexDigest === text("p_locator_index_digest"))) {
      throw new SqlError("23505");
    }
    this.locators.set(id, { id, ownerUserId: text("p_owner_user_id"), indexDigest: text("p_locator_index_digest"),
      commitment: text("p_locator_commitment"), grantId: text("p_grant_id"),
      proofPublicKey: text("p_proof_public_key"), recordBindingDigest: text("p_record_binding_digest"),
      kdfSalt: text("p_kdf_salt"), status: "active", issuedAt, expiresAt, revokedAt: null });
    const result = { locator_record_id: id, locator_version: 2, status: "active",
      authority: "route_possession_only", synthetic_only: true, claim_created: false, release_authorized: false };
    this.remember("register_locator", id, key, digest, result);
    return { ...result, replayed: false };
  }

  // claimant_revoke_offline_code_v2_locator
  revoke(value: Record<string, unknown>) {
    if (value.p_expected_locator_version !== 2 || value.p_reason !== "owner_revoked") throw new SqlError("22023");
    const id = String(value.p_locator_record_id); const key = String(value.p_idempotency_key);
    const digest = [id, value.p_owner_user_id, value.p_expected_locator_version, value.p_reason].join("|");
    const replayed = this.replay("revoke_locator", id, key, digest); if (replayed) return replayed;
    const locator = this.locators.get(id);
    if (!locator || locator.ownerUserId !== value.p_owner_user_id || locator.status !== "active") {
      throw new SqlError("42501");
    }
    locator.status = "revoked"; locator.revokedAt = Date.now();
    for (const entry of this.challenges.values()) {
      if (entry.challenge.locator_record_id === id && entry.status === "issued") entry.status = "revoked";
    }
    const result = { locator_record_id: id, locator_version: 2, status: "revoked", future_challenges_allowed: false,
      claim_created: false, release_authorized: false };
    this.remember("revoke_locator", id, key, digest, result);
    return { ...result, replayed: false };
  }

  // claimant_issue_offline_code_v2_challenge: an unknown, revoked or expired locator yields a random decoy.
  issueChallenge(value: Record<string, unknown>) {
    const index = String(value.p_locator_index_digest);
    const locator = [...this.locators.values()].find((entry) => entry.indexDigest === index);
    const available = locator?.status === "active" && locator.expiresAt > Date.now();
    const random = (length: number) => randomBytes(length).toString("base64url");
    const issuedAt = new Date(); const expiresAt = new Date(issuedAt.getTime() + 300_000);
    const challenge: OfflineCodeChallengeV2 = { authority: "route_possession_only", challenge_id: randomUUID(),
      expires_at: expiresAt.toISOString(), issued_at: issuedAt.toISOString(),
      locator_commitment: available ? locator.commitment : random(32),
      locator_record_id: available ? locator.id : randomUUID(), locator_version: 2, nonce: random(32),
      origin: String(value.p_origin), proof_key_version: 1,
      proof_public_key: available ? locator.proofPublicKey : random(32),
      protocol: "sanduqkin:claim:offline-code:v2", purpose: "possession_challenge",
      record_binding_digest: available ? locator.recordBindingDigest : random(32) };
    this.challenges.set(challenge.challenge_id, { challenge, status: "issued" });
    const bytes = Buffer.from(canonicalJson(challenge as never));
    return { rate_limited: false, challenge, challenge_bytes_base64url: bytes.toString("base64url"),
      challenge_bytes_digest: b64digest(bytes), kdf_profile: { algorithm: "argon2id", memlimit_bytes: 67_108_864,
        opslimit: 2, output_bytes: 32, production_approved: false, profile_id: "argon2id-synthetic-test-v2",
        protocol: "sanduqkin:claim:offline-code:v2", purpose: "client_secret_root",
        salt: available ? locator.kdfSalt : random(16) },
      identity_verified: false, claim_created: false, release_authorized: false, replayed: false };
  }

  // claimant_record_offline_code_v2_attempt
  recordAttempt(value: Record<string, unknown>) {
    const entry = this.challenges.get(String(value.p_challenge_id));
    if (!entry || entry.status !== "issued") throw new SqlError("40001");
    const verified = value.p_verification_outcome === "verified";
    entry.status = verified ? "verified" : "failed";
    return { challenge_id: value.p_challenge_id, locator_record_id: value.p_locator_record_id,
      verification_outcome: value.p_verification_outcome, route_possession_asserted: verified,
      locator_locked: false, identity_verified: false, claim_created: false, release_authorized: false,
      replayed: false };
  }

  // claimant_list_offline_code_v2_locators (20260926090000): the owner's own sheets, newest first, at most 50.
  list(value: Record<string, unknown>) {
    const iso = (ms: number) => new Date(ms).toISOString().replace("Z", "+00:00");
    const sheets = [...this.locators.values()].filter((entry) => entry.ownerUserId === value.p_owner_user_id)
      .sort((left, right) => right.issuedAt - left.issuedAt || left.id.localeCompare(right.id)).slice(0, 50)
      .map((entry) => ({ locator_record_id: entry.id,
        status: entry.status === "active" && entry.expiresAt <= Date.now() ? "expired" : entry.status,
        issued_at: iso(entry.issuedAt), expires_at: iso(entry.expiresAt),
        revoked_at: entry.revokedAt === null ? null : iso(entry.revokedAt) }));
    return { sheets, synthetic_only: true, claim_created: false, release_authorized: false };
  }

  async rpc(name: string, value: Record<string, unknown>) {
    try {
      const data = name === "claimant_register_offline_code_v2_locator" ? this.register(value)
        : name === "claimant_revoke_offline_code_v2_locator" ? this.revoke(value)
          : name === "claimant_list_offline_code_v2_locators" ? this.list(value)
          : name === "claimant_issue_offline_code_v2_challenge" ? this.issueChallenge(value)
            : name === "claimant_record_offline_code_v2_attempt" ? this.recordAttempt(value) : null;
      if (!data) throw new Error(`Unexpected RPC ${name}`);
      return { data: structuredClone(data), error: null };
    } catch (error) {
      if (error instanceof SqlError) return { data: null, error: { code: error.code } };
      throw error;
    }
  }
}

function sheetCrypto(): OfflineCodeV2SheetCrypto {
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
    wipe: (value) => { value.fill(0); },
    randomBytes: (length) => sodium.randombytes_buf(length),
    xchacha20poly1305Encrypt: (message, associatedData, nonce, key) =>
      sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(message, associatedData, null, nonce, key),
  };
}

function harness() {
  const store = new SyntheticOfflineCodeStore();
  const rpc = vi.fn((name: string, value: Record<string, unknown>) => store.rpc(name, value));
  const persistence = () => createOfflineCodeV2PersistenceTransactionClient(rpc);
  const sessions = new Map<string, string>();
  const staleMfa = new Set<string>();
  const runtimeConfig = getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
    CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true" });
  const supabase = { supabaseUrl: "https://synthetic.supabase.test", serviceRoleKey: "unused-synthetic-service-role" };
  const ownerSession = {
    getSession: vi.fn(async (jwt: string) => {
      const userId = sessions.get(jwt); if (!userId) throw new Error("Unauthorized");
      const seconds = Math.floor(Date.now() / 1000);
      return { userId, sessionId: `${userId.slice(0, 35)}f`, aal: "aal2" as const, issuedAt: seconds - 30,
        expiresAt: seconds + 600, amr: [{ method: "totp", timestamp: staleMfa.has(jwt) ? seconds - 7_200 : seconds }] };
    }),
    assertActiveSession: vi.fn(async () => undefined),
    acceptInvitation: vi.fn(), activateSession: vi.fn(), issueInvitation: vi.fn(), manageLifecycle: vi.fn(),
    revokeInvitation: vi.fn(), revokeSession: vi.fn(),
  };
  const ownerDeps = { approved: true, runtimeConfig, createOwnerSessionClient: () => ownerSession,
    createPersistence: persistence, createSheetReader: () => createOfflineCodeV2OwnerSheetReader(rpc),
    getConfig: () => ({ ...supabase, apiOrigin, ownerOrigin, freshAssuranceSeconds: 600, locatorIndexKey }) };
  const claimantDeps = { approved: true, runtimeConfig, createPersistence: persistence,
    getConfig: () => ({ ...supabase, apiOrigin, claimantOrigin, locatorIndexKey,
      rateLimitKey: b64digest("synthetic-6g-rate-limit-key") }),
    getTrustedSignals: async () => ({ networkSignal: "synthetic-network" }) };
  const app = new Hono();
  app.post("/owner/offline-code/v2/locators", createOfflineCodeV2OwnerRoute("register", ownerDeps));
  app.post("/owner/offline-code/v2/locators/:locatorRecordId/revoke", createOfflineCodeV2OwnerRoute("revoke", ownerDeps));
  app.get("/owner/offline-code/v2/locators", createOfflineCodeV2OwnerListRoute(ownerDeps));
  app.post("/claimant/offline-code/v2/challenges", createOfflineCodeV2Controller("issueChallenge", claimantDeps));
  app.post("/claimant/offline-code/v2/challenges/:challengeId/proofs",
    createOfflineCodeV2Controller("verifyProof", claimantDeps));

  const owner = (userId: string) => { const jwt = `jwt-${userId}`; sessions.set(jwt, userId); return jwt; };
  const post = (path: string, body: unknown, headers: Record<string, string>) => app.request(`${apiOrigin}${path}`, {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(), ...headers } });
  return { app, store, rpc, owner, staleMfa,
    register: (jwt: string, body: unknown, key = randomUUID()) => post("/owner/offline-code/v2/locators", body,
      { Authorization: `Bearer ${jwt}`, Origin: ownerOrigin, "Idempotency-Key": key }),
    revoke: (jwt: string, id: string) => post(`/owner/offline-code/v2/locators/${id}/revoke`, {},
      { Authorization: `Bearer ${jwt}`, Origin: ownerOrigin }),
    challenge: (locator: string) => post("/claimant/offline-code/v2/challenges", { locator }, { Origin: claimantOrigin }),
    prove: (challengeId: string, body: unknown) => post(`/claimant/offline-code/v2/challenges/${challengeId}/proofs`,
      body, { Origin: claimantOrigin }) };
}

async function ownerSheet(ownerId: string) {
  const createdAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
  const sheet = await generateOfflineCodeV2EmergencySheet({ approved: true, syntheticOnly: true, crypto: sheetCrypto(),
    ownerId, grantId: randomUUID(), locatorRecordId: randomUUID(), mek: sodium.randombytes_buf(32),
    createdAt, expiresAt: new Date(Date.parse(createdAt) + 30 * 86_400_000).toISOString() });
  const { ownerUserId: _ownerUserId, ...body } = sheet.registration;
  return { sheet, body };
}

describe("Slice 6G owner registration to claimant challenge acceptance", () => {
  it("registers a generated sheet and lets the claimant find it and prove possession", async () => {
    await sodium.ready;
    const system = harness(); const ownerId = randomUUID();
    const { sheet, body } = await ownerSheet(ownerId);
    const registered = await system.register(system.owner(ownerId), body);
    expect(registered.status).toBe(200);
    expect(await registered.json()).toEqual({ locator_record_id: body.locatorRecordId, status: "active",
      replayed: false });
    expect(system.store.locators.get(body.locatorRecordId)?.ownerUserId).toBe(ownerId);
    const registerCall = system.rpc.mock.calls.find(([name]) => name === "claimant_register_offline_code_v2_locator")!;
    expect(JSON.stringify(registerCall[1])).not.toContain(sheet.printedSecret);
    expect(JSON.stringify(registerCall[1])).not.toContain(sheet.sheetPayload);

    const issued = await system.challenge(sheet.printedLocator);
    expect(issued.status).toBe(200);
    const { result } = await issued.json() as { result: { challenge: OfflineCodeChallengeV2;
      challenge_bytes_base64url: string; kdf_profile: { salt: string } } };
    expect(result.challenge.locator_record_id).toBe(body.locatorRecordId);
    expect(result.challenge.locator_commitment).toBe(body.locatorCommitment);
    expect(result.challenge.record_binding_digest).toBe(body.recordBindingDigest);
    expect(result.kdf_profile.salt).toBe(body.kdfSalt);

    const parsed = parseOfflineCodeSheetV2(sheet.sheetPayload);
    const proof = await createOfflineCodeV2PlatformProofProducer(true).produce({ ...parsed,
      challenge: result.challenge, expectedOrigin: claimantOrigin });
    const verified = await system.prove(result.challenge.challenge_id, { challenge: result.challenge,
      challenge_bytes_base64url: result.challenge_bytes_base64url, possession_proof: proof });
    expect(verified.status).toBe(200);
    expect((await verified.json() as { result: { route_possession_asserted: boolean } }).result
      .route_possession_asserted).toBe(true);
  }, 60_000);

  it("replays an exact retry, refuses a changed retry, a duplicate and another owner's sheet", async () => {
    await sodium.ready;
    const system = harness(); const ownerId = randomUUID(); const jwt = system.owner(ownerId);
    const { body } = await ownerSheet(ownerId); const key = randomUUID();
    expect((await system.register(jwt, body, key)).status).toBe(200);
    const replay = await system.register(jwt, body, key);
    expect(await replay.json()).toEqual({ locator_record_id: body.locatorRecordId, status: "active", replayed: true });
    const changed = await system.register(jwt, { ...body,
      expiresAt: new Date(Date.parse(body.expiresAt) - 86_400_000).toISOString() }, key);
    expect(changed.status).toBe(409);
    expect((await system.register(jwt, body)).status).toBe(409);
    const intruder = system.owner(randomUUID());
    const other = await ownerSheet(ownerId);
    expect((await system.register(intruder, other.body)).status).toBe(400);
    expect(system.store.locators.has(other.body.locatorRecordId)).toBe(false);
  }, 60_000);

  it("revokes only the owner's sheet, after which the claimant receives only a decoy", async () => {
    await sodium.ready;
    const system = harness(); const ownerId = randomUUID(); const jwt = system.owner(ownerId);
    const { sheet, body } = await ownerSheet(ownerId);
    expect((await system.register(jwt, body)).status).toBe(200);
    expect((await system.revoke(system.owner(randomUUID()), body.locatorRecordId)).status).toBe(404);
    expect(system.store.locators.get(body.locatorRecordId)?.status).toBe("active");
    const revoked = await system.revoke(jwt, body.locatorRecordId);
    expect(await revoked.json()).toEqual({ locator_record_id: body.locatorRecordId, status: "revoked",
      replayed: false });
    expect((await system.revoke(jwt, body.locatorRecordId)).status).toBe(404);
    const decoy = await system.challenge(sheet.printedLocator);
    expect(decoy.status).toBe(200);
    const { result } = await decoy.json() as { result: { challenge: OfflineCodeChallengeV2 } };
    expect(result.challenge.locator_record_id).not.toBe(body.locatorRecordId);
    expect(result.challenge.record_binding_digest).not.toBe(body.recordBindingDigest);
  }, 60_000);
});

describe("Slice 6H owner app flow to claimant acceptance", () => {
  function ownerApp(system: ReturnType<typeof harness>, ownerId: string) {
    const jwt = system.owner(ownerId); const printed: string[] = []; const made: OwnerOfflineCodeSheet[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => system.app.request(url, init)) as unknown as typeof fetch;
    const flow = createOwnerSheetFlow({
      createSheet: async (input) => { const sheet = await createOwnerOfflineCodeSheet({ ...input, approved: true,
        mek: sodium.randombytes_buf(32) }); made.push(sheet); return sheet; },
      getOwnerId: async () => ownerId,
      client: createOwnerOfflineCodeClient({ apiBaseUrl: apiOrigin, ownerOrigin, fetch: fetchImpl,
        getAccessToken: async () => jwt }),
      verifyFreshMfa: async () => false, renderSheetHtml: renderOwnerSheetHtml,
      print: async (html) => { printed.push(html); }, randomUUID,
    });
    return { flow, printed, made };
  }

  it("generates, self-checks, registers through the real route and prints a sheet the claimant can prove", async () => {
    await sodium.ready;
    const system = harness(); const ownerId = randomUUID(); const owner = ownerApp(system, ownerId);
    await owner.flow.start();
    expect(owner.flow.getState().status).toBe("ready_to_print");
    await owner.flow.print(); owner.flow.confirmPrinted();
    expect(owner.flow.getState().status).toBe("done");
    const [sheet] = owner.made; const [html] = owner.printed;
    expect(system.store.locators.get(sheet!.registration.locatorRecordId)?.ownerUserId).toBe(ownerId);
    expect(html).toContain(sheet!.printedLocator); expect(html).toContain(sheet!.printedSecret);
    const registerCall = system.rpc.mock.calls.find(([name]) => name === "claimant_register_offline_code_v2_locator")!;
    expect(JSON.stringify(registerCall[1])).not.toContain(sheet!.printedSecret);

    const issued = await system.challenge(sheet!.printedLocator);
    const { result } = await issued.json() as { result: { challenge: OfflineCodeChallengeV2;
      challenge_bytes_base64url: string } };
    expect(result.challenge.locator_record_id).toBe(sheet!.registration.locatorRecordId);
    const proof = await createOfflineCodeV2PlatformProofProducer(true).produce({
      ...parseOfflineCodeSheetV2(sheet!.sheetPayload), challenge: result.challenge, expectedOrigin: claimantOrigin });
    const verified = await system.prove(result.challenge.challenge_id, { challenge: result.challenge,
      challenge_bytes_base64url: result.challenge_bytes_base64url, possession_proof: proof });
    expect((await verified.json() as { result: { route_possession_asserted: boolean } }).result
      .route_possession_asserted).toBe(true);
  }, 60_000);

  it("revokes through the real route when the owner abandons before confirming, leaving only a decoy", async () => {
    await sodium.ready;
    const system = harness(); const owner = ownerApp(system, randomUUID());
    await owner.flow.start(); await owner.flow.print();
    await owner.flow.abandon();
    const [sheet] = owner.made;
    expect(system.store.locators.get(sheet!.registration.locatorRecordId)?.status).toBe("revoked");
    const decoy = await system.challenge(sheet!.printedLocator);
    const { result } = await decoy.json() as { result: { challenge: OfflineCodeChallengeV2 } };
    expect(result.challenge.locator_record_id).not.toBe(sheet!.registration.locatorRecordId);
  }, 60_000);
});

describe("Slice 6I printed sheet to claimant scan acceptance", () => {
  it("scans the QR code the owner actually printed and proves possession through the real routes", async () => {
    await sodium.ready;
    const system = harness(); const ownerId = randomUUID(); const jwt = system.owner(ownerId);
    const printed: string[] = []; const made: OwnerOfflineCodeSheet[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => system.app.request(url, init)) as unknown as typeof fetch;
    const flow = createOwnerSheetFlow({
      createSheet: async (input) => { const sheet = await createOwnerOfflineCodeSheet({ ...input, approved: true,
        mek: sodium.randombytes_buf(32) }); made.push(sheet); return sheet; },
      getOwnerId: async () => ownerId,
      client: createOwnerOfflineCodeClient({ apiBaseUrl: apiOrigin, ownerOrigin, fetch: fetchImpl,
        getAccessToken: async () => jwt }),
      verifyFreshMfa: async () => false, renderSheetHtml: renderOwnerSheetHtml,
      print: async (html) => { printed.push(html); }, randomUUID,
    });
    await flow.start(); await flow.print(); flow.confirmPrinted();
    const [sheet] = made; const [html] = printed;

    const scanned: string[] = [];
    const scan = createClaimSheetScan((text) => { scanned.push(text); });
    const decoded = decodePrintedSheetQr(html!);
    for (let frame = 0; frame < 3; frame += 1) scan.onScan({ type: "qr", data: decoded });
    expect(scanned).toEqual([sheet!.sheetPayload]);

    const issued = await system.challenge(sheet!.printedLocator);
    const { result } = await issued.json() as { result: { challenge: OfflineCodeChallengeV2;
      challenge_bytes_base64url: string } };
    expect(result.challenge.locator_record_id).toBe(sheet!.registration.locatorRecordId);
    const proof = await createOfflineCodeV2PlatformProofProducer(true).produce({
      ...parseOfflineCodeSheetV2(scanned[0]), challenge: result.challenge, expectedOrigin: claimantOrigin });
    const verified = await system.prove(result.challenge.challenge_id, { challenge: result.challenge,
      challenge_bytes_base64url: result.challenge_bytes_base64url, possession_proof: proof });
    expect((await verified.json() as { result: { route_possession_asserted: boolean } }).result
      .route_possession_asserted).toBe(true);
  }, 60_000);
});

describe("Slice 6J my emergency sheets acceptance", () => {
  function ownerDevice(system: ReturnType<typeof harness>, ownerId: string) {
    const jwt = system.owner(ownerId); const printed: string[] = []; const made: OwnerOfflineCodeSheet[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => system.app.request(url, init)) as unknown as typeof fetch;
    const client = createOwnerOfflineCodeClient({ apiBaseUrl: apiOrigin, ownerOrigin, fetch: fetchImpl,
      getAccessToken: async () => jwt });
    const print = () => createOwnerSheetFlow({
      createSheet: async (input) => { const sheet = await createOwnerOfflineCodeSheet({ ...input, approved: true,
        mek: sodium.randombytes_buf(32) }); made.push(sheet); return sheet; },
      getOwnerId: async () => ownerId, client, verifyFreshMfa: async () => false,
      renderSheetHtml: renderOwnerSheetHtml, print: async (html) => { printed.push(html); }, randomUUID });
    const verifyFreshMfa = vi.fn(async (code: string) => { if (code !== "123456") return false;
      system.staleMfa.delete(jwt); return true; });
    return { jwt, client, print, printed, made, verifyFreshMfa,
      list: createOwnerSheetListFlow({ client, verifyFreshMfa, randomUUID }) };
  }
  async function proves(system: ReturnType<typeof harness>, sheet: OwnerOfflineCodeSheet) {
    const issued = await system.challenge(sheet.printedLocator);
    const { result } = await issued.json() as { result: { challenge: OfflineCodeChallengeV2;
      challenge_bytes_base64url: string } };
    if (result.challenge.locator_record_id !== sheet.registration.locatorRecordId) return false;
    const proof = await createOfflineCodeV2PlatformProofProducer(true).produce({
      ...parseOfflineCodeSheetV2(sheet.sheetPayload), challenge: result.challenge, expectedOrigin: claimantOrigin });
    const verified = await system.prove(result.challenge.challenge_id, { challenge: result.challenge,
      challenge_bytes_base64url: result.challenge_bytes_base64url, possession_proof: proof });
    return (await verified.json() as { result: { route_possession_asserted: boolean } }).result
      .route_possession_asserted;
  }

  it("lists two printed sheets, revokes one after a fresh code, and leaves the other working", async () => {
    await sodium.ready;
    const system = harness(); const device = ownerDevice(system, randomUUID());
    for (let count = 0; count < 2; count += 1) {
      const flow = device.print(); await flow.start(); await flow.print(); flow.confirmPrinted();
    }
    const [first, second] = device.made;
    expect(device.printed[1]).toContain(`<dt>Reference</dt><dd>${second!.registration.locatorRecordId
      .replaceAll("-", "").slice(0, 6).toUpperCase()}</dd>`);

    // Listing needs no fresh code; revoking does.
    system.staleMfa.add(device.jwt);
    await device.list.load();
    const listed = device.list.getState();
    expect(listed.status).toBe("ready");
    expect(new Set(listed.sheets.map((sheet) => sheet.locatorRecordId)))
      .toEqual(new Set([first!.registration.locatorRecordId, second!.registration.locatorRecordId]));
    expect(listed.sheets.every((sheet) => sheet.status === "active" && sheet.revokedAt === null)).toBe(true);
    const listCalls = system.rpc.mock.calls.filter(([name]) => name === "claimant_list_offline_code_v2_locators");
    expect(JSON.stringify(listed)).not.toContain(first!.printedSecret);

    device.list.requestRevoke(first!.registration.locatorRecordId);
    await device.list.confirmRevoke();
    expect(device.list.getState().status).toBe("needs_fresh_mfa");
    await device.list.submitMfaCode("123456");
    expect(device.list.getState()).toMatchObject({ status: "ready", revoked: true });
    expect(device.list.getState().sheets.find((sheet) =>
      sheet.locatorRecordId === first!.registration.locatorRecordId)?.status).toBe("revoked");
    expect(system.store.locators.get(first!.registration.locatorRecordId)?.status).toBe("revoked");
    expect(listCalls.every(([, value]) => Object.keys(value).join() === "p_owner_user_id")).toBe(true);

    expect(await proves(system, first!)).toBe(false);
    expect(await proves(system, second!)).toBe(true);
  }, 90_000);

  it("never shows or revokes another owner's sheet", async () => {
    await sodium.ready;
    const system = harness(); const owner = ownerDevice(system, randomUUID()); const other = ownerDevice(system, randomUUID());
    const flow = owner.print(); await flow.start(); await flow.print(); flow.confirmPrinted();
    await other.list.load();
    expect(other.list.getState()).toMatchObject({ status: "ready", sheets: [] });
    await expect(other.client.revoke(owner.made[0]!.registration.locatorRecordId, randomUUID())).rejects.toThrow();
    expect(system.store.locators.get(owner.made[0]!.registration.locatorRecordId)?.status).toBe("active");
  }, 60_000);
});
