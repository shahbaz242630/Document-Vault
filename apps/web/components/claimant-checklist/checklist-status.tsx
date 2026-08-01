import type { SyntheticRenderedChecklistV1 } from "@vault/shared-types";

const statusCopy = {
  documents_needed: {
    label: "Documents needed",
    explanation: "One or more selected requirements are still pending.",
  },
  ready_for_review: {
    label: "Ready for review",
    explanation: "The checklist is complete and awaits a separate controlled review.",
  },
  manual_review: {
    label: "Manual review required",
    explanation: "The synthetic policy engine stopped automatic checklist progression.",
  },
} as const;

const reasonLabels: Record<NonNullable<SyntheticRenderedChecklistV1["manual_review_reason"]>, string> = {
  missing_policy: "No applicable policy",
  conflicting_policy: "Conflicting policies",
  invalid_policy: "Policy integrity check failed",
  expired_policy: "Policy expired",
  document_unavailable: "Required document unavailable",
};

export function ChecklistStatus({ checklist }: { checklist: SyntheticRenderedChecklistV1 }) {
  const copy = statusCopy[checklist.status];

  return (
    <article className={`checklist-status checklist-status-${checklist.status}`}>
      <p className="eyebrow">Checklist status</p>
      <h3>{copy.label}</h3>
      <p>{copy.explanation}</p>
      {checklist.manual_review_reason ? (
        <p><strong>Safe routing reason:</strong> {reasonLabels[checklist.manual_review_reason]}</p>
      ) : null}
    </article>
  );
}
