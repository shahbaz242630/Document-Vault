import type { ClaimantChecklistItemKey } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { ClaimIntakeTransactionError, createClaimIntakeTransactionClientV1 } from "./claim-intake-transaction-client.js";

const ids = { case: "61000000-0000-4000-8000-000000000016", claimant: "21000000-0000-4000-8000-000000000002",
  session: "71000000-0000-4000-8000-000000000007", attempt: "91000000-0000-4000-8000-000000000019" };

describe("claim intake transaction client", () => {
  it("maps the complete server-selected checklist into one RPC", async () => {
    const rpc = vi.fn(async () => ({ data: { case_id: ids.case, case_version: 2,
      checklist_item_count: 7, replayed: false, state: "identity_pending" }, error: null }));
    const result = await createClaimIntakeTransactionClientV1(rpc).initialize(input());
    expect(result).toEqual({ caseId: ids.case, caseVersion: 2, checklistItemCount: 7,
      replayed: false, state: "identity_pending" });
    expect(rpc).toHaveBeenCalledWith("claimant_initialize_claim_intake", expect.objectContaining({
      p_case_id: ids.case, p_claimant_user_id: ids.claimant, p_expected_case_version: 1,
      p_idempotency_key: ids.attempt, p_policy_pack_id: "synthetic_policy_death_alpha",
      p_checklist_items: expect.arrayContaining([{
        availability: "pending", item_key: "claimant_photo_identity", source: "common" }]) }));
  });

  it("redacts RPC failures and rejects non-allowlisted results", async () => {
    const failed = createClaimIntakeTransactionClientV1(async () => ({ data: null,
      error: { code: "42501", message: "sensitive database detail" } } as never));
    await expect(failed.initialize(input())).rejects.toEqual(new ClaimIntakeTransactionError("42501"));
    const hostile = createClaimIntakeTransactionClientV1(async () => ({ data: { case_id: ids.case,
      case_version: 2, checklist_item_count: 7, replayed: false, state: "identity_pending",
      reviewer_identity: "prohibited" }, error: null }));
    await expect(hostile.initialize(input())).rejects.toThrow("invalid result");
  });
});

function input() { return { caseId: ids.case, claimantUserId: ids.claimant, expectedCaseVersion: 1,
  idempotencyKey: ids.attempt, jurisdictionKey: "synthetic_jurisdiction_alpha",
  policyPackId: "synthetic_policy_death_alpha", policyPackVersion: 1, portalSessionId: ids.session,
  routingConditions: { probate_required: false, relationship_evidence_required: false,
    name_variation_present: false, translation_required: false, attestation_required: false,
    dispute_known: false }, checklistItems: ["claimant_photo_identity", "identity_verification_result",
    "owner_match_reference", "official_death_record", "authority_basis", "processing_declaration",
    "conflict_declaration"].map((itemKey) => ({ availability: "pending" as const,
      itemKey: itemKey as ClaimantChecklistItemKey, source: "common" as const })) }; }
