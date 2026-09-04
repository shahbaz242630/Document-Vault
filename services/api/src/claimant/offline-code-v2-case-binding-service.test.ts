import { describe, expect, it, vi } from "vitest";

import {
  createOfflineCodeV2CaseBindingService,
  OfflineCodeV2CaseBindingServiceError,
} from "./offline-code-v2-case-binding-service.js";

const request = {
  caseId: "10000000-0000-4000-8000-000000000001",
  claimantUserId: "10000000-0000-4000-8000-000000000002",
  portalSessionId: "10000000-0000-4000-8000-000000000003",
  challengeId: "10000000-0000-4000-8000-000000000004",
  expectedRecordBindingDigest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  policyPackId: "synthetic_policy_death_alpha" as const,
  policyPackVersion: 1 as const,
  idempotencyKey: "10000000-0000-4000-8000-000000000005",
};

describe("offline-code V2 case binding service", () => {
  it("remains disabled by default", async () => {
    const bind = vi.fn();
    const service = createOfflineCodeV2CaseBindingService({ transaction: { bind } });
    await expect(service.bind(request)).rejects.toMatchObject({ kind: "disabled" });
    expect(bind).not.toHaveBeenCalled();
  });

  it("passes an exact allowlisted request to the injected transaction", async () => {
    const result = { caseId: request.caseId, caseCreated: true, releaseAuthorized: false };
    const bind = vi.fn().mockResolvedValue(result);
    const service = createOfflineCodeV2CaseBindingService({ approved: true, transaction: { bind } });
    await expect(service.bind(request)).resolves.toEqual(result);
    expect(bind).toHaveBeenCalledWith(request);
  });

  it("rejects extra authority and malformed bindings", async () => {
    const bind = vi.fn();
    const service = createOfflineCodeV2CaseBindingService({ approved: true, transaction: { bind } });
    await expect(service.bind({ ...request, ownerUserId: request.claimantUserId }))
      .rejects.toMatchObject({ kind: "invalid_input" });
    await expect(service.bind({ ...request, expectedRecordBindingDigest: "weak" }))
      .rejects.toBeInstanceOf(OfflineCodeV2CaseBindingServiceError);
    expect(bind).not.toHaveBeenCalled();
  });

  it("collapses transaction detail to a generic boundary failure", async () => {
    const service = createOfflineCodeV2CaseBindingService({ approved: true,
      transaction: { bind: vi.fn().mockRejectedValue(new Error("database detail")) } });
    await expect(service.bind(request)).rejects.toMatchObject({
      kind: "boundary_failure",
      message: "Offline-code V2 case binding is unavailable.",
    });
  });
});
