import { describe, expect, it } from "vitest";

import type { SyntheticReviewSubmissionEnvelopeV1 } from "../review-submission";
import {
  createSyntheticSubmissionHandoffInput,
  validateSyntheticSubmissionHandoffBindings,
} from "./index";

describe("synthetic submission handoff bindings", () => {
  it("accepts the exact assembled envelope, case, version, transition, and audit binding", () => {
    expect(
      validateSyntheticSubmissionHandoffBindings(
        createSyntheticSubmissionHandoffInput(),
      ),
    ).toBeNull();
  });

  it("rejects a non-synthetic or runtime-authorized envelope", () => {
    const input = createSyntheticSubmissionHandoffInput();
    const envelope = {
      ...input.envelope,
      runtime_submission_authorized: true,
    } as unknown as SyntheticReviewSubmissionEnvelopeV1;

    expect(validateSyntheticSubmissionHandoffBindings({ ...input, envelope })).toBe(
      "invalid_envelope",
    );
  });

  it("rejects stale versions before applying the transition", () => {
    const input = createSyntheticSubmissionHandoffInput();
    const envelope = {
      ...input.envelope,
      expected_case_version: input.envelope.expected_case_version + 1,
    };

    expect(validateSyntheticSubmissionHandoffBindings({ ...input, envelope })).toBe(
      "version_conflict",
    );
  });

  it("rejects audit or transition metadata that does not match the envelope", () => {
    const input = createSyntheticSubmissionHandoffInput();
    const step = {
      ...input.step,
      audit_event: {
        ...input.step.audit_event,
        object_ref: "synthetic_object_another_submission",
      },
    };

    expect(validateSyntheticSubmissionHandoffBindings({ ...input, step })).toBe(
      "step_binding_mismatch",
    );
  });
});
