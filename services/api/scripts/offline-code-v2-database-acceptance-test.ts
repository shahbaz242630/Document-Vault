/// <reference path="../../../apps/mobile/src/types/libsodium-wrappers-sumo.d.ts" />

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { normalizeOfflineCodePublicLocatorV2 } from "@vault/shared-types";
import { Hono } from "hono";

import { createOfflineCodeV2Lifecycle }
  from "../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-lifecycle";
import { createOfflineCodeV2PlatformProofProducer }
  from "../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-proof-producer";
import { createOfflineCodeV2BoundaryIndexer, createOfflineCodeV2Controller,
  type OfflineCodeV2ControllerConfig } from "../src/claimant/offline-code-v2-controller.js";
import { createOfflineCodeV2PersistenceTransactionClient,
  type OfflineCodeV2RegistrationInput }
  from "../src/claimant/offline-code-v2-persistence-transaction-client.js";
import { getClaimantRuntimeConfig } from "../src/claimant/runtime-config.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const challengePath = "/claimant/offline-code/v2/challenges";
const apiOrigin = "https://api.sanduqkin.test";
const claimantOrigin = "https://app.sanduqkin.test";
const container = process.env.SANDUQKIN_LOCAL_SUPABASE_CONTAINER ?? "supabase_db_supabase";

type Fixture = Readonly<{
  public_locator: Readonly<{ locator: string }>;
  synthetic_client_secret: unknown;
  kdf_profile: Readonly<{ salt: string }>;
  record_binding: Readonly<{ locator_record_id: string; locator_commitment: string;
    grant_id: string; owner_id: string; proof_public_key: string }>;
  record_binding_digest: string;
  wrap: Readonly<{ associated_data_canonical: string;
    envelope: Readonly<{ nonce: string; ciphertext: string }> }>;
}>;

type LocalStatus = Readonly<Record<string, string>>;

