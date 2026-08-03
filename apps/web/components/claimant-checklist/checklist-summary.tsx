import type { SyntheticRenderedChecklistV1 } from "@vault/shared-types";

export function ChecklistSummary({ checklist }: { checklist: SyntheticRenderedChecklistV1 }) {
  const available = checklist.items.filter(({ availability }) => availability === "available").length;
  const pending = checklist.items.filter(({ availability }) => availability === "pending").length;
  const unavailable = checklist.items.filter(({ availability }) => availability === "not_available").length;

  return (
    <dl className="checklist-summary" aria-label="Synthetic checklist summary">
      <div><dt>Selected</dt><dd>{checklist.items.length}</dd></div>
      <div><dt>Available</dt><dd>{available}</dd></div>
      <div><dt>Still needed</dt><dd>{pending}</dd></div>
      <div><dt>Unavailable</dt><dd>{unavailable}</dd></div>
    </dl>
  );
}
