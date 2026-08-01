import type { SyntheticPreparedEvidenceItemV1 } from "@vault/shared-types";

const availabilityCopy = {
  pending: { label: "Needed", detail: "No accepted synthetic placeholder is attached." },
  available: { label: "Prepared", detail: "A valid synthetic placeholder is prepared for review." },
  not_available: { label: "Unavailable", detail: "This requirement needs controlled manual handling." },
} as const;

export function EvidenceItem({ item, index }: { item: SyntheticPreparedEvidenceItemV1; index: number }) {
  const copy = availabilityCopy[item.availability];

  return (
    <li>
      <span className="claim-progress-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div>
        <p className="evidence-item-source">
          {item.source === "common" ? "Common requirement" : "Policy-selected requirement"}
        </p>
        <h3>{item.label}</h3>
        <p>{copy.detail}</p>
      </div>
      <span className={`claim-progress-state evidence-availability-${item.availability}`}>
        {copy.label}
      </span>
    </li>
  );
}
