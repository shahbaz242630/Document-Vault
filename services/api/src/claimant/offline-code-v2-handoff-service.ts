import { createHash, createPublicKey, verify } from "node:crypto";

import { z } from "zod";

import type { HandoffActor, HandoffEvidence, HandoffTransaction }
  from "./offline-code-v2-handoff-transaction-client.js";
import type { ClaimantPortalSessionClient } from "./portal-session-client.js";
import { requireFreshClaimantAssurance } from "./session-assurance.js";

export const CLAIMANT_OFFLINE_CODE_V2_HANDOFF_APPROVED = false as const;
export const handoffIssueSchema = z.strictObject({ challengeId: z.string().uuid() });
export const handoffCompleteSchema = z.strictObject({ handoffId: z.string().uuid(),
  signature: z.string().regex(/^[A-Za-z0-9_-]{85}[AQgw]$/u) });
const sessionSchema = z.strictObject({
  userId: z.string().uuid(), sessionId: z.string().uuid(), aal: z.enum(["aal1", "aal2"]),
  issuedAt: z.number().int().positive(), expiresAt: z.number().int().positive(),
  amr: z.array(z.strictObject({ method: z.string(), timestamp: z.number().int().nonnegative() })),
});
type Deps = Readonly<{
  approved?: boolean;
  portal: Pick<ClaimantPortalSessionClient, "getSession" | "assert">;
  transaction: HandoffTransaction;
  now?: () => number;
}>;
export class OfflineCodeV2HandoffError extends Error {
  constructor() { super("Offline-code handoff is unavailable."); this.name = "OfflineCodeV2HandoffError"; }
}

export function createOfflineCodeV2HandoffService(deps: Deps) {
  const now = deps.now ?? Date.now;
  async function actor(jwt: string): Promise<HandoffActor> {
    if (!(deps.approved ?? CLAIMANT_OFFLINE_CODE_V2_HANDOFF_APPROVED)) throw new OfflineCodeV2HandoffError();
    const session = sessionSchema.parse(await deps.portal.getSession(jwt));
    if (session.issuedAt > Math.floor(now() / 1000) + 60) throw new OfflineCodeV2HandoffError();
    requireFreshClaimantAssurance(session, Math.floor(now() / 1000));
    const portal = await deps.portal.assert(session.userId, session.sessionId);
    if (portal.context !== "claimant_portal" || portal.revoked === true
      || !Number.isSafeInteger(portal.sessionVersion) || portal.sessionVersion < 1) {
      throw new OfflineCodeV2HandoffError();
    }
    return { userId: session.userId, sessionId: session.sessionId, sessionVersion: portal.sessionVersion };
  }
  return {
    async issue(jwt: string, key: string, body: unknown) {
      try {
        const auth = await actor(jwt);
        const input = handoffIssueSchema.parse(body); z.string().uuid().parse(key);
        const evidence = await deps.transaction.evidence("issue", auth, input.challengeId, key);
        validateTranscript(evidence, now());
        return { handoff_id: evidence.handoff_id,
          transcript_bytes_base64url: evidence.transcript_bytes_base64url,
          expires_at: evidence.expires_at, authority: "route_possession_only" as const,
          identity_verified: false as const, claim_created: false as const, release_authorized: false as const };
      } catch { throw new OfflineCodeV2HandoffError(); }
    },
    async complete(jwt: string, key: string, body: unknown) {
      try {
        const auth = await actor(jwt);
        const input = handoffCompleteSchema.parse(body); z.string().uuid().parse(key);
        const evidence = await deps.transaction.evidence("load", auth, input.handoffId, key);
        const transcript = validateTranscript(evidence, now());
        const signature = Buffer.from(input.signature, "base64url");
        const publicKey = createPublicKey({ key: Buffer.concat([
          Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(evidence.proof_public_key, "base64url"),
        ]), format: "der", type: "spki" });
        if (!verify(null, transcript, publicKey, signature)) throw new OfflineCodeV2HandoffError();
        return await deps.transaction.consume(auth, evidence, key, hash(signature));
      } catch { throw new OfflineCodeV2HandoffError(); }
    },
  };
}

function validateTranscript(evidence: HandoffEvidence, now: number): Buffer {
  const bytes = Buffer.from(evidence.transcript_bytes_base64url, "base64url");
  const expiry = Date.parse(evidence.expires_at);
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 120_000
    || bytes.toString("base64url") !== evidence.transcript_bytes_base64url
    || hash(bytes) !== evidence.transcript_digest) throw new OfflineCodeV2HandoffError();
  const transcript = transcriptSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (transcript.handoff_id !== evidence.handoff_id || transcript.case_id !== evidence.case_id
    || transcript.claimant_user_id !== evidence.claimant_user_id
    || transcript.portal_session_id !== evidence.portal_session_id
    || transcript.portal_session_version !== evidence.portal_session_version
    || transcript.source_challenge_id !== evidence.source_challenge_id
    || Math.abs(transcript.expires_at_epoch * 1000 - expiry) >= 1) throw new OfflineCodeV2HandoffError();
  return bytes;
}
const transcriptSchema = z.strictObject({
  protocol: z.literal("sanduqkin:claim:offline-code:v2"), purpose: z.literal("authenticated_case_handoff"),
  label: z.literal("sanduqkin:claim:offline-code:v2:authenticated-handoff:v1"),
  handoff_id: z.string().uuid(), case_id: z.string().uuid(), claimant_user_id: z.string().uuid(),
  portal_session_id: z.string().uuid(), portal_session_version: z.number().int().positive(),
  source_challenge_id: z.string().uuid(), record_binding_digest: z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u),
  expires_at_epoch: z.number().positive(), nonce: z.string().regex(/^[a-f0-9]{64}$/u),
});
function hash(value: Buffer) { return createHash("sha256").update(value).digest("base64url"); }
