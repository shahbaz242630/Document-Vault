import { describe, expect, it } from "vitest";

import {
  createSyntheticEvidenceBundle,
  createSyntheticEvidencePlaceholder,
  prepareSyntheticEvidence,
  syntheticEvidenceChecklist,
} from "../evidence-preparation";
import {
  createSyntheticReviewSubmissionDraft,
  createSyntheticReviewSubmissionInput,
  syntheticReviewSubmissionPreparation,
  validateSyntheticReviewSubmission,
  type SyntheticReviewSubmissionDraftV1,
} from "./index";

describe("synthetic review submission validation", () => {
  it("accepts a complete, current, unused synthetic draft", () => {
    expect(validateSyntheticReviewSubmission(createSyntheticReviewSubmissionInput())).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("rejects incomplete evidence and detects a supplied preparation mismatch", () => {
    const partialBundle = createSyntheticEvidenceBundle({
      placeholders: [
        createSyntheticEvidencePlaceholder(syntheticEvidenceChecklist.items[0]!.key, 1),
      ],
    });
    const partialPreparation = prepareSyntheticEvidence({
      bundle: partialBundle,
      checklist: syntheticEvidenceChecklist,
      server_time: createSyntheticReviewSubmissionDraft().created_at,
    });

    expect(
      validateSyntheticReviewSubmission(
        createSyntheticReviewSubmissionInput({
          bundle: partialBundle,
          preparation: partialPreparation,
        }),
      ),
    ).toEqual({ valid: false, issues: ["evidence_not_ready"] });

    expect(
      validateSyntheticReviewSubmission(
        createSyntheticReviewSubmissionInput({
          bundle: partialBundle,
          preparation: syntheticReviewSubmissionPreparation,
        }),
      ).issues,
    ).toEqual(["evidence_not_ready", "evidence_binding_mismatch"]);
  });

  it("rejects altered canonical evidence-preparation metadata", () => {
    const input = createSyntheticReviewSubmissionInput();
    const preparation = {
      ...input.preparation,
      items: input.preparation.items.map((item, index) =>
        index === 0
          ? {
              ...item,
              label: "Altered synthetic label",
              explanation: "Altered synthetic explanation",
              source: item.source === "common" ? "conditional" as const : "common" as const,
            }
          : item,
      ),
    };

    expect(
      validateSyntheticReviewSubmission({ ...input, preparation }).issues,
    ).toEqual(["evidence_binding_mismatch"]);
  });

  it("rejects stale and replayed drafts", () => {
    const draft = createSyntheticReviewSubmissionDraft();
    const result = validateSyntheticReviewSubmission(
      createSyntheticReviewSubmissionInput({
        current_case_version: draft.expected_case_version + 1,
        used_submission_refs: [draft.submission_ref],
        used_idempotency_keys: [draft.idempotency_key],
      }),
    );

    expect(result.issues).toEqual([
      "stale_case_version",
      "replayed_submission_ref",
      "replayed_idempotency_key",
    ]);
  });

  it("requires every declaration exactly once and explicitly true", () => {
    const draft = {
      ...createSyntheticReviewSubmissionDraft(),
      declarations: {
        information_is_accurate: true,
        evidence_is_lawfully_held: true,
        known_conflicts_are_disclosed: true,
        review_is_not_release: false,
        unexpected_declaration: true,
      },
    } as unknown as SyntheticReviewSubmissionDraftV1;

    expect(
      validateSyntheticReviewSubmission(createSyntheticReviewSubmissionInput({ draft })).issues,
    ).toEqual(["incomplete_declarations"]);
  });

  it("rejects malformed and future-dated draft metadata", () => {
    const draft = {
      ...createSyntheticReviewSubmissionDraft(),
      submission_ref: "real-submission",
      created_at: "2026-08-02T00:00:00.000Z",
    };

    expect(
      validateSyntheticReviewSubmission(createSyntheticReviewSubmissionInput({ draft })).issues,
    ).toEqual(["invalid_draft", "created_in_future"]);
  });
});
