import type { SyntheticRenderedChecklistItemV1 } from "@vault/shared-types";

const availabilityLabels = {
  pending: "Needed",
  available: "Available",
  not_available: "Not available",
} as const;

export function ChecklistItem({ item, index }: { item: SyntheticRenderedChecklistItemV1; index: number }) {
  return (
    <li>
      <span className="claim-progress-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div>
        <p className="checklist-item-source">
          {item.source === "common" ? "Common requirement" : "Policy-selected requirement"}
        </p>
        <h3>{item.label}</h3>
        <p>{item.explanation}</p>
      </div>
      <span className={`claim-progress-state checklist-availability-${item.availability}`}>
        {availabilityLabels[item.availability]}
      </span>
    </li>
  );
}
