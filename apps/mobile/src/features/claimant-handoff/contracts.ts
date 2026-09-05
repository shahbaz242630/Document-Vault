import { Buffer } from "buffer";
import { z } from "zod";

export const uuid = z.string().uuid();
const digest = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u);
export const signatureSchema = z.string().regex(/^[A-Za-z0-9_-]{85}[AQgw]$/u);
export const sessionSchema = z.strictObject({
  userId: uuid, sessionId: uuid, sessionVersion: z.number().int().positive(),
  accessToken: z.string().min(1).max(8192).regex(/^[^\s,]+$/u),
  context: z.literal("claimant_portal"), aal: z.literal("aal2"), recovery: z.literal(false),
  expiresAt: z.number().finite(), assuredAt: z.number().finite(),
});
export type HandoffSession = Readonly<z.infer<typeof sessionSchema>>;
export const attemptSchema = z.strictObject({
  syntheticOnly: z.literal(true), challengeId: uuid, recordBindingDigest: digest,
  issueIdempotencyKey: uuid, completionIdempotencyKey: uuid,
});
export type HandoffAttempt = Readonly<z.infer<typeof attemptSchema>>;
export const issueSchema = z.strictObject({
  handoff_id: uuid, transcript_bytes_base64url: z.string().regex(/^[A-Za-z0-9_-]{128,8192}$/u),
  expires_at: z.string().datetime({ offset: true }), authority: z.literal("route_possession_only"),
  identity_verified: z.literal(false), claim_created: z.literal(false), release_authorized: z.literal(false),
});
export type HandoffIssued = Readonly<z.infer<typeof issueSchema>>;
export const completionSchema = z.strictObject({
  case_id: uuid, case_version: z.literal(1), state: z.literal("draft"),
  route_profile: z.literal("offline_code_v2"), authority: z.literal("route_possession_only"),
  claimant_session_bound: z.literal(true), case_created: z.literal(true),
  identity_verified: z.literal(false), relationship_verified: z.literal(false),
  intake_started: z.literal(false), review_started: z.literal(false), release_authorized: z.literal(false),
  replayed: z.boolean(),
});
export type HandoffCompletion = Readonly<z.infer<typeof completionSchema>>;
const transcriptSchema = z.strictObject({
  protocol: z.literal("sanduqkin:claim:offline-code:v2"), purpose: z.literal("authenticated_case_handoff"),
  label: z.literal("sanduqkin:claim:offline-code:v2:authenticated-handoff:v1"),
  handoff_id: uuid, case_id: uuid, claimant_user_id: uuid, portal_session_id: uuid,
  portal_session_version: z.number().int().positive(), source_challenge_id: uuid,
  record_binding_digest: digest, expires_at_epoch: z.number().positive(),
  nonce: z.string().regex(/^[a-f0-9]{64}$/u),
});

export class HandoffUnavailableError extends Error {
  constructor(readonly retryable = false) {
    super("Offline-code handoff is unavailable.");
    this.name = "HandoffUnavailableError";
  }
}
export function assertOrigin(value: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value || value.length > 300) throw new HandoffUnavailableError();
}
// Session metadata is a local consistency check; the API independently verifies all authority.
export function validateSession(value: unknown, now: number): HandoffSession {
  const session = sessionSchema.parse(value);
  if (!Number.isFinite(now) || session.expiresAt <= now || session.assuredAt > now + 60_000
    || now - session.assuredAt > 600_000) throw new HandoffUnavailableError();
  return Object.freeze(session);
}
export function validateTranscript(value: unknown, attempt: HandoffAttempt, session: HandoffSession, now: number) {
  const issued = issueSchema.parse(value);
  const encoded = issued.transcript_bytes_base64url;
  const bytes = Buffer.from(encoded.replace(/-/gu, "+").replace(/_/gu, "/"), "base64");
  const canonical = bytes.toString("base64").replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
  if (canonical !== encoded) throw new HandoffUnavailableError();
  const transcript = transcriptSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  const expiresAt = Date.parse(issued.expires_at);
  if (!Number.isFinite(now) || expiresAt <= now || expiresAt > now + 120_000
    || Math.abs(transcript.expires_at_epoch * 1000 - expiresAt) >= 1
    || transcript.handoff_id !== issued.handoff_id || transcript.claimant_user_id !== session.userId
    || transcript.portal_session_id !== session.sessionId || transcript.portal_session_version !== session.sessionVersion
    || transcript.source_challenge_id !== attempt.challengeId
    || transcript.record_binding_digest !== attempt.recordBindingDigest) throw new HandoffUnavailableError();
  return Object.freeze({ issued: Object.freeze(issued), caseId: transcript.case_id, expiresAt });
}
