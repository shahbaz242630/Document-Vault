import { createHash, generateKeyPairSync, sign } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createOfflineCodeV2HandoffService }
  from "./offline-code-v2-handoff-service.js";

const now = Date.parse("2026-09-04T07:00:00.000Z");
const actor = { userId: id("01"), sessionId: id("02"), sessionVersion: 3 };

describe("offline-code V2 authenticated handoff service", () => {
  it("is disabled before reading authentication or persistence", async () => {
    const deps = fixture();
    const service = createOfflineCodeV2HandoffService({ ...deps, approved: false });
    await expect(service.issue("jwt", id("08"), { challengeId: id("03") })).rejects.toThrow(
      "Offline-code handoff is unavailable.");
    expect(deps.portal.getSession).not.toHaveBeenCalled();
    expect(deps.transaction.evidence).not.toHaveBeenCalled();
  });

  it("binds a fresh authenticated session and verifies the exact Ed25519 transcript", async () => {
    const deps = fixture(); const service = createOfflineCodeV2HandoffService(deps);
    const issued = await service.issue("jwt", id("08"), { challengeId: id("03") });
    expect(issued).toMatchObject({ handoff_id: id("04"), authority: "route_possession_only",
      identity_verified: false, claim_created: false, release_authorized: false });
    expect(issued).not.toHaveProperty("case_id");
    const signature = sign(null, Buffer.from(issued.transcript_bytes_base64url, "base64url"),
      deps.privateKey).toString("base64url");
    await expect(service.complete("jwt", id("09"), { handoffId: id("04"), signature }))
      .resolves.toMatchObject({ case_id: id("05"), state: "draft", release_authorized: false });
    expect(deps.transaction.consume).toHaveBeenCalledWith(actor, deps.evidence, id("09"),
      createHash("sha256").update(Buffer.from(signature, "base64url")).digest("base64url"));
  });

  it("rejects the old proof-domain signature, extra authority, and stale assurance", async () => {
    const deps = fixture(); const service = createOfflineCodeV2HandoffService(deps);
    const oldSignature = sign(null, Buffer.from("anonymous-possession-proof"), deps.privateKey)
      .toString("base64url");
    await expect(service.complete("jwt", id("09"), { handoffId: id("04"), signature: oldSignature }))
      .rejects.toThrow("Offline-code handoff is unavailable.");
    await expect(service.issue("jwt", id("08"), { challengeId: id("03"), caseId: id("05") }))
      .rejects.toThrow("Offline-code handoff is unavailable.");
    deps.portal.getSession.mockResolvedValueOnce({ ...session(), aal: "aal1" });
    await expect(service.issue("jwt", id("08"), { challengeId: id("03") })).rejects.toThrow();
    deps.portal.getSession.mockResolvedValueOnce({ ...session(),
      amr: [{ method: "recovery", timestamp: Math.floor(now / 1000) }] });
    await expect(service.issue("jwt", id("08"), { challengeId: id("03") })).rejects.toThrow();
  });
});

function fixture() {
  const keys = generateKeyPairSync("ed25519");
  const raw = keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64url");
  const transcript = JSON.stringify({ protocol: "sanduqkin:claim:offline-code:v2",
    purpose: "authenticated_case_handoff", label: "sanduqkin:claim:offline-code:v2:authenticated-handoff:v1",
    handoff_id: id("04"), case_id: id("05"), claimant_user_id: actor.userId,
    portal_session_id: actor.sessionId, portal_session_version: 3, source_challenge_id: id("03"),
    record_binding_digest: digest("B"), expires_at_epoch: (now + 60_000) / 1000,
    nonce: "a".repeat(64) });
  const bytes = Buffer.from(transcript);
  const evidence = { handoff_id: id("04"), case_id: id("05"), claimant_user_id: actor.userId,
    portal_session_id: actor.sessionId, portal_session_version: 3, source_challenge_id: id("03"),
    proof_public_key: raw, expires_at: new Date(now + 60_000).toISOString(),
    transcript_bytes_base64url: bytes.toString("base64url"),
    transcript_digest: createHash("sha256").update(bytes).digest("base64url"),
    authority: "route_possession_only" as const, identity_verified: false as const,
    claim_created: false as const, release_authorized: false as const, synthetic_only: true as const };
  return { approved: true, now: () => now, privateKey: keys.privateKey, evidence,
    portal: { getSession: vi.fn(async () => session()), assert: vi.fn(async () => ({
      context: "claimant_portal" as const, sessionVersion: 3 })) },
    transaction: { evidence: vi.fn(async () => evidence), consume: vi.fn(async () => result()) } };
}
function session(): { userId: string; sessionId: string; aal: "aal1" | "aal2"; issuedAt: number;
  expiresAt: number; amr: { method: string; timestamp: number }[] } { return {
  userId: actor.userId, sessionId: actor.sessionId, aal: "aal2",
  issuedAt: Math.floor(now / 1000) - 30, expiresAt: Math.floor(now / 1000) + 300,
  amr: [{ method: "totp", timestamp: Math.floor(now / 1000) - 30 }] }; }
function result() { return { case_id: id("05"), case_version: 1 as const, state: "draft" as const,
  route_profile: "offline_code_v2" as const, authority: "route_possession_only" as const,
  claimant_session_bound: true as const, case_created: true as const, identity_verified: false as const,
  relationship_verified: false as const, intake_started: false as const, review_started: false as const,
  release_authorized: false as const, replayed: false }; }
function id(suffix: string) { return `10000000-0000-4000-8000-0000000000${suffix}`; }
function digest(character: string) { return `${character.repeat(42)}Q`; }
