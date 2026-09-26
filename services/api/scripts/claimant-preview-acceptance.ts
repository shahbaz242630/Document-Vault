/// <reference path="../../../apps/mobile/src/types/libsodium-wrappers-sumo.d.ts" />

/*
 * Staging wiring W1 hosted acceptance. It runs the real mobile owner and claimant code, from Node, against the
 * claimant-preview Vercel deployment and the shared Supabase project, with two synthetic owners that exist only
 * for the run and are always removed afterwards by the synthetic cleanup.
 *
 * Needs SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, VERCEL_TOKEN, OFFLINE_CODE_V2_OWNER_ORIGIN and
 * OFFLINE_CODE_V2_CLAIMANT_ORIGIN (optionally VERCEL_TEAM_ID). Every other value is looked up and none is printed.
 */
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseOfflineCodeSheetV2, type OfflineCodeChallengeV2 } from "@vault/shared-types";
import sodium from "libsodium-wrappers-sumo";

import { createOfflineCodeV2PlatformProofProducer }
  from "../../../apps/mobile/src/features/claimant-offline-code/offline-code-v2-proof-producer";
import { createOwnerOfflineCodeClient }
  from "../../../apps/mobile/src/features/claimant-offline-code/owner-offline-code-client";
import { createOwnerOfflineCodeSheet, type OwnerOfflineCodeSheet }
  from "../../../apps/mobile/src/features/claimant-offline-code/owner-offline-code-sheet-factory";
import { createOwnerSheetFlow } from "../../../apps/mobile/src/features/claimant-offline-code/owner-sheet-flow";
import { createOwnerSheetListFlow }
  from "../../../apps/mobile/src/features/claimant-offline-code/owner-sheet-list-flow";
import { renderOwnerSheetHtml } from "../../../apps/mobile/src/features/claimant-offline-code/owner-sheet-html";

const require = createRequire(import.meta.url);
const { cleanup } = require("../../../scripts/claimant-preview-synthetic-cleanup.cjs") as {
  cleanup: (input: { apply: boolean; token: string; projectRef: string; log?: (line: string) => void })
    => Promise<Record<string, number>>;
};

const PROJECT = "sanduqkin-api";
const BRANCH = "claimant-preview";
const env = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
const supabaseToken = env("SUPABASE_ACCESS_TOKEN");
const projectRef = env("SUPABASE_PROJECT_REF");
const vercelToken = env("VERCEL_TOKEN");
const ownerOrigin = env("OFFLINE_CODE_V2_OWNER_ORIGIN");
const claimantOrigin = env("OFFLINE_CODE_V2_CLAIMANT_ORIGIN");
const teamId = process.env.VERCEL_TEAM_ID?.trim();
const results: string[] = [];
const pass = (line: string) => { results.push(line); console.log(`PASS ${line}`); };

async function vercel<T>(path: string): Promise<T> {
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${vercelToken}` } });
  if (!response.ok) throw new Error(`Vercel ${url.pathname} failed with ${response.status}.`);
  return response.json() as Promise<T>;
}

async function supabaseKeys() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${supabaseToken}` } });
  if (!response.ok) throw new Error(`Supabase key lookup failed with ${response.status}.`);
  const keys = await response.json() as { name: string; api_key: string }[];
  const find = (name: string) => keys.find((key) => key.name === name)?.api_key ?? "";
  assert.ok(find("anon") && find("service_role"), "Supabase anon and service_role keys are required.");
  return { url: `https://${projectRef}.supabase.co`, anon: find("anon"), serviceRole: find("service_role") };
}

type Deployment = { uid: string; url: string; state?: string; readyState?: string; target?: string | null;
  meta?: Record<string, string> };

