import { describe, expect, it } from "vitest";

import {
  applySyntheticSubmissionHandoff,
  createSyntheticSubmissionHandoffInput,
} from "./index";

describe("synthetic submission handoff runner", () => {
  it("applies the protected transition and emits a safe acknowledgement", () => {
    const result = applySyntheticSubmissionHandoff(
      createSyntheticSubmissionHandoffInput(),
    );

    expect(result.status).toBe("applied");
    if (result.status !== "applied") throw new Error("Expected applied handoff.");
    expect(result.snapshot).toMatchObject({ current_state: "submitted", version: 3 });
    expect(result.snapshot.ledger).toHaveLength(3);
    expect(result.invalidates).toEqual(["incomplete_attempts"]);
    expect(result.acknowledgement).toMatchObject({
      protocol: "sanduqkin:claim:submission-acknowledgement:v1",
      synthetic_only: true,
      runtime_effect: false,
      review_started: false,
      release_authorized: false,
      status: "received_for_review",
      case_version: 3,
      projection: {
        stage: "documents_received",
        title: "Documents received and protected",
        claimant_action_required: false,
      },
    });
  });

  it("returns the same protected snapshot for an exact retry", () => {
    const input = createSyntheticSubmissionHandoffInput();
    const first = applySyntheticSubmissionHandoff(input);
    expect(first.status).toBe("applied");
    if (first.status !== "applied") throw new Error("Expected applied handoff.");

    const duplicate = applySyntheticSubmissionHandoff({
      ...input,
      snapshot: first.snapshot,
    });
    expect(duplicate.status).toBe("duplicate");
    if (duplicate.status !== "duplicate") throw new Error("Expected duplicate handoff.");
    expect(duplicate.snapshot).toEqual(first.snapshot);
    expect(duplicate.snapshot.ledger).toHaveLength(3);
    expect(duplicate.acknowledgement.status).toBe("already_received");
    expect(duplicate.acknowledgement.release_authorized).toBe(false);
  });

  it("denies a changed retry instead of acknowledging it as already received", () => {
    const input = createSyntheticSubmissionHandoffInput();
    const first = applySyntheticSubmissionHandoff(input);
    expect(first.status).toBe("applied");
    if (first.status !== "applied") throw new Error("Expected applied handoff.");

    const changed = applySyntheticSubmissionHandoff({
      ...input,
      snapshot: first.snapshot,
      step: {
        ...input.step,
        audit_event: {
          ...input.step.audit_event,
          actor_ref: "synthetic_actor_processor_changed",
        },
      },
    });

    expect(changed).toMatchObject({
      status: "denied",
      reason: "idempotency_conflict",
      acknowledgement: null,
    });
    expect(changed.snapshot).toBe(first.snapshot);
  });

  it("denies a predicate failure without changing state or acknowledging receipt", () => {
    const input = createSyntheticSubmissionHandoffInput();
    const step = {
      ...input.step,
      transition: {
        ...input.step.transition,
        predicates: {
          ...input.step.transition.predicates,
          evidence_policy_satisfied: false,
        },
      },
    };
    const result = applySyntheticSubmissionHandoff({ ...input, step });

    expect(result).toMatchObject({
      status: "denied",
      reason: "predicate_failed",
      acknowledgement: null,
      snapshot: { current_state: "identity_pending", version: 2 },
      invalidates: [],
    });
  });

  it("fails closed when audit input is malformed", () => {
    const input = createSyntheticSubmissionHandoffInput();
    const step = {
      ...input.step,
      audit_event: { ...input.step.audit_event, event_id: "not-synthetic" },
    };
    const result = applySyntheticSubmissionHandoff({ ...input, step });

    expect(result).toMatchObject({
      status: "denied",
      reason: "invalid_step",
      acknowledgement: null,
      snapshot: { current_state: "identity_pending", version: 2 },
    });
  });
});
