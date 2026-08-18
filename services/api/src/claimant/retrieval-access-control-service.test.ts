import { describe, expect, it, vi } from "vitest";

import { createRetrievalAccessControlServiceV1, RetrievalAccessControlServiceError }
  from "./retrieval-access-control-service.js";

const request = { caseId: "20000000-0000-4000-8000-000000000001",
  controlId: "20000000-0000-4000-8000-000000000002", controlState: "expired" as const,
  expectedCaseVersion: 7, finalizationId: "20000000-0000-4000-8000-000000000003",
  idempotencyKey: "20000000-0000-4000-8000-000000000004",
  reason: "package_expired" as const };
const response = { caseId: request.caseId, caseState: "release_ready" as const,
  caseVersion: 7, controlId: request.controlId, controlState: request.controlState,
  effectiveAt: new Date().toISOString(), finalizationId: request.finalizationId,
  futureRetrievalAuthorized: false as const, futureServingAuthorized: false as const,
  localContentDeleted: false as const, localContentRecalled: false as const,
  packageWasServed: false, replayed: false, retrievalWasCompleted: false };

describe("retrieval access control service", () => {
  it("is disabled by default before touching the transaction", async () => {
    const endAccess = vi.fn();
    await expect(createRetrievalAccessControlServiceV1({ transactions: { endAccess } })
      .endAccess(request)).rejects.toMatchObject({ kind: "disabled" });
    expect(endAccess).not.toHaveBeenCalled();
  });
  it("accepts only exact action and reason pairs", async () => {
    const endAccess = vi.fn().mockResolvedValue(response);
    const service = createRetrievalAccessControlServiceV1({ approved: true,
      transactions: { endAccess } });
    await expect(service.endAccess(request)).resolves.toEqual(response);
    expect(endAccess).toHaveBeenCalledWith(request);
    for (const hostile of [{ ...request, reason: "synthetic_security_hold" },
      { ...request, unexpected: true }, { ...request, expectedCaseVersion: 3 }])
      await expect(service.endAccess(hostile)).rejects.toMatchObject({ kind: "invalid_input" });
  });
  it("accepts the bounded suspension pair", async () => {
    const endAccess = vi.fn().mockResolvedValue({ ...response, controlState: "suspended" });
    const service = createRetrievalAccessControlServiceV1({ approved: true,
      transactions: { endAccess } });
    await expect(service.endAccess({ ...request, controlState: "suspended",
      reason: "synthetic_security_hold" })).resolves.toBeDefined();
  });
  it("reduces transaction failures", async () => {
    const service = createRetrievalAccessControlServiceV1({ approved: true,
      transactions: { endAccess: vi.fn().mockRejectedValue(new Error("private")) } });
    await expect(service.endAccess(request)).rejects
      .toBeInstanceOf(RetrievalAccessControlServiceError);
  });
});
