import type { SyntheticReviewSubmissionAssemblyResultV1 } from "@vault/shared-types";

export function SubmissionBindings({ result }: { result: SyntheticReviewSubmissionAssemblyResultV1 }) {
  const envelope = result.status === "assembled" ? result.envelope : null;

  return (
    <dl className="submission-bindings" aria-label="Synthetic submission binding summary">
      <div><dt>Envelope</dt><dd>{envelope ? "Assembled" : "Not created"}</dd></div>
      <div><dt>Evidence items</dt><dd>{envelope?.evidence_manifest.length ?? 0}</dd></div>
      <div><dt>Declarations</dt><dd>{envelope?.declarations.length ?? 0}</dd></div>
      <div><dt>Policy bound</dt><dd>{envelope ? "Yes" : "No"}</dd></div>
    </dl>
  );
}
