import type { SyntheticEvidencePreparationV1 } from "@vault/shared-types";

const statusCopy = {
  documents_needed: {
    label: "More evidence needed",
    explanation: "Accepted synthetic placeholders are recorded, but selected requirements remain pending.",
  },
  ready_for_review: {
    label: "Ready for controlled review",
    explanation: "Preparation is complete; a separate review must still make any decision.",
  },
  manual_review: {
    label: "Manual review required",
    explanation: "Preparation stopped safely and no automatic progression occurred.",
  },
} as const;

const reasonLabels: Record<NonNullable<SyntheticEvidencePreparationV1["manual_review_reason"]>, string> = {
  checklist_unavailable: "Checklist unavailable",
  binding_mismatch: "Policy binding mismatch",
  invalid_metadata: "Placeholder metadata rejected",
  document_unavailable: "Required evidence unavailable",
};

export function EvidenceStatus({ preparation }: { preparation: SyntheticEvidencePreparationV1 }) {
  const copy = statusCopy[preparation.status];

  return (
    <article className={`evidence-status evidence-status-${preparation.status}`}>
      <p className="eyebrow">Preparation status</p>
      <h3>{copy.label}</h3>
      <p>{copy.explanation}</p>
      {preparation.manual_review_reason ? (
        <p><strong>Safe routing reason:</strong> {reasonLabels[preparation.manual_review_reason]}</p>
      ) : null}
    </article>
  );
}
