import { createSyntheticChecklistRoutingFacts, syntheticChecklistPolicyPack } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { ClaimIntakeTransactionClientV1 } from "./claim-intake-transaction-client.js";
import { CLAIMANT_INTAKE_INITIALIZATION_APPROVED, createClaimIntakeServiceV1 } from "./claim-intake-service.js";

const request = { caseId: "61000000-0000-4000-8000-000000000016",
  claimantUserId: "21000000-0000-4000-8000-000000000002", expectedCaseVersion: 1,
  facts: createSyntheticChecklistRoutingFacts(), idempotencyKey: "91000000-0000-4000-8000-000000000019",
  portalSessionId: "71000000-0000-4000-8000-000000000007" };

describe("hard-disabled claim intake service", () => {
  it("is disabled before policy selection or transaction work", async () => {
    expect(CLAIMANT_INTAKE_INITIALIZATION_APPROVED).toBe(false);
    const transactions = transactionClient();
    await expect(createClaimIntakeServiceV1({ packs: [], serverTime: () => { throw new Error(); }, transactions })
      .initialize(request)).rejects.toMatchObject({ kind: "disabled" });
    expect(transactions.initialize).not.toHaveBeenCalled();
  });

  it("selects the server-held policy and persists common plus triggered conditional items", async () => {
    const transactions = transactionClient();
    const result = await createClaimIntakeServiceV1({ approved: true, packs: [syntheticChecklistPolicyPack],
      serverTime: () => "2026-08-12T12:00:00.000Z", transactions }).initialize({ ...request,
        facts: createSyntheticChecklistRoutingFacts({ probate_required: true, dispute_known: true }) });
    expect(result).toMatchObject({ state: "identity_pending" });
    expect(transactions.initialize).toHaveBeenCalledWith(expect.objectContaining({
      policyPackId: syntheticChecklistPolicyPack.policy_id,
      policyPackVersion: syntheticChecklistPolicyPack.policy_version,
      checklistItems: expect.arrayContaining([
        expect.objectContaining({ itemKey: "probate_authority", source: "conditional" }),
        expect.objectContaining({ itemKey: "dispute_documents", source: "conditional" }),
      ]) }));
  });

  it("fails closed without a single current valid server policy", async () => {
    for (const packs of [[], [syntheticChecklistPolicyPack, syntheticChecklistPolicyPack]]) {
      const transactions = transactionClient();
      await expect(createClaimIntakeServiceV1({ approved: true, packs,
        serverTime: () => "2026-08-12T12:00:00.000Z", transactions }).initialize(request))
        .rejects.toMatchObject({ kind: "policy_unavailable", message: "Claim intake is unavailable." });
      expect(transactions.initialize).not.toHaveBeenCalled();
    }
  });
});

function transactionClient(): ClaimIntakeTransactionClientV1 & { initialize: ReturnType<typeof vi.fn> } {
  return { initialize: vi.fn(async () => ({ caseId: request.caseId, caseVersion: 2,
    checklistItemCount: 7, replayed: false, state: "identity_pending" as const })) };
}
