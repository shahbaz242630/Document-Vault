import type { ClaimantSyntheticDecisionReadinessView } from "@/lib/claimant-synthetic-decision-readiness";

import { DecisionReadinessBoundary } from "./decision-readiness-boundary";
import { DecisionReadinessStatus } from "./decision-readiness-status";

export function SyntheticDecisionReadinessPreview({
  views,
}: {
  views: readonly ClaimantSyntheticDecisionReadinessView[];
}) {
  return (
    <div className="spaced-content">
      {views.map((view) => (
        <section
          className="content-section"
          aria-labelledby={`decision-readiness-${view.key}`}
          key={view.key}
        >
          <header>
            <p className="eyebrow">Synthetic status example · {view.label}</p>
            <h2 id={`decision-readiness-${view.key}`}>{view.projection.title}</h2>
            <p>{view.projection.summary}</p>
          </header>
          <div>
            <div className="decision-readiness-grid">
              <article className="decision-readiness-status">
                <p className="eyebrow">Safe claimant status</p>
                <h3>{view.projection.title}</h3>
                <DecisionReadinessStatus
                  decisionStatus={view.projection.decision_status}
                  retrievalStatus={view.projection.retrieval_status}
                />
              </article>
              <DecisionReadinessBoundary />
            </div>
            <dl className="decision-readiness-facts">
              <div><dt>Action required</dt><dd>{view.projection.claimant_action_required ? "Yes" : "No"}</dd></div>
              <div><dt>Runtime action performed</dt><dd>No</dd></div>
              <div><dt>Release authorized</dt><dd>No</dd></div>
              <div><dt>Decryption authorized</dt><dd>No</dd></div>
            </dl>
            <div className="decision-readiness-next-action">
              <p className="eyebrow">Safe next step</p>
              <p>{view.projection.next_action}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
