import { z } from "zod";

import { offlineCodeV2CaseBindingResultSchema }
  from "./offline-code-v2-case-binding-transaction-client.js";

export type HandoffActor = Readonly<{ userId: string; sessionId: string; sessionVersion: number }>;
type Rpc = (name: string, input: Record<string, unknown>) => PromiseLike<Readonly<{
  data: unknown; error: unknown;
}>>;
const digest = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u);
const evidenceSchema = z.strictObject({
  handoff_id: z.string().uuid(), case_id: z.string().uuid(), claimant_user_id: z.string().uuid(),
  portal_session_id: z.string().uuid(), portal_session_version: z.number().int().positive(),
  source_challenge_id: z.string().uuid(), proof_public_key: digest,
  expires_at: z.string().datetime({ offset: true }),
  transcript_bytes_base64url: z.string().regex(/^[A-Za-z0-9_-]{128,8192}$/u),
  transcript_digest: digest, authority: z.literal("route_possession_only"),
  identity_verified: z.literal(false), claim_created: z.literal(false),
  release_authorized: z.literal(false), synthetic_only: z.literal(true),
});
export type HandoffEvidence = z.infer<typeof evidenceSchema>;
export type HandoffTransaction = ReturnType<typeof createOfflineCodeV2HandoffTransactionClient>;

export function createOfflineCodeV2HandoffTransactionClient(rpc: Rpc) {
  async function call(action: string, actor: HandoffActor, requestId: string, key: string,
    proof?: Readonly<{ transcriptDigest: string; signatureDigest: string }>) {
    const response = await rpc("claimant_offline_code_v2_handoff", {
      p_action: action, p_claimant_user_id: actor.userId, p_portal_session_id: actor.sessionId,
      p_request_id: requestId, p_idempotency_key: key,
      p_verified_transcript_digest: proof?.transcriptDigest ?? null,
      p_signature_digest: proof?.signatureDigest ?? null,
    });
    if (response.error) throw new Error("Offline-code handoff is unavailable.");
    return response.data;
  }
  return {
    async evidence(action: "issue" | "load", actor: HandoffActor, requestId: string, key: string) {
      const value = evidenceSchema.parse(await call(action, actor, requestId, key));
      if (value.claimant_user_id !== actor.userId || value.portal_session_id !== actor.sessionId
        || value.portal_session_version !== actor.sessionVersion
        || (action === "issue" ? value.source_challenge_id : value.handoff_id) !== requestId) {
        throw new Error("Offline-code handoff is unavailable.");
      }
      return value;
    },
    async consume(actor: HandoffActor, evidence: HandoffEvidence, key: string, signatureDigest: string) {
      const value = offlineCodeV2CaseBindingResultSchema.parse(await call("consume", actor, evidence.handoff_id, key,
        { transcriptDigest: evidence.transcript_digest, signatureDigest }));
      if (value.case_id !== evidence.case_id) throw new Error("Offline-code handoff is unavailable.");
      return value;
    },
  };
}
