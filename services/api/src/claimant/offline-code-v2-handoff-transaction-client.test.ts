import { describe, expect, it, vi } from "vitest";

import { createOfflineCodeV2HandoffTransactionClient }
  from "./offline-code-v2-handoff-transaction-client.js";

const actor = { userId: id("01"), sessionId: id("02"), sessionVersion: 1 };
const evidence = {
  handoff_id: id("03"), case_id: id("04"), claimant_user_id: actor.userId,
  portal_session_id: actor.sessionId, portal_session_version: 1, source_challenge_id: id("05"),
  proof_public_key: digest("P"), expires_at: "2030-01-01T00:00:00.000Z",
  transcript_bytes_base64url: "A".repeat(128), transcript_digest: digest("T"),
  authority: "route_possession_only", identity_verified: false, claim_created: false,
  release_authorized: false, synthetic_only: true,
} as const;
const result = { case_id: evidence.case_id, case_version: 1, state: "draft",
  route_profile: "offline_code_v2", authority: "route_possession_only",
  claimant_session_bound: true, case_created: true, identity_verified: false,
  relationship_verified: false, intake_started: false, review_started: false,
  release_authorized: false, replayed: false };

describe("offline-code V2 authenticated handoff transaction", () => {
  it("maps exact service-only issue, load, and consume calls", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: evidence, error: null })
      .mockResolvedValueOnce({ data: evidence, error: null })
      .mockResolvedValueOnce({ data: result, error: null });
    const client = createOfflineCodeV2HandoffTransactionClient(rpc);
    await expect(client.evidence("issue", actor, evidence.source_challenge_id, id("06")))
      .resolves.toEqual(evidence);
    await expect(client.evidence("load", actor, evidence.handoff_id, id("07")))
      .resolves.toEqual(evidence);
    await expect(client.consume(actor, evidence, id("07"), digest("S"))).resolves.toEqual(result);
    expect(rpc.mock.calls[2]).toEqual(["claimant_offline_code_v2_handoff", {
      p_action: "consume", p_claimant_user_id: actor.userId,
      p_portal_session_id: actor.sessionId, p_request_id: evidence.handoff_id,
      p_idempotency_key: id("07"), p_verified_transcript_digest: evidence.transcript_digest,
      p_signature_digest: digest("S"),
    }]);
  });

  it("rejects cross-account evidence and expanded authority", async () => {
    const crossAccount = vi.fn().mockResolvedValue({ data: {
      ...evidence, claimant_user_id: id("99"),
    }, error: null });
    await expect(createOfflineCodeV2HandoffTransactionClient(crossAccount)
      .evidence("issue", actor, evidence.source_challenge_id, id("06"))).rejects.toThrow();
    const expanded = vi.fn().mockResolvedValue({ data: { ...result, release_authorized: true }, error: null });
    await expect(createOfflineCodeV2HandoffTransactionClient(expanded)
      .consume(actor, evidence, id("07"), digest("S"))).rejects.toThrow();
  });
});

function id(suffix: string) { return `10000000-0000-4000-8000-0000000000${suffix}`; }
function digest(character: string) { return `${character.repeat(42)}Q`; }
