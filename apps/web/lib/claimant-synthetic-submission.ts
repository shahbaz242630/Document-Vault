import {
  assembleSyntheticReviewSubmission,
  createSyntheticEvidenceBundle,
  createSyntheticEvidencePlaceholder,
  createSyntheticReviewSubmissionDraft,
  createSyntheticReviewSubmissionInput,
  prepareSyntheticEvidence,
  syntheticEvidenceChecklist,
  syntheticEvidenceServerTime,
  type SyntheticReviewSubmissionAssemblyResultV1,
} from "@vault/shared-types";

export type ClaimantSyntheticSubmissionFixture = {
  key: "assembled" | "incomplete-evidence" | "stale-version" | "replay-rejected";
  label: string;
  description: string;
  result: SyntheticReviewSubmissionAssemblyResultV1;
};

const draft = createSyntheticReviewSubmissionDraft();
const partialBundle = createSyntheticEvidenceBundle({
  placeholders: [
    createSyntheticEvidencePlaceholder(syntheticEvidenceChecklist.items[0]!.key, 1),
  ],
});
const partialPreparation = prepareSyntheticEvidence({
  bundle: partialBundle,
  checklist: syntheticEvidenceChecklist,
  server_time: syntheticEvidenceServerTime,
});

export const claimantSyntheticSubmissionFixtures: readonly ClaimantSyntheticSubmissionFixture[] = [
  fixture(
    "assembled",
    "Envelope assembled safely",
    "Shows a complete synthetic package assembled locally without transmitting it.",
    createSyntheticReviewSubmissionInput(),
  ),
  fixture(
    "incomplete-evidence",
    "Incomplete evidence rejected",
    "Shows assembly stopping when selected evidence requirements remain pending.",
    createSyntheticReviewSubmissionInput({
      bundle: partialBundle,
      preparation: partialPreparation,
    }),
  ),
  fixture(
    "stale-version",
    "Stale case version rejected",
    "Shows optimistic version protection stopping an outdated assembly attempt.",
    createSyntheticReviewSubmissionInput({
      current_case_version: draft.expected_case_version + 1,
    }),
  ),
  fixture(
    "replay-rejected",
    "Replay attempt rejected",
    "Shows reused submission and idempotency identities failing closed.",
    createSyntheticReviewSubmissionInput({
      used_submission_refs: [draft.submission_ref],
      used_idempotency_keys: [draft.idempotency_key],
    }),
  ),
];

function fixture(
  key: ClaimantSyntheticSubmissionFixture["key"],
  label: string,
  description: string,
  input: Parameters<typeof assembleSyntheticReviewSubmission>[0],
): ClaimantSyntheticSubmissionFixture {
  return { key, label, description, result: assembleSyntheticReviewSubmission(input) };
}
