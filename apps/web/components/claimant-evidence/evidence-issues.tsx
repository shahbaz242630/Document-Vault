import type { SyntheticEvidencePreparationIssueCode } from "@vault/shared-types";

const issueLabels: Record<SyntheticEvidencePreparationIssueCode, string> = {
  checklist_unavailable: "No preparable checklist is available.",
  invalid_bundle: "The synthetic bundle identity was rejected.",
  policy_binding_mismatch: "The bundle does not match the selected policy version.",
  unexpected_item: "An unselected requirement was supplied.",
  duplicate_item: "A requirement appeared more than once.",
  duplicate_placeholder_ref: "A placeholder reference appeared more than once.",
  invalid_placeholder: "A placeholder identity was rejected.",
  invalid_display_label: "A placeholder label was rejected.",
  unsupported_media_type: "A placeholder media type is unsupported.",
  invalid_size: "A placeholder size is outside the synthetic limit.",
  invalid_prepared_at: "A preparation timestamp is invalid.",
  prepared_in_future: "A preparation timestamp is in the future.",
  document_unavailable: "A selected requirement was declared unavailable.",
};

export function EvidenceIssues({ codes }: { codes: readonly SyntheticEvidencePreparationIssueCode[] }) {
  if (codes.length === 0) return null;

  return (
    <aside className="evidence-issues" aria-label="Safe preparation notices">
      <h3>Why preparation stopped</h3>
      <ul>{codes.map((code, index) => <li key={`${code}-${index}`}>{issueLabels[code]}</li>)}</ul>
    </aside>
  );
}
