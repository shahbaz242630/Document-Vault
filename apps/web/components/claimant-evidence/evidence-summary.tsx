import type { SyntheticEvidencePreparationV1 } from "@vault/shared-types";

export function EvidenceSummary({ preparation }: { preparation: SyntheticEvidencePreparationV1 }) {
  const count = (availability: SyntheticEvidencePreparationV1["items"][number]["availability"]) =>
    preparation.items.filter((item) => item.availability === availability).length;

  return (
    <dl className="evidence-summary" aria-label="Synthetic evidence preparation summary">
      <div><dt>Selected</dt><dd>{preparation.items.length}</dd></div>
      <div><dt>Prepared</dt><dd>{count("available")}</dd></div>
      <div><dt>Still needed</dt><dd>{count("pending")}</dd></div>
      <div><dt>Unavailable</dt><dd>{count("not_available")}</dd></div>
    </dl>
  );
}