async function deployments() {
  const project = await vercel<{ id: string; protectionBypass?: Record<string, { scope?: string }> }>(
    `/v9/projects/${PROJECT}`);
  const bypass = Object.entries(project.protectionBypass ?? {})
    .find(([, value]) => value.scope === "automation-bypass")?.[0];
  assert.ok(bypass, "The Vercel automation bypass for sanduqkin-api is missing.");
  const listed = await vercel<{ deployments: Deployment[] }>(`/v6/deployments?projectId=${project.id}&limit=50`);
  const ready = listed.deployments.filter((deployment) => (deployment.state ?? deployment.readyState) === "READY");
  const preview = ready.find((deployment) => deployment.meta?.githubCommitRef === BRANCH);
  const otherPreview = ready.find((deployment) => deployment.target !== "production"
    && deployment.meta?.githubCommitRef && deployment.meta.githubCommitRef !== BRANCH);
  const production = (await vercel<{ deployments: Deployment[] }>(
    `/v6/deployments?projectId=${project.id}&target=production&state=READY&limit=1`)).deployments[0];
  assert.ok(preview, "No ready claimant-preview deployment was found.");
  const aliases = await vercel<{ aliases: { alias: string }[] }>(`/v2/deployments/${preview.uid}/aliases`);
  const branchAlias = aliases.aliases.map(({ alias }) => alias).find((alias) => alias.includes(`-git-${BRANCH}-`));
  assert.ok(branchAlias, "The claimant-preview branch alias was not found.");
  // Once the preview-api custom domain is live, set CLAIMANT_PREVIEW_API_ORIGIN to it (it must match the API origin).
  const apiOrigin = process.env.CLAIMANT_PREVIEW_API_ORIGIN?.trim() || `https://${branchAlias}`;
  return { bypass, apiOrigin, previewCommit: preview.meta?.githubCommitSha ?? "",
    otherPreview: otherPreview ? `https://${otherPreview.url}` : null,
    production: production ? `https://${production.url}` : null };
}

function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secretBase32.replace(/=+$/u, "").toUpperCase()) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/gu)!.map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function nextTotpWindow() {
  await new Promise((resolve) => setTimeout(resolve, 30_000 - (Date.now() % 30_000) + 1_000));
}

type Owner = { id: string; client: SupabaseClient; factorId: string; secret: string };

async function createSyntheticOwner(keys: Awaited<ReturnType<typeof supabaseKeys>>): Promise<Owner> {
  const admin = createClient(keys.url, keys.serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `claimant-preview-synthetic-${randomBytes(6).toString("hex")}@sanduqkin.invalid`;
  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`Synthetic owner creation failed: ${created.error?.message}`);
  const client = createClient(keys.url, keys.anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`Synthetic owner sign-in failed: ${signedIn.error.message}`);
  const enrolled = await client.auth.mfa.enroll({ factorType: "totp" });
  if (enrolled.error) throw new Error(`Synthetic owner TOTP enrolment failed: ${enrolled.error.message}`);
  const owner = { id: created.data.user.id, client, factorId: enrolled.data.id, secret: enrolled.data.totp.secret };
  await verifyTotp(owner);
  return owner;
}

