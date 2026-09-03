import type { ClaimantChecklistItemKey } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import {
  createEvidencePreparationTransactionClientV1,
  EvidencePreparationTransactionError,
} from "./claim-evidence-preparation-transaction-client.js";

const ids = {
  case: "20000000-0000-4000-8000-000000000001",
  claimant: "20000000-0000-4000-8000-000000000002",
  attempt: "20000000-0000-4000-8000-000000000003",
  session: "20000000-0000-4000-8000-000000000004",
};

describe("claim evidence preparation transaction client", () => {
  it("maps the exact bounded RPC contract", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      case_id: ids.case, case_version: 2, intake_version: 2, prepared_item_count: 1,
      unavailable_item_count: 0, status: "documents_needed", replayed: false,
    }, error: null });
    const result = await createEvidencePreparationTransactionClientV1(rpc).record(validInput());

    expect(result).toMatchObject({ caseId: ids.case, intakeVersion: 2, preparedItemCount: 1 });
    expect(rpc).toHaveBeenCalledWith("claimant_record_evidence_preparation", {
      p_bundle_ref: "synthetic_bundle_alpha_002", p_case_id: ids.case,
      p_claimant_user_id: ids.claimant, p_expected_case_version: 2,
      p_expected_intake_version: 1, p_idempotency_key: ids.attempt,
      p_policy_pack_id: "synthetic_policy_death_alpha", p_policy_pack_version: 1,
      p_portal_session_id: ids.session,
      p_prepared_items: [{ item_key: "claimant_photo_identity", media_type: "application/pdf",
        placeholder_ref: "synthetic_evidence_001", prepared_at: "2026-08-12T10:00:00.000Z",
        size_bytes: 1024 }], p_unavailable_items: [],
    });
  });

  it("redacts RPC failures", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: {
      code: "42501", message: "private database details" } });
    const error = await createEvidencePreparationTransactionClientV1(rpc)
      .record(validInput()).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(EvidencePreparationTransactionError);
    expect((error as Error).message).toBe("Evidence preparation transaction failed.");
    expect(JSON.stringify(error)).not.toContain("private database details");
  });

  it("rejects an unexpected result shape", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      case_id: ids.case, case_version: 2, intake_version: 2, prepared_item_count: 1,
      unavailable_item_count: 0, status: "ready_for_review", replayed: false,
    }, error: null });
    await expect(createEvidencePreparationTransactionClientV1(rpc).record(validInput()))
      .rejects.toThrow("invalid result");
  });
});

function validInput() {
  return {
    bundleRef: "synthetic_bundle_alpha_002", caseId: ids.case, claimantUserId: ids.claimant,
    expectedCaseVersion: 2, expectedIntakeVersion: 1, idempotencyKey: ids.attempt,
    policyPackId: "synthetic_policy_death_alpha", policyPackVersion: 1,
    portalSessionId: ids.session, unavailableItems: [] as ClaimantChecklistItemKey[],
    preparedItems: [{ itemKey: "claimant_photo_identity" as ClaimantChecklistItemKey,
      mediaType: "application/pdf" as const, placeholderRef: "synthetic_evidence_001",
      preparedAt: "2026-08-12T10:00:00.000Z", sizeBytes: 1024 }],
  };
}
