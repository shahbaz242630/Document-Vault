import { createHash, generateKeyPairSync, sign } from "node:crypto";

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { createHandoffCoordinator } from "../../../../apps/mobile/src/features/claimant-handoff/coordinator";
import { createHandoffTransport, type HandoffSend } from "../../../../apps/mobile/src/features/claimant-handoff/transport";

import { createOfflineCodeV2HandoffRoute } from "./offline-code-v2-handoff-routes.js";
import { createOfflineCodeV2HandoffTransactionClient } from "./offline-code-v2-handoff-transaction-client.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const now = Date.parse("2026-09-05T12:00:00.000Z");
const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const apiOrigin = "https://api.sanduqkin.test";
const claimantOrigin = "https://claimant.sanduqkin.test";
const digest = "A".repeat(43);

function fixture(options: { oldDomain?: boolean; loseCompletion?: boolean; wrongAccount?: boolean } = {}) {
  const keys = generateKeyPairSync("ed25519");
  const transcript = JSON.stringify({ protocol: "sanduqkin:claim:offline-code:v2", purpose: "authenticated_case_handoff",
    label: "sanduqkin:claim:offline-code:v2:authenticated-handoff:v1", handoff_id: id(6), case_id: id(7),
    claimant_user_id: id(4), portal_session_id: id(5), portal_session_version: 1, source_challenge_id: id(1),
    record_binding_digest: digest, expires_at_epoch: (now + 120_000) / 1000, nonce: "a".repeat(64) });
  const bytes = Buffer.from(transcript);
  const evidence = { handoff_id: id(6), case_id: id(7), claimant_user_id: id(4), portal_session_id: id(5),
    portal_session_version: 1, source_challenge_id: id(1),
    proof_public_key: keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64url"),
    expires_at: new Date(now + 120_000).toISOString(), transcript_bytes_base64url: bytes.toString("base64url"),
    transcript_digest: createHash("sha256").update(bytes).digest("base64url"), authority: "route_possession_only",
    identity_verified: false, claim_created: false, release_authorized: false, synthetic_only: true };
  let consumed = false;
  const rpc = vi.fn(async (_name: string, value: Record<string, unknown>) => {
    if (value.p_action !== "consume") return { data: evidence, error: null };
    const replayed = consumed; consumed = true;
    return { data: { case_id: id(7), case_version: 1, state: "draft", route_profile: "offline_code_v2",
      authority: "route_possession_only", claimant_session_bound: true, case_created: true, identity_verified: false,
      relationship_verified: false, intake_started: false, review_started: false, release_authorized: false, replayed }, error: null };
  });
  const portal = { getSession: vi.fn(async () => ({ userId: options.wrongAccount ? id(8) : id(4), sessionId: id(5),
    aal: "aal2" as const, issuedAt: now / 1000 - 30, expiresAt: now / 1000 + 600,
    amr: [{ method: "totp", timestamp: now / 1000 }] })),
  assert: vi.fn(async () => ({ context: "claimant_portal" as const, sessionVersion: 1 })),
  activate: vi.fn(async () => { throw new Error("Unexpected session activation."); }),
  revoke: vi.fn(async () => { throw new Error("Unexpected session revocation."); }) };
  const deps = { approved: true, now: () => now,
    runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true" }),
    getConfig: () => ({ apiOrigin, claimantOrigin, supabaseUrl: "https://database.sanduqkin.test", serviceRoleKey: "synthetic" }),
    createPortalClient: () => portal,
    createTransactionClient: () => createOfflineCodeV2HandoffTransactionClient(rpc) };
  const app = new Hono();
  app.post("/claimant/offline-code/v2/handoffs/issue", createOfflineCodeV2HandoffRoute("issue", deps));
  app.post("/claimant/offline-code/v2/handoffs/complete", createOfflineCodeV2HandoffRoute("complete", deps));
  let lost = false;
  const send = vi.fn<HandoffSend>(async (url, init) => {
    const response = await app.request(url, init);
    if (options.loseCompletion && url.endsWith("/complete") && !lost && response.status === 200) {
      lost = true; await response.body?.cancel(); throw new Error("synthetic lost response");
    }
    return response;
  });
  const signer = { syntheticOnly: true as const, sign: vi.fn(async (value: { transcriptBytesBase64url: string }) =>
    sign(null, options.oldDomain ? Buffer.from("anonymous-possession-proof")
      : Buffer.from(value.transcriptBytesBase64url, "base64url"), keys.privateKey).toString("base64url")) };
  const client = createHandoffCoordinator({ approved: true, now: () => now, signer,
    getSession: () => ({ userId: id(4), sessionId: id(5), sessionVersion: 1, accessToken: "synthetic-token",
      context: "claimant_portal", aal: "aal2", recovery: false, expiresAt: now + 600_000, assuredAt: now }),
    transport: createHandoffTransport({ approved: true, apiOrigin, claimantOrigin, send }) });
  return { client, rpc, signer, send, portal, bytes };
}
const attempt = { syntheticOnly: true as const, challengeId: id(1), recordBindingDigest: digest,
  issueIdempotencyKey: id(2), completionIdempotencyKey: id(3) };
describe("synthetic mobile handoff through Hono and real Ed25519 verification", () => {
  it("completes via the actual route, service and RPC adapter", async () => {
    const f = fixture();
    expect(await f.client.start(attempt)).toMatchObject({ case_id: id(7), state: "draft", replayed: false,
      identity_verified: false, intake_started: false, review_started: false, release_authorized: false });
    expect(f.portal.getSession).toHaveBeenCalledWith("synthetic-token");
    expect(f.signer.sign.mock.calls[0][0].transcriptBytesBase64url).toBe(f.bytes.toString("base64url"));
    expect(f.rpc).toHaveBeenLastCalledWith("claimant_offline_code_v2_handoff", expect.objectContaining({
      p_action: "consume", p_claimant_user_id: id(4), p_portal_session_id: id(5), p_idempotency_key: id(3) }));
  });
  it("replays an identical completion after the committed response is lost", async () => {
    const f = fixture({ loseCompletion: true });
    await expect(f.client.start(attempt)).rejects.toThrow("Offline-code handoff is unavailable.");
    expect(await f.client.retryCompletion()).toMatchObject({ case_id: id(7), replayed: true });
    const calls = f.send.mock.calls.filter(([url]) => url.endsWith("/complete"));
    expect(calls[0][1]?.body).toBe(calls[1][1]?.body);
    expect(calls[0][1]?.headers).toEqual(calls[1][1]?.headers);
    expect(f.signer.sign).toHaveBeenCalledOnce();
  });
  it.each([{ oldDomain: true }, { wrongAccount: true }])("rejects invalid possession/session %j", async (options) => {
    const f = fixture(options);
    await expect(f.client.start(attempt)).rejects.toThrow("Offline-code handoff is unavailable.");
    expect(f.rpc.mock.calls.some(([, value]) => value.p_action === "consume")).toBe(false);
    await expect(f.client.retryCompletion()).rejects.toThrow("Offline-code handoff is unavailable.");
  });
});
