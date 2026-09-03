import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_SUBMISSION_COORDINATOR_APPROVED, ClaimSubmissionCoordinatorError,
  ClaimSubmissionTransportError, createClaimSubmissionCoordinatorV1 }
  from "./submission-coordinator";

const ids = { case: "70000000-0000-4000-8000-000000000001",
  original: "70000000-0000-4000-8000-000000000002",
  attempt: "70000000-0000-4000-8000-000000000003" };

describe("claimant web submission coordinator", () => {
  it("is immutable-false and touches no key factory or transport while disabled", async () => {
    expect(CLAIMANT_SUBMISSION_COORDINATOR_APPROVED).toBe(false);
    const deps = dependencies();
    await expect(createClaimSubmissionCoordinatorV1(deps).submit(request()))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(deps.createIdempotencyKey).not.toHaveBeenCalled();
    expect(deps.transport.submit).not.toHaveBeenCalled();
  });

  it("constructs one exact request and returns only a frozen safe acknowledgement", async () => {
    const deps = dependencies(); const input = request();
    const result = await createClaimSubmissionCoordinatorV1({ ...deps, approved: true }).submit(input);
    expect(deps.createIdempotencyKey).toHaveBeenCalledOnce();
    expect(deps.transport.submit).toHaveBeenCalledWith({ body: { envelope: {
      ...input.envelope, idempotency_key: ids.attempt }, expected_intake_version: 9,
    expected_preparation_version: 2 }, caseId: ids.case, idempotencyKey: ids.attempt,
    signal: undefined });
    expect(input.envelope.idempotency_key).toBe(ids.original);
    expect(result).toEqual(acknowledgement().result);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects hostile request shapes before creating attempt authority", async () => {
    for (const value of [request({ caseId: "not-a-case" }),
      request({ expectedPreparationVersion: 1 }),
      request({ envelope: envelope({ case_ref: "70000000-0000-4000-8000-000000000099" }) }),
      request({ envelope: { ...envelope(), private_key: "secret" } })]) {
      const deps = dependencies();
      await expect(createClaimSubmissionCoordinatorV1({ ...deps, approved: true }).submit(value as never))
        .rejects.toMatchObject({ kind: "invalid_input" });
      expect(deps.createIdempotencyKey).not.toHaveBeenCalled();
      expect(deps.transport.submit).not.toHaveBeenCalled();
    }
  });

  it("retries an ambiguous response with the exact same request and idempotency key", async () => {
    const deps = dependencies();
    deps.transport.submit.mockRejectedValueOnce(new ClaimSubmissionTransportError("unavailable"));
    const coordinator = createClaimSubmissionCoordinatorV1({ ...deps, approved: true });
    await expect(coordinator.submit(request())).rejects.toMatchObject({ kind: "retry_required" });
    expect(coordinator.hasPendingRetry()).toBe(true);
    await expect(coordinator.submit(request())).rejects.toMatchObject({ kind: "retry_required" });
    await expect(coordinator.retry()).resolves.toEqual({ acknowledgement: acknowledgement().result,
      status: "completed" });
    expect(deps.createIdempotencyKey).toHaveBeenCalledOnce();
    expect(deps.transport.submit).toHaveBeenCalledTimes(2);
    expect(deps.transport.submit.mock.calls[1]![0]).toEqual(deps.transport.submit.mock.calls[0]![0]);
    expect(coordinator.hasPendingRetry()).toBe(false);
    await expect(coordinator.retry()).resolves.toEqual({ status: "none" });
  });

  it("retains a dispatched cancellation for explicit same-key retry and serializes work", async () => {
    const deps = dependencies(); let reject!: (error: unknown) => void;
    deps.transport.submit.mockImplementationOnce(() => new Promise((_, rejectPromise) => {
      reject = rejectPromise;
    }));
    const coordinator = createClaimSubmissionCoordinatorV1({ ...deps, approved: true });
    const controller = new AbortController(); const first = coordinator.submit(request(), controller.signal);
    await vi.waitFor(() => expect(deps.transport.submit).toHaveBeenCalledOnce());
    await expect(coordinator.submit(request())).rejects.toMatchObject({ kind: "busy" });
    controller.abort(); reject(new ClaimSubmissionTransportError("aborted"));
    await expect(first).rejects.toMatchObject({ kind: "aborted" });
    expect(coordinator.hasPendingRetry()).toBe(true);
    await expect(coordinator.retry()).resolves.toMatchObject({ status: "completed" });
    expect(deps.transport.submit.mock.calls[1]![0].idempotencyKey).toBe(ids.attempt);
  });

  it("fails malformed or cross-case acknowledgements closed and keeps the attempt retryable", async () => {
    for (const changed of [{ case_id: "70000000-0000-4000-8000-000000000099" },
      { review_started: true }, { status: "already_received", replayed: false },
      { internal_note: "private" }]) {
      const deps = dependencies(); deps.transport.submit.mockResolvedValueOnce(acknowledgement(changed));
      const coordinator = createClaimSubmissionCoordinatorV1({ ...deps, approved: true });
      const error = await coordinator.submit(request()).catch((value: unknown) => value);
      expect(error).toBeInstanceOf(ClaimSubmissionCoordinatorError);
      expect(error).toMatchObject({ kind: "invalid_response" });
      expect(coordinator.hasPendingRetry()).toBe(true);
    }
  });

  it("clears definitive client rejection and never exposes transport detail", async () => {
    const deps = dependencies();
    deps.transport.submit.mockRejectedValueOnce(new ClaimSubmissionTransportError("invalid_request"));
    const coordinator = createClaimSubmissionCoordinatorV1({ ...deps, approved: true });
    const error = await coordinator.submit(request()).catch((value: unknown) => value);
    expect(error).toMatchObject({ kind: "failed" });
    expect(String(error)).not.toContain("invalid_request");
    expect(coordinator.hasPendingRetry()).toBe(false);
  });
});

function dependencies() {
  return { createIdempotencyKey: vi.fn(() => ids.attempt),
    transport: { submit: vi.fn().mockResolvedValue(acknowledgement()) } };
}
function request(changes = {}) { return { caseId: ids.case, envelope: envelope(),
  expectedIntakeVersion: 9, expectedPreparationVersion: 2, ...changes }; }
function envelope(changes = {}) { return {
  protocol: "sanduqkin:claim:review-submission-envelope:v1" as const, synthetic_only: true as const,
  production_approved: false as const, runtime_submission_authorized: false as const,
  release_authorized: false as const, status: "assembled_for_review_submission" as const,
  submission_ref: "synthetic_submission_alpha_001", idempotency_key: ids.original,
  case_ref: ids.case, expected_case_version: 2, policy_id: "synthetic_policy_death_alpha",
  policy_version: 1, evidence_bundle_ref: "synthetic_bundle_alpha_001", evidence_manifest: [
    { item_key: "claimant_photo_identity" as const, placeholder_ref: "synthetic_evidence_001" }],
  declarations: ["information_is_accurate", "evidence_is_lawfully_held",
    "known_conflicts_are_disclosed", "review_is_not_release"] as const,
  created_at: "2026-08-12T12:00:00.000Z", ...changes }; }
function acknowledgement(changes = {}) { return { result: {
  acknowledgement_ref: `synthetic_acknowledgement_${"a".repeat(32)}`, case_id: ids.case,
  case_version: 3, intake_version: 9, preparation_version: 2, release_authorized: false,
  replayed: false, review_started: false, state: "submitted", status: "received_for_review",
  ...changes } }; }
