import type { ClaimantSyntheticAcknowledgementFixture } from "@/lib/claimant-synthetic-acknowledgement";

import { AcknowledgementBoundary } from "./acknowledgement-boundary";
import { AcknowledgementStatus } from "./acknowledgement-status";

export function SyntheticAcknowledgementPreview({
  fixtures,
}: {
  fixtures: readonly ClaimantSyntheticAcknowledgementFixture[];
}) {
  return (
    <div className="spaced-content">
      {fixtures.map((fixture) => (
        <section
          className="content-section"
          aria-labelledby={`acknowledgement-${fixture.key}`}
          key={fixture.key}
        >
          <header>
            <p className="eyebrow">Synthetic acknowledgement · {fixture.eyebrow}</p>
            <h2 id={`acknowledgement-${fixture.key}`}>{fixture.title}</h2>
            <p>This public projection intentionally omits internal receipt and case details.</p>
          </header>
          <div>
            <div className="acknowledgement-decision-grid">
              <AcknowledgementStatus fixture={fixture} />
              <AcknowledgementBoundary />
            </div>
            <dl className="acknowledgement-facts">
              <div><dt>Receipt confirmed</dt><dd>Yes</dd></div>
              <div><dt>Review started</dt><dd>No</dd></div>
              <div><dt>Release authorized</dt><dd>No</dd></div>
              <div><dt>Action required</dt><dd>{fixture.claimantActionRequired ? "Yes" : "No"}</dd></div>
            </dl>
            <div className="acknowledgement-next-action">
              <p className="eyebrow">Safe next step</p>
              <p>{fixture.nextAction}</p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
