import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createRequire } from "node:module";

import { Hono } from "hono";

import { createOfflineCodeV2HandoffController }
  from "../src/claimant/offline-code-v2-handoff-controller.js";
import { createOfflineCodeV2HandoffService }
  from "../src/claimant/offline-code-v2-handoff-service.js";
import { createOfflineCodeV2HandoffTransactionClient }
  from "../src/claimant/offline-code-v2-handoff-transaction-client.js";
import { getClaimantRuntimeConfig } from "../src/claimant/runtime-config.js";

const require = createRequire(import.meta.url);
const { buildOfflineCodeV2CaseBindingDbTestSql } = require(
  "../../../scripts/claimant-offline-code-v2-case-binding-db-test.cjs") as {
    buildOfflineCodeV2CaseBindingDbTestSql(options: unknown): string;
  };
const container = process.env.SANDUQKIN_SUPABASE_DB_CONTAINER || "supabase_db_supabase";
const claimantOrigin = "https://claimant.synthetic.test";
const apiOrigin = "https://api.synthetic.test";
const names = ["owner", "claimant", "other", "session", "otherSession", "locator", "challenge",
  "grant", "case", "otherCase", "key", "otherKey"] as const;
const ids = Object.fromEntries(names.map((name) => [name, randomUUID()])) as Record<(typeof names)[number], string>;
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64url");
let lastRpcFailure = "none";

function psql(sql: string) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d",
    "postgres", "-v", "ON_ERROR_STOP=1", "-qtA"], { encoding: "utf8", input: sql }).trim();
}
function quote(value: unknown) {
  if (value === null) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}
function rpc(name: string, input: Record<string, unknown>) {
  try {
    const args = ["p_action", "p_claimant_user_id", "p_portal_session_id", "p_request_id",
      "p_idempotency_key", "p_verified_transcript_digest", "p_signature_digest"]
      .map((key) => quote(input[key])).join(",");
    const data = JSON.parse(psql(`begin; set local role service_role;
      select public.${name}(${args}); commit;`));
    return Promise.resolve({ data, error: null });
  } catch (error) {
    lastRpcFailure = error instanceof Error ? error.message.replaceAll(/[0-9a-f]{8}-[0-9a-f-]{27,}/giu, "<uuid>")
      : "database rejected";
    return Promise.resolve({ data: null, error: { code: "database_rejected" } });
  }
}

async function main() {
  let fixture = buildOfflineCodeV2CaseBindingDbTestSql({ id: ids, fixtureOnly: true });
  fixture = fixture.split(`${"P".repeat(42)}Q`).join(publicKey);
  psql(fixture);
  try {
    const session = (other: boolean) => ({ userId: other ? ids.other : ids.claimant,
      sessionId: other ? ids.otherSession : ids.session, aal: "aal2" as const,
      issuedAt: Math.floor(Date.now() / 1000) - 15, expiresAt: Math.floor(Date.now() / 1000) + 300,
      amr: [{ method: "totp", timestamp: Math.floor(Date.now() / 1000) - 15 }] });
    const portal = { getSession: async (token: string) => session(token === "other-token"),
      assert: async (userId: string) => ({ context: "claimant_portal" as const, sessionVersion: 1,
        ...(userId === ids.claimant || userId === ids.other ? {} : { revoked: true }) }) };
    const transaction = createOfflineCodeV2HandoffTransactionClient(rpc);
    const service = createOfflineCodeV2HandoffService({ approved: true, portal, transaction });
    const controllerDeps = { approved: true, service, config: { apiOrigin, claimantOrigin },
      runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
        CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true" }) };
    const app = new Hono();
    app.post("/claimant/offline-code/v2/handoffs/issue",
      createOfflineCodeV2HandoffController("issue", controllerDeps));
    app.post("/claimant/offline-code/v2/handoffs/complete",
      createOfflineCodeV2HandoffController("complete", controllerDeps));
    const issue = await app.request(`${apiOrigin}/claimant/offline-code/v2/handoffs/issue`, request(
      "claimant-token", randomUUID(), { challengeId: ids.challenge }));
    if (issue.status !== 200) throw new Error(`Issue failed: ${issue.status}; RPC: ${lastRpcFailure}`);
    const issued = (await issue.json() as { result: { handoff_id: string; transcript_bytes_base64url: string } }).result;
    const oldSignature = sign(null, Buffer.from("anonymous-possession-proof"), keys.privateKey)
      .toString("base64url");
    const rejected = await app.request(`${apiOrigin}/claimant/offline-code/v2/handoffs/complete`,
      request("claimant-token", randomUUID(), { handoffId: issued.handoff_id, signature: oldSignature }));
    if (rejected.status !== 403) throw new Error("Old proof-domain signature was accepted.");
    const signature = sign(null, Buffer.from(issued.transcript_bytes_base64url, "base64url"), keys.privateKey)
      .toString("base64url");
    const completionKey = randomUUID();
    const complete = await app.request(`${apiOrigin}/claimant/offline-code/v2/handoffs/complete`,
      request("claimant-token", completionKey, { handoffId: issued.handoff_id, signature }));
    const completed = await complete.json() as { result?: Record<string, unknown> };
    if (complete.status !== 200 || completed.result?.state !== "draft"
      || completed.result.release_authorized !== false) throw new Error("Valid handoff did not create a safe draft.");
    const replay = await app.request(`${apiOrigin}/claimant/offline-code/v2/handoffs/complete`,
      request("claimant-token", completionKey, { handoffId: issued.handoff_id, signature }));
    if (replay.status !== 200 || (await replay.json() as { result: { replayed: boolean } }).result.replayed !== true)
      throw new Error("Exact completion replay was not stable.");
    const crossAccount = await app.request(`${apiOrigin}/claimant/offline-code/v2/handoffs/complete`,
      request("other-token", randomUUID(), { handoffId: issued.handoff_id, signature }));
    if (crossAccount.status !== 403) throw new Error("Cross-account completion was accepted.");
    console.log("Claimant offline-code V2 handoff database acceptance passed.");
  } finally {
    psql(`begin;
      delete from public.claimant_offline_code_v2_handoffs where source_challenge_id = '${ids.challenge}';
      delete from public.claimant_audit_events where actor_user_id in ('${ids.claimant}','${ids.other}');
      delete from public.claimant_idempotency_records where actor_user_id in ('${ids.claimant}','${ids.other}');
      delete from public.claimant_cases where offline_code_v2_locator_record_id = '${ids.locator}';
      delete from public.claimant_identities where user_id in ('${ids.claimant}','${ids.other}');
      delete from public.claimant_offline_code_v2_events where locator_record_id = '${ids.locator}';
      delete from public.claimant_offline_code_v2_challenges where id = '${ids.challenge}';
      delete from public.claimant_offline_code_v2_locators where id = '${ids.locator}';
      delete from public.claimant_portal_session_controls where user_id in ('${ids.claimant}','${ids.other}');
      delete from public.claimant_portal_eligibilities where user_id in ('${ids.claimant}','${ids.other}');
      delete from auth.users where id in ('${ids.claimant}','${ids.other}','${ids.owner}'); commit;`);
  }
}
function request(token: string, key: string, body: unknown) { return { method: "POST", headers: {
  Origin: claimantOrigin, Authorization: `Bearer ${token}`, "Content-Type": "application/json",
  "Idempotency-Key": key }, body: JSON.stringify(body) }; }

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1; });
