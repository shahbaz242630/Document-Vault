import { describe, expect, it, vi } from "vitest";

import {
  createOfflineCodeV2CaseBindingTransactionClient,
  OfflineCodeV2CaseBindingTransactionError,
  type OfflineCodeV2CaseBindingInput,
} from "./offline-code-v2-case-binding-transaction-client.js";

const input: OfflineCodeV2CaseBindingInput = {
  caseId: "20000000-0000-4000-8000-000000000001",
  claimantUserId: "20000000-0000-4000-8000-000000000002",
  portalSessionId: "20000000-0000-4000-8000-000000000003",
  challengeId: "20000000-0000-4000-8000-000000000004",
  expectedRecordBindingDigest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  policyPackId: "synthetic_policy_death_alpha",
  policyPackVersion: 1,
  idempotencyKey: "20000000-0000-4000-8000-000000000005",
};

const result = {
  case_id: input.caseId,
  case_version: 1,
  state: "draft",
  route_profile: "offline_code_v2",
  authority: "route_possession_only",
  claimant_session_bound: true,
  case_created: true,
  identity_verified: false,
  relationship_verified: false,
  intake_started: false,
  review_started: false,
  release_authorized: false,
  replayed: false,
};

describe("offline-code V2 case binding transaction client", () => {
  it("maps the exact service-only RPC and safe result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    const client = createOfflineCodeV2CaseBindingTransactionClient(rpc);
    await expect(client.bind(input)).resolves.toMatchObject({
      caseId: input.caseId,
      routeProfile: "offline_code_v2",
      authority: "route_possession_only",
      identityVerified: false,
      relationshipVerified: false,
      releaseAuthorized: false,
    });
    expect(rpc).toHaveBeenCalledWith("claimant_bind_offline_code_v2_case", {
      p_case_id: input.caseId,
      p_claimant_user_id: input.claimantUserId,
      p_portal_session_id: input.portalSessionId,
      p_challenge_id: input.challengeId,
      p_expected_record_binding_digest: input.expectedRecordBindingDigest,
      p_policy_pack_id: input.policyPackId,
      p_policy_pack_version: input.policyPackVersion,
      p_idempotency_key: input.idempotencyKey,
    });
  });

  it("rejects changed case and expanded authority output", async () => {
    const changed = vi.fn().mockResolvedValue({ data: {
      ...result, case_id: "20000000-0000-4000-8000-000000000099",
    }, error: null });
    await expect(createOfflineCodeV2CaseBindingTransactionClient(changed).bind(input))
      .rejects.toThrow("invalid result");
    const expanded = vi.fn().mockResolvedValue({ data: {
      ...result, release_authorized: true,
    }, error: null });
    await expect(createOfflineCodeV2CaseBindingTransactionClient(expanded).bind(input))
      .rejects.toThrow("invalid result");
  });

  it("preserves only the RPC error code", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(createOfflineCodeV2CaseBindingTransactionClient(rpc).bind(input))
      .rejects.toEqual(expect.objectContaining<Partial<OfflineCodeV2CaseBindingTransactionError>>({
        code: "42501",
        message: "Offline-code V2 case binding transaction failed.",
      }));
  });
});
