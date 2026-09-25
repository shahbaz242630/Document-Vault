import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { OfflineCodeV2SyntheticAttempt } from "../claimant-offline-code/offline-code-v2-coordinator";
import { completion, id, session as portalSession, signature, transcript } from "../claimant-handoff/fixtures.test";
import type { HandoffSend } from "../claimant-handoff/transport";
import type { PortalSessionSend } from "../claimant-session/portal-session-client";
import type { createClaimantRuntimeFoundation } from "./runtime-foundation";

export const unavailable = { name: "ClaimantRuntimeFoundationUnavailableError",
  message: "Claimant runtime foundation is unavailable." };
export const issuer = "https://identity.sanduqkin.test";
export const keyAlias = "claimant-handoff.test.v1.synthetic_key_001";
const keyFingerprint = "B".repeat(43);
export type Options = Parameters<typeof createClaimantRuntimeFoundation>[0];

export function portalResponse(result: unknown) {
  return Response.json({ result }, { headers: { "Access-Control-Allow-Origin": "https://app.sanduqkin.test",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" } });
}

export function harness() {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(),
    "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as {
      public_locator: OfflineCodeV2SyntheticAttempt["publicLocator"];
      synthetic_client_secret: OfflineCodeV2SyntheticAttempt["clientSecret"];
      kdf_profile: OfflineCodeV2SyntheticAttempt["kdfProfile"];
      record_binding: OfflineCodeV2SyntheticAttempt["recordBinding"];
      challenge: OfflineCodeChallengeV2; possession_proof: OfflineCodePossessionProofV2;
    };
  let time = Date.parse(fixture.challenge.issued_at) + 1_000;
  const authenticated = Object.freeze({ syntheticOnly: true as const, status: "authenticated" as const,
    userId: portalSession.userId, sessionId: portalSession.sessionId, accessToken: portalSession.accessToken,
    aal: "aal2" as const, recovery: false as const, expiresAt: time + 600_000, assuredAt: time,
    issuer, audience: "authenticated" as const });
  const subscriptions = { auth: 0, lifecycle: 0 };
  const authCleanup = vi.fn();
  const lifecycleCleanup = vi.fn();
  const authListeners = new Set<(value: unknown) => void>();
  const lifecycleListeners = new Set<(value: unknown) => void>();
  let lifecycle = { sequence: 0, state: "foreground" };
  const provider = { syntheticOnly: true as const, subscribe(listener: (value: unknown) => void) {
    subscriptions.auth += 1; authListeners.add(listener); listener(authenticated);
    return () => { authCleanup(); authListeners.delete(listener); };
  } };
  const lifecycleSource = { subscribe(listener: (value: unknown) => void) {
    subscriptions.lifecycle += 1; lifecycleListeners.add(listener); listener(lifecycle);
    return () => { lifecycleCleanup(); lifecycleListeners.delete(listener); };
  } };
  const portalResults = {
    activate: { context: "claimant_portal", sessionVersion: 1, displacedPrevious: false, replayed: false },
    assert: { context: "claimant_portal", sessionVersion: 1 },
    revoke: { context: "claimant_portal", sessionVersion: 1, revoked: true, replayed: false },
  } as const;
  const portalSend = vi.fn<PortalSessionSend>(async (url) =>
    portalResponse(portalResults[url.split("/").at(-1) as keyof typeof portalResults]));
  const proofResult = { status: "proof_verified", authority: "route_possession_only",
    route_possession_asserted: true, identity_verified: false, claim_created: false, release_authorized: false };
  const possessionResponse = (proof: boolean) => Response.json({ result: proof ? proofResult : {
    status: "challenge_issued", authority: "route_possession_only", challenge: fixture.challenge,
    challenge_bytes_base64url: Buffer.from(canonicalJson(fixture.challenge as never)).toString("base64url"),
    kdf_profile: fixture.kdf_profile, identity_verified: false, claim_created: false, release_authorized: false,
  } }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": fixture.challenge.origin } });
  const possessionSend = vi.fn<typeof fetch>(async (url) => possessionResponse(String(url).endsWith("/proofs")));
  const sourceTranscript = { ...transcript, claimant_user_id: authenticated.userId,
    portal_session_id: authenticated.sessionId, portal_session_version: 1,
    source_challenge_id: fixture.challenge.challenge_id,
    record_binding_digest: fixture.challenge.record_binding_digest, expires_at_epoch: (time + 120_000) / 1000 };
  const issued = { handoff_id: id(6),
    transcript_bytes_base64url: Buffer.from(JSON.stringify(sourceTranscript)).toString("base64url"),
    expires_at: new Date(time + 120_000).toISOString(), authority: "route_possession_only",
    identity_verified: false, claim_created: false, release_authorized: false };
  const handoffResponse = (result: unknown) => Response.json({ result }, { headers: {
    "Cache-Control": "private, no-store", "Access-Control-Allow-Origin": fixture.challenge.origin,
    "X-Robots-Tag": "noindex, nofollow" } });
  const handoffSend = vi.fn<HandoffSend>(async (url) => handoffResponse(url.endsWith("/issue") ? issued : completion));
  const producer = { produce: vi.fn(async () => fixture.possession_proof) };
  const nativeResult = { synthetic_only: true, status: "signed",
    signature, key_alias_reference: keyAlias, key_fingerprint: keyFingerprint,
    user_presence: "verified", private_key_exportable: false } as const;
  const signClaimantHandoffAsync = vi.fn(async (_value: unknown) => nativeResult);
  const native = { syntheticOnly: true as const, signClaimantHandoffAsync };
  const possession = { syntheticOnly: true as const, publicLocator: fixture.public_locator,
    clientSecret: fixture.synthetic_client_secret, kdfProfile: fixture.kdf_profile,
    recordBinding: fixture.record_binding, challengeIdempotencyKey: id(91), proofIdempotencyKey: id(92) };
  const attempt = { possession, issueIdempotencyKey: id(93), completionIdempotencyKey: id(94) };
  const options: Options = { approved: true, syntheticOnly: true, productionRuntime: false,
    identity: { expectedIssuer: issuer, provider, now: () => time },
    signing: { keyAliasReference: keyAlias, keyFingerprint, native },
    journey: { lifecycle: lifecycleSource, now: () => time,
      portal: { apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin, send: portalSend },
      bridge: { apiOrigin: "https://api.sanduqkin.test", claimantOrigin: fixture.challenge.origin,
        possessionSend, handoffSend, producer } } };
  return { options, attempt, authenticated, portalResults, portalSend, possessionSend, possessionResponse, handoffSend,
    handoffResponse, issued, producer, native, nativeResult, signClaimantHandoffAsync, authCleanup,
    lifecycleCleanup, subscriptionCounts: () => ({ ...subscriptions }), listenerCounts: () => ({ auth: authListeners.size, lifecycle: lifecycleListeners.size }),
    emitAuth: (value: unknown) => { for (const listener of authListeners) listener(value); },
    emitLifecycle: (state: string) => { lifecycle = { sequence: lifecycle.sequence + 1, state };
      for (const listener of lifecycleListeners) listener(lifecycle); } };
}

describe("synthetic claimant runtime harness", () => {
  it("stays synthetic, non-production and bound to one test identity", () => {
    const h = harness();
    expect(h.options).toMatchObject({ syntheticOnly: true, productionRuntime: false,
      identity: { expectedIssuer: issuer }, signing: { keyAliasReference: keyAlias } });
    expect(h.native.syntheticOnly).toBe(true);
    expect(h.listenerCounts()).toEqual({ auth: 0, lifecycle: 0 });
  });
});