/* W2a: the owner activates its claimant session control through the real owner route, as the app does. */
async function activateOwnerSession(apiOrigin: string, bypassFetch: typeof fetch, owner: Owner) {
  const response = await bypassFetch(`${apiOrigin}/owner/session/activate`, { method: "POST", body: "{}",
    headers: { Authorization: `Bearer ${await accessToken(owner)}`, "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(), Origin: ownerOrigin } });
  assert.equal(response.status, 200, `owner session activation returned ${response.status}`);
}

async function verifyTotp(owner: Owner) {
  const verified = await owner.client.auth.mfa.challengeAndVerify({ factorId: owner.factorId, code: totp(owner.secret) });
  if (verified.error) throw new Error(`Synthetic owner TOTP verification failed: ${verified.error.message}`);
}

async function accessToken(owner: Owner) {
  return (await owner.client.auth.getSession()).data.session?.access_token ?? null;
}

type Hosted = Awaited<ReturnType<typeof deployments>>;

async function claimantChecks(hosted: Hosted, bypassFetch: typeof fetch, revokedSheet: OwnerOfflineCodeSheet,
  liveSheet: OwnerOfflineCodeSheet) {
  const challenge = async (locator: string) => {
    const response = await bypassFetch(`${hosted.apiOrigin}/claimant/offline-code/v2/challenges`, {
      method: "POST", body: JSON.stringify({ locator }), headers: { "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(), Origin: claimantOrigin } });
    assert.equal(response.status, 200, `challenge returned ${response.status}`);
    return (await response.json() as { result: { challenge: OfflineCodeChallengeV2;
      challenge_bytes_base64url: string } }).result;
  };
  const decoy = await challenge(revokedSheet.printedLocator);
  assert.notEqual(decoy.challenge.locator_record_id, revokedSheet.registration.locatorRecordId);
  pass("the revoked sheet yields only a decoy challenge");

  const issued = await challenge(liveSheet.printedLocator);
  assert.equal(issued.challenge.locator_record_id, liveSheet.registration.locatorRecordId);
  const proof = await createOfflineCodeV2PlatformProofProducer(true).produce({
    ...parseOfflineCodeSheetV2(liveSheet.sheetPayload), challenge: issued.challenge, expectedOrigin: claimantOrigin });
  const verified = await bypassFetch(`${hosted.apiOrigin}/claimant/offline-code/v2/challenges/${
    issued.challenge.challenge_id}/proofs`, { method: "POST", body: JSON.stringify({ challenge: issued.challenge,
    challenge_bytes_base64url: issued.challenge_bytes_base64url, possession_proof: proof }),
  headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), Origin: claimantOrigin } });
  assert.equal(verified.status, 200);
  assert.equal((await verified.json() as { result: { route_possession_asserted: boolean } }).result
    .route_possession_asserted, true);
  pass("a claimant proves possession of the live sheet through the hosted challenge and proof routes");
}

async function concealmentChecks(hosted: Hosted, bypassFetch: typeof fetch, bearer: string | null) {
  const closedOnPreview = ["/claimant/offline-code/v2/handoffs/issue", "/claimant/offline-code/v2/handoffs/complete",
    "/claimant/session/activate", "/claimant/portal/session/activate", "/claimant/portal/session/assert",
    "/claimant/registered-recipient/invitations", "/claimant/native-enrollment/challenges",
    `/claimant/cases/${randomUUID()}/submissions`];
  for (const path of closedOnPreview) {
    const response = await bypassFetch(`${hosted.apiOrigin}${path}`, { method: "POST", body: "{}",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}`,
        "Idempotency-Key": randomUUID(), Origin: claimantOrigin } });
    assert.equal(response.status, 404, `${path} returned ${response.status} on the claimant-preview deployment`);
  }
  pass("claim start, portal session, recipients, enrollment and submission stay concealed on the Preview");

  for (const [name, origin] of [["another preview", hosted.otherPreview], ["production", hosted.production]] as const) {
    if (!origin) { console.log(`SKIP no ready ${name} deployment to check`); continue; }
    for (const [method, path] of [["GET", "/owner/offline-code/v2/locators"], ["POST", "/owner/offline-code/v2/locators"],
      ["POST", "/claimant/offline-code/v2/challenges"]] as const) {
      const response: Response = await bypassFetch(`${origin}${path}`, { method, ...(method === "POST" ? { body: "{}" } : {}),
        headers: { "Content-Type": "application/json", Origin: method === "GET" ? ownerOrigin : claimantOrigin,
          "Idempotency-Key": randomUUID() } });
      assert.equal(response.status, 404, `${method} ${path} returned ${response.status} on ${name}`);
    }
    pass(`the W1 routes are concealed on ${name}`);
  }
}

async function main() {
  await sodium.ready;
  const hosted = await deployments();
  const keys = await supabaseKeys();
  const withBypass = (init: RequestInit = {}): RequestInit => ({ ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), "x-vercel-protection-bypass": hosted.bypass } });
  const bypassFetch = (async (url: string, init?: RequestInit) => {
    const response = await fetch(url, withBypass(init));
    if (response.status !== 200) {
      console.log(`  ${init?.method ?? "GET"} ${new URL(url).pathname} -> ${response.status} ${
        await response.clone().text().then((text) => text.slice(0, 120)).catch(() => "")}`);
    }
    return response;
  }) as typeof fetch;
  console.log(`claimant-preview commit ${hosted.previewCommit.slice(0, 12)}`);

  const health = await fetch(`${hosted.apiOrigin}/health`, withBypass());
  assert.equal(health.status, 200); pass("API /health responds on the claimant-preview deployment");

  const owners: Owner[] = [];
  try {
    owners.push(await createSyntheticOwner(keys), await createSyntheticOwner(keys));
    const [first, second] = owners as [Owner, Owner];
    for (const owner of owners) await activateOwnerSession(hosted.apiOrigin, bypassFetch, owner);
    pass("two synthetic owners signed in with password and TOTP (AAL2) and activated through /owner/session/activate");

    const client = (owner: Owner) => createOwnerOfflineCodeClient({ apiBaseUrl: hosted.apiOrigin, ownerOrigin,
      fetch: bypassFetch, getAccessToken: () => accessToken(owner) });
    const made: OwnerOfflineCodeSheet[] = [];
    for (let index = 0; index < 2; index += 1) {
      const flow = createOwnerSheetFlow({
        createSheet: async (input) => { const sheet = await createOwnerOfflineCodeSheet({ ...input, approved: true,
          mek: sodium.randombytes_buf(32) }); made.push(sheet); return sheet; },
        getOwnerId: async () => first.id, client: client(first),
        verifyFreshMfa: async () => false, renderSheetHtml: renderOwnerSheetHtml,
        print: async () => undefined, randomUUID,
      });
      await flow.start(); await flow.print(); flow.confirmPrinted();
      assert.equal(flow.getState().status, "done");
    }
    const [revokedSheet, liveSheet] = made as [OwnerOfflineCodeSheet, OwnerOfflineCodeSheet];
    pass("owner 1 generated and registered two sheets through the real 6H flow");

    const list = createOwnerSheetListFlow({ client: client(first), randomUUID,
      verifyFreshMfa: async () => { await verifyTotp(first); return true; } });
    await list.load();
    const listed = list.getState().sheets.filter((sheet) =>
      made.some((entry) => entry.registration.locatorRecordId === sheet.locatorRecordId));
    assert.deepEqual(listed.map((sheet) => sheet.status), ["active", "active"]);
    pass("owner 1's list shows both sheets as active");

    await nextTotpWindow(); await verifyTotp(first);
    list.requestRevoke(revokedSheet.registration.locatorRecordId); await list.confirmRevoke();
    if (list.getState().status === "needs_fresh_mfa") { await nextTotpWindow(); await list.submitMfaCode("fresh"); }
    const afterRevoke = list.getState();
    assert.equal(afterRevoke.revoked, true);
    assert.equal(afterRevoke.sheets.find((sheet) =>
      sheet.locatorRecordId === revokedSheet.registration.locatorRecordId)?.status, "revoked");
    assert.equal(afterRevoke.sheets.find((sheet) =>
      sheet.locatorRecordId === liveSheet.registration.locatorRecordId)?.status, "active");
    pass("owner 1 revoked one sheet after a fresh TOTP, and the list shows it as revoked");

    const secondList = await client(second).list();
    assert.equal(secondList.length, 0);
    await assert.rejects(client(second).revoke(liveSheet.registration.locatorRecordId, randomUUID()));
    pass("owner 2 sees none of owner 1's sheets and cannot revoke them");

    await claimantChecks(hosted, bypassFetch, revokedSheet, liveSheet);
    await concealmentChecks(hosted, bypassFetch, await accessToken(first));
  } finally {
    await Promise.allSettled(owners.map((owner) => owner.client.auth.signOut()));
    await cleanup({ apply: true, token: supabaseToken, projectRef, log: (line) => console.log(line) });
  }
  console.log(`\nClaimant Preview acceptance passed (${results.length} checks).`);
}

main().catch((error: unknown) => {
  console.error(`FAIL ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
