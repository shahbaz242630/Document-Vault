import type { SyntheticReviewSubmissionIssueCode } from "@vault/shared-types";

const issueLabels: Record<SyntheticReviewSubmissionIssueCode, string> = {
  invalid_draft: "The synthetic draft identity or version was rejected.",
  invalid_created_at: "The assembly timestamp is invalid.",
  created_in_future: "The assembly timestamp is in the future.",
  incomplete_declarations: "Every required declaration must be explicitly confirmed.",
  stale_case_version: "The case changed after this draft was prepared.",
  replayed_submission_ref: "This synthetic submission identity was already used.",
  replayed_idempotency_key: "This synthetic retry identity was already used.",
  evidence_not_ready: "Selected evidence requirements are not ready for review.",
  evidence_binding_mismatch: "The evidence preparation no longer matches its source bundle.",
};

export function SubmissionIssues({ codes }: { codes: readonly SyntheticReviewSubmissionIssueCode[] }) {
  if (codes.length === 0) return null;

  return (
    <aside className="submission-issues" aria-label="Safe assembly notices">
      <h3>Why assembly stopped</h3>
      <ul>{codes.map((code) => <li key={code}>{issueLabels[code]}</li>)}</ul>
    </aside>
  );
}