async function main(): Promise<void> {
  assert.equal(process.env.SANDUQKIN_LOCAL_SUPABASE_ACCEPTANCE, "1",
    "Local Supabase acceptance requires its explicit test-only flag.");
  assert.match(container, /^supabase_db_[a-zA-Z0-9_-]+$/u);
  const status = readLocalStatus();
  const supabaseUrl = required(status.API_URL ?? status.api_url, "local API URL");
  const serviceRoleKey = required(status.SERVICE_ROLE_KEY ?? status.service_role_key,
    "local service-role key");
  const anonKey = required(status.ANON_KEY ?? status.anon_key, "local anonymous key");
  assertLoopback(supabaseUrl);

  const fixture = JSON.parse(readFileSync(resolve(root,
    "packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as Fixture;
  seedOwner(fixture.record_binding.owner_id);

  const primaryConfig = config(supabaseUrl, serviceRoleKey, fixture,
    digest("synthetic-database-rate-key"));
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: authOptions });
  const transactions = createOfflineCodeV2PersistenceTransactionClient(
    (name, input) => client.rpc(name, input));

  await exerciseUnknownLimiter(supabaseUrl, serviceRoleKey, fixture);
  await transactions.register(await registration(fixture, primaryConfig));
  await exerciseCommittedRetry(fixture, primaryConfig);
  await exerciseConcurrentRegistration(transactions, fixture);
  await exerciseExpiry(fixture, primaryConfig);
  await exerciseRls(supabaseUrl, anonKey);
  console.log("Claimant offline-code V2 database acceptance passed.");
}

function readLocalStatus(): LocalStatus {
  const output = execFileSync("supabase", ["status", "--workdir",
    resolve(root, process.env.SANDUQKIN_LOCAL_SUPABASE_WORKDIR ?? "supabase"), "-o", "json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(output) as LocalStatus;
}

function assertLoopback(value: string): void {
  const url = new URL(value);
  assert.equal(url.protocol, "http:");
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(url.hostname),
    "Database acceptance refuses non-loopback Supabase URLs.");
  assert.equal(url.username, ""); assert.equal(url.password, "");
}

function seedOwner(ownerId: string): void {
  sql(`insert into auth.users(id) values ('${ownerId}') on conflict (id) do nothing;`);
}

function sql(statement: string): string {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres",
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], {
    encoding: "utf8", input: statement, stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function config(supabaseUrl: string, serviceRoleKey: string, fixture: Fixture,
  rateLimitKey: string): OfflineCodeV2ControllerConfig {
  return { apiOrigin, claimantOrigin, locatorIndexKey: required(
    (fixture as Fixture & { synthetic_locator_index_key?: string }).synthetic_locator_index_key,
    "synthetic locator-index key"), rateLimitKey, serviceRoleKey, supabaseUrl };
}

async function registration(fixture: Fixture, value: OfflineCodeV2ControllerConfig,
  overrides: Partial<OfflineCodeV2RegistrationInput> = {}): Promise<OfflineCodeV2RegistrationInput> {
  const normalizedLocator = normalizeOfflineCodePublicLocatorV2(fixture.public_locator.locator);
  const indexes = await createOfflineCodeV2BoundaryIndexer(value).derive({ normalizedLocator,
    networkSignal: "synthetic-database-network" });
  const issuedAt = new Date(); const expiresAt = new Date(issuedAt.getTime() + 30 * 86_400_000);
  return { locatorRecordId: fixture.record_binding.locator_record_id,
    ownerUserId: fixture.record_binding.owner_id, locatorIndexDigest: indexes.locatorIndexDigest,
    locatorCommitment: fixture.record_binding.locator_commitment,
    grantId: fixture.record_binding.grant_id,
    proofPublicKey: fixture.record_binding.proof_public_key,
    recordBindingDigest: fixture.record_binding_digest, kdfSalt: fixture.kdf_profile.salt,
    wrapNonce: fixture.wrap.envelope.nonce, wrapCiphertext: fixture.wrap.envelope.ciphertext,
    wrapAssociatedDataDigest: digest(Buffer.from(fixture.wrap.associated_data_canonical, "base64url")),
    issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString(),
    idempotencyKey: "51000000-0000-4000-8000-000000000001", ...overrides };
}

function server(value: OfflineCodeV2ControllerConfig): Hono {
  const deps = { approved: true, getConfig: () => value,
    getTrustedSignals: async () => ({ networkSignal: "synthetic-database-network",
      deviceSignal: "synthetic-database-device" }),
    runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true" }) };
  const app = new Hono();
  app.post(challengePath, createOfflineCodeV2Controller("issueChallenge", deps));
  app.post(`${challengePath}/:challengeId/proofs`, createOfflineCodeV2Controller("verifyProof", deps));
  return app;
}

async function exerciseCommittedRetry(fixture: Fixture,
  value: OfflineCodeV2ControllerConfig): Promise<void> {
  const app = server(value); let dropProofResponse = true; const proofBodies: string[] = [];
  const send = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const requested = new URL(String(url)); const body = String(init?.body);
    const response = await app.request(`${apiOrigin}${requested.pathname}`, { ...init, body });
    if (requested.pathname.endsWith("/proofs")) {
      proofBodies.push(body);
      if (dropProofResponse) { dropProofResponse = false;
        throw new Error("Synthetic response loss after committed local persistence."); }
    }
    return response;
  };
  const runtime = createOfflineCodeV2Lifecycle({ approved: true, syntheticOnly: true,
    productionRuntime: false, apiOrigin, claimantOrigin, send,
    producer: createOfflineCodeV2PlatformProofProducer(true), now: () => new Date(),
    lifecycle: foregroundLifecycle });
  const attempt = { syntheticOnly: true, publicLocator: fixture.public_locator,
    clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile,
    recordBinding: fixture.record_binding,
    challengeIdempotencyKey: "51000000-0000-4000-8000-000000000002",
    proofIdempotencyKey: "51000000-0000-4000-8000-000000000003" } as never;
  await assert.rejects(runtime.start(attempt));
  const result = await runtime.retryProof();
  assert.deepEqual(result, { status: "proof_verified", authority: "route_possession_only",
    route_possession_asserted: true, identity_verified: false, claim_created: false,
    release_authorized: false });
  assert.equal(proofBodies.length, 2); assert.equal(proofBodies[0], proofBodies[1]);
  assert.equal(sql(`select count(*) from public.claimant_offline_code_v2_attempts where locator_record_id = '${fixture.record_binding.locator_record_id}';`), "1");
  await runtime.dispose();
}

async function exerciseConcurrentRegistration(transactions: ReturnType<
  typeof createOfflineCodeV2PersistenceTransactionClient>, fixture: Fixture): Promise<void> {
  const sharedGrant = randomUUID(); const first = randomUUID(); const second = randomUUID();
  const base = await registration(fixture, config("http://127.0.0.1:54321", "local-test", fixture,
    digest("synthetic-concurrency-rate-key")));
  const outcomes = await Promise.allSettled([
    transactions.register({ ...base, locatorRecordId: first, grantId: sharedGrant,
      locatorIndexDigest: digest(`locator-${first}`), idempotencyKey: randomUUID() }),
    transactions.register({ ...base, locatorRecordId: second, grantId: sharedGrant,
      locatorIndexDigest: digest(`locator-${second}`), idempotencyKey: randomUUID() }),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(sql(`select count(*) from public.claimant_offline_code_v2_locators where grant_id = '${sharedGrant}';`), "1");
  assert.equal(sql(`select count(*) from public.claimant_offline_code_v2_events where locator_record_id in ('${first}','${second}');`), "1");
  assert.equal(sql(`select count(*) from public.claimant_offline_code_v2_idempotency where operation = 'register_locator' and scope_id in ('${first}','${second}');`), "1");
}

async function exerciseExpiry(fixture: Fixture, value: OfflineCodeV2ControllerConfig): Promise<void> {
  const id = fixture.record_binding.locator_record_id;
  sql(`update public.claimant_offline_code_v2_locators set issued_at = now() - interval '2 days', expires_at = now() - interval '1 day' where id = '${id}';`);
  const before = sql(`select count(*) from public.claimant_offline_code_v2_challenges where locator_record_id = '${id}';`);
  const response = await issue(server(value), fixture.public_locator.locator,
    "51000000-0000-4000-8000-000000000004");
  assert.equal(response.status, 200);
  assert.equal(sql(`select status from public.claimant_offline_code_v2_locators where id = '${id}';`), "expired");
  assert.equal(sql(`select count(*) from public.claimant_offline_code_v2_challenges where locator_record_id = '${id}';`), before);
}

async function exerciseUnknownLimiter(supabaseUrl: string, serviceRoleKey: string,
  fixture: Fixture): Promise<void> {
  const unknownConfig = { ...config(supabaseUrl, serviceRoleKey, fixture,
    digest("synthetic-unknown-rate-key")),
  locatorIndexKey: digest("synthetic-unknown-locator-key") };
  const app = server(unknownConfig); const responses: Response[] = [];
  for (let index = 0; index < 6; index += 1) responses.push(await issue(app,
    fixture.public_locator.locator, `52000000-0000-4000-8000-00000000000${index + 1}`));
  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200, 200, 429]);
  const limited = await responses[5].json() as { result: Record<string, unknown> };
  assert.equal(limited.result.retry_after_seconds, 300);
  assert.equal("challenge" in limited.result, false);
}

async function issue(app: Hono, locator: unknown, idempotencyKey: string): Promise<Response> {
  return app.request(`${apiOrigin}${challengePath}`, { method: "POST", headers: {
    Origin: claimantOrigin, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey,
  }, body: JSON.stringify({ locator }) });
}

async function exerciseRls(supabaseUrl: string, anonKey: string): Promise<void> {
  const anon = createClient(supabaseUrl, anonKey, { auth: authOptions });
  const table = await anon.from("claimant_offline_code_v2_locators").select("id").limit(1);
  assert.ok(table.error); assert.equal(table.data, null);
  const rpc = await anon.rpc("claimant_issue_offline_code_v2_challenge", {
    p_locator_index_digest: digest("anon-locator"), p_network_bucket_digest: digest("anon-network"),
    p_device_bucket_digest: null, p_global_bucket_digest: digest("anon-global"),
    p_origin: claimantOrigin, p_idempotency_key: randomUUID(),
  });
  assert.ok(rpc.error); assert.equal(rpc.data, null);
  const attempt = await anon.rpc("claimant_record_offline_code_v2_attempt", {
    p_locator_record_id: randomUUID(), p_challenge_id: randomUUID(),
    p_verified_challenge_bytes_digest: digest("anon-challenge"),
    p_verified_record_binding_digest: digest("anon-binding"),
    p_proof_signature_digest: digest("anon-signature"),
    p_verification_outcome: "invalid", p_idempotency_key: randomUUID(),
  });
  assert.ok(attempt.error); assert.equal(attempt.data, null);
}

const foregroundLifecycle = { subscribe(callback: (event: unknown) => void) {
  callback({ sequence: 0, state: "foreground" }); return () => undefined;
} };
const authOptions = { autoRefreshToken: false, detectSessionInUrl: false,
  persistSession: false } as const;
function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("base64url");
}
function required(value: string | undefined, label: string): string {
  assert.ok(value, `Missing ${label}.`); return value;
}

await main();
