import type { ClaimantSyntheticReviewTrackingView } from "@/lib/claimant-synthetic-review-tracking";

import { ReviewControlStatus } from "./review-control-status";
import { ReviewTrackingBoundary } from "./review-tracking-boundary";

export function SyntheticReviewTrackingPreview({
  views,
}: {
  views: readonly ClaimantSyntheticReviewTrackingView[];
}) {
  return (
    <div className="spaced-content">
      {views.map((view) => (
        <section
          className="content-section"
          aria-labelledby={`review-tracking-${view.key}`}
          key={view.key}
        >
          <header>
            <p className="eyebrow">Synthetic tracking example · {view.label}</p>
            <h2 id={`review-tracking-${view.key}`}>{view.projection.title}</h2>
            <p>{view.projection.summary}</p>
          </header>
          <div>
            <div className="review-tracking-grid">
              <article className="review-tracking-status">
                <p className="eyebrow">Safe progress view</p>
                <h3>{view.projection.title}</h3>
                <dl className="review-tracking-controls">
                  <ReviewControlStatus
                    label="Owner-protection checks"
                    status={view.projection.owner_protection_status}
                  />
                  <ReviewControlStatus
                    label="Independent review"
                    status={view.projection.review_status}
                  />
                </dl>
              </article>
              <ReviewTrackingBoundary />
            </div>
            <dl className="review-tracking-facts">
              <div><dt>Action required</dt><dd>{view.projection.claimant_action_required ? "Yes" : "No"}</dd></div>
              <div><dt>Decision displayed</dt><dd>No</dd></div>
              <div><dt>Release authorized</dt><dd>No</dd></div>
            </dl>
            <div className="review-tracking-next-action">
              <p className="eyebrow">Safe next step</p>
              <p>{view.projection.next_action}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
