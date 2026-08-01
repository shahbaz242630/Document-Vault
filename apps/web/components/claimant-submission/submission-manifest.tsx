import {
  claimantChecklistCatalogue,
  type SyntheticReviewSubmissionEnvelopeV1,
} from "@vault/shared-types";

export function SubmissionManifest({ envelope }: { envelope: SyntheticReviewSubmissionEnvelopeV1 }) {
  return (
    <section className="submission-detail" aria-label="Bound evidence manifest">
      <h3>Bound evidence manifest</h3>
      <ol className="claim-progress">
        {envelope.evidence_manifest.map(({ item_key }, index) => (
          <li key={item_key}>
            <span className="claim-progress-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3>{claimantChecklistCatalogue[item_key].label}</h3>
              <p>Synthetic placeholder bound to the assembled envelope.</p>
            </div>
            <span className="claim-progress-state submission-bound-state">Bound</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
