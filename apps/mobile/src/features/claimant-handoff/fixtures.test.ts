import { Buffer } from "buffer";
import { describe, expect, it } from "vitest";

import { validateTranscript } from "./contracts";

export const now = Date.parse("2026-09-05T12:00:00.000Z");
export const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const attempt = { syntheticOnly: true as const, challengeId: id(1), recordBindingDigest: "A".repeat(43),
  issueIdempotencyKey: id(2), completionIdempotencyKey: id(3) };
export const session = { userId: id(4), sessionId: id(5), sessionVersion: 1, accessToken: "synthetic-token",
  context: "claimant_portal" as const, aal: "aal2" as const, recovery: false as const,
  expiresAt: now + 600_000, assuredAt: now };
export const transcript = { protocol: "sanduqkin:claim:offline-code:v2", purpose: "authenticated_case_handoff",
  label: "sanduqkin:claim:offline-code:v2:authenticated-handoff:v1", handoff_id: id(6), case_id: id(7),
  claimant_user_id: session.userId, portal_session_id: session.sessionId, portal_session_version: 1,
  source_challenge_id: attempt.challengeId, record_binding_digest: attempt.recordBindingDigest,
  expires_at_epoch: (now + 120_000) / 1000, nonce: "a".repeat(64) };
export function issue(value: unknown = transcript) {
  return { handoff_id: id(6), transcript_bytes_base64url: Buffer.from(JSON.stringify(value)).toString("base64")
    .replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, ""),
  expires_at: new Date(now + 120_000).toISOString(), authority: "route_possession_only" as const,
  identity_verified: false as const, claim_created: false as const, release_authorized: false as const };
}
export const completion = { case_id: id(7), case_version: 1 as const, state: "draft" as const,
  route_profile: "offline_code_v2" as const, authority: "route_possession_only" as const,
  claimant_session_bound: true as const, case_created: true as const, identity_verified: false as const,
  relationship_verified: false as const, intake_started: false as const, review_started: false as const,
  release_authorized: false as const, replayed: false };
export const signature = "A".repeat(86);
export const apiOrigin = "https://api.sanduqkin.test";
export const claimantOrigin = "https://claimant.sanduqkin.test";
export function response(result: unknown = issue(), headers: Record<string, string> = {}) {
  return Response.json({ result }, { headers: { "Cache-Control": "private, no-store",
    "Access-Control-Allow-Origin": claimantOrigin, "X-Robots-Tag": "noindex, nofollow", ...headers } });
}
describe("synthetic handoff fixture", () => {
  it("matches the established transcript contract", () => {
    expect(validateTranscript(issue(), attempt, session, now).caseId).toBe(id(7));
  });
});
