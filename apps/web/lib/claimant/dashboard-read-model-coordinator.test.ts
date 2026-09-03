import { projectClaimantPublicDecisionReadiness, projectClaimantPublicJourney,
  projectClaimantPublicReviewTracking } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_DASHBOARD_READ_MODEL_COORDINATOR_APPROVED,
  ClaimantDashboardCoordinatorError, createClaimantDashboardReadModelCoordinatorV1 }
  from "./dashboard-read-model-coordinator";

const caseId = "50000000-0000-4000-8000-000000000001";

describe("claimant dashboard read-model coordinator", () => {
  it("is immutable-false and touches no transport while disabled", async () => {
    expect(CLAIMANT_DASHBOARD_READ_MODEL_COORDINATOR_APPROVED).toBe(false);
    const deps = dependencies();
    await expect(createClaimantDashboardReadModelCoordinatorV1(deps).refresh(caseId))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(deps.transport.read).not.toHaveBeenCalled();
  });

  it("loads an immutable coherent safe projection and sends only bounded read context", async () => {
    const deps = dependencies(); const changes: unknown[] = [];
    const coordinator = createClaimantDashboardReadModelCoordinatorV1({ ...deps, approved: true,
      onChange: (value) => changes.push(value) });
    const result = await coordinator.refresh(caseId);
    expect(result).toEqual(readModel("review_pending"));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.journey.milestones)).toBe(true);
    expect(deps.transport.read).toHaveBeenCalledWith({ caseId, knownProjectionVersion: null,
      signal: undefined });
    expect(changes).toEqual([result]);
    await coordinator.refresh(caseId);
    expect(deps.transport.read).toHaveBeenLastCalledWith(expect.objectContaining({
      knownProjectionVersion: 4 }));
  });

  it("rejects extra private fields, incoherent projections, future dates, and version drift", async () => {
    for (const changed of [
      { ...readModel(), reviewer_id: "private" },
      { ...readModel(), decision_readiness: projectClaimantPublicDecisionReadiness("released") },
      { ...readModel(), last_meaningful_update_date: "2026-08-13" },
      { ...readModel(), projection_version: 3 },
    ]) {
      const deps = dependencies(changed);
      await expect(createClaimantDashboardReadModelCoordinatorV1({ ...deps, approved: true })
        .refresh(caseId)).rejects.toMatchObject({ kind: "invalid_response" });
    }
  });

  it("binds the response to the requested case and clears a prior case before switching", async () => {
    const deps = dependencies(); const changes: unknown[] = [];
    const coordinator = createClaimantDashboardReadModelCoordinatorV1({ ...deps, approved: true,
      onChange: (value) => changes.push(value) });
    await coordinator.refresh(caseId);
    const otherCase = "50000000-0000-4000-8000-000000000002";
    deps.transport.read.mockResolvedValueOnce(readModel("review_pending", { case_id: caseId }));
    await expect(coordinator.refresh(otherCase)).rejects.toMatchObject({ kind: "invalid_response" });
    expect(coordinator.getSnapshot()).toBeNull();
    expect(changes.at(-1)).toBeNull();
  });

  it("rejects stale or same-version divergent refreshes while preserving the trusted snapshot", async () => {
    const deps = dependencies();
    const coordinator = createClaimantDashboardReadModelCoordinatorV1({ ...deps, approved: true });
    const trusted = await coordinator.refresh(caseId);
    deps.transport.read.mockResolvedValueOnce(readModel("submitted", { case_version: 3,
      projection_version: 3 }));
    await expect(coordinator.refresh(caseId)).rejects.toMatchObject({ kind: "stale_response" });
    expect(coordinator.getSnapshot()).toBe(trusted);
    deps.transport.read.mockResolvedValueOnce(readModel("manual_review"));
    await expect(coordinator.refresh(caseId)).rejects.toMatchObject({ kind: "divergent_response" });
    expect(coordinator.getSnapshot()).toBe(trusted);
  });

  it("fails cancellation and overlapping reads closed", async () => {
    const aborted = dependencies(); const abort = new AbortController(); abort.abort();
    await expect(createClaimantDashboardReadModelCoordinatorV1({ ...aborted, approved: true })
      .refresh(caseId, abort.signal)).rejects.toMatchObject({ kind: "aborted" });
    expect(aborted.transport.read).not.toHaveBeenCalled();

    const busy = dependencies(); let release!: () => void;
    busy.transport.read.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve(readModel());
    }));
    const coordinator = createClaimantDashboardReadModelCoordinatorV1({ ...busy, approved: true });
    const first = coordinator.refresh(caseId);
    await vi.waitFor(() => expect(busy.transport.read).toHaveBeenCalled());
    await expect(coordinator.refresh(caseId)).rejects.toMatchObject({ kind: "busy" });
    release(); await first;

    const cleared = dependencies(); let finish!: () => void;
    cleared.transport.read.mockImplementationOnce(() => new Promise((resolve) => {
      finish = () => resolve(readModel());
    }));
    const clearingCoordinator = createClaimantDashboardReadModelCoordinatorV1({ ...cleared,
      approved: true, onChange: () => { throw new Error("observer failure"); } });
    const pending = clearingCoordinator.refresh(caseId);
    await vi.waitFor(() => expect(cleared.transport.read).toHaveBeenCalled());
    clearingCoordinator.clear(); finish();
    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
    expect(clearingCoordinator.getSnapshot()).toBeNull();
  });

  it("redacts transport detail and rejects malformed case identifiers before transport", async () => {
    const deps = dependencies();
    deps.transport.read.mockRejectedValueOnce(new Error("database topology and claimant identity"));
    const error = await createClaimantDashboardReadModelCoordinatorV1({ ...deps, approved: true })
      .refresh(caseId).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ClaimantDashboardCoordinatorError);
    expect(String(error)).not.toContain("topology");
    await expect(createClaimantDashboardReadModelCoordinatorV1({ ...deps, approved: true })
      .refresh("not-a-case")).rejects.toMatchObject({ kind: "invalid_input" });
    expect(deps.transport.read).toHaveBeenCalledOnce();
  });
});

function dependencies(response = readModel()) {
  return { now: () => new Date("2026-08-12T20:00:00.000Z"),
    transport: { read: vi.fn().mockResolvedValue(response) } };
}
function readModel(state: Parameters<typeof projectClaimantPublicJourney>[0] = "review_pending",
  changes = {}) {
  return { case_id: caseId, case_version: 4,
    decision_readiness: projectClaimantPublicDecisionReadiness(state),
    journey: projectClaimantPublicJourney(state), last_meaningful_update_date: "2026-08-12",
    projection_version: 4, protocol: "sanduqkin:claim:dashboard-read-model:v1" as const,
    review_tracking: projectClaimantPublicReviewTracking(state), support_route: "secure_case_support" as const,
    synthetic_only: true as const, ...changes };
}
