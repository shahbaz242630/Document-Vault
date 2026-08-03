import type { ClaimantSyntheticChecklistFixture } from "@/lib/claimant-synthetic-checklist";

import { ChecklistItem } from "./checklist-item";
import { ChecklistStatus } from "./checklist-status";
import { ChecklistSummary } from "./checklist-summary";
import { PolicyBoundary } from "./policy-boundary";

export function SyntheticChecklistPreview({ fixtures }: { fixtures: readonly ClaimantSyntheticChecklistFixture[] }) {
  return (
    <div className="spaced-content">
      {fixtures.map((fixture) => (
        <section className="content-section" aria-labelledby={`checklist-${fixture.key}`} key={fixture.key}>
          <header>
            <p className="eyebrow">Synthetic checklist fixture</p>
            <h2 id={`checklist-${fixture.key}`}>{fixture.label}</h2>
            <p>{fixture.description}</p>
          </header>
          <div>
            <div className="checklist-decision-grid">
              <ChecklistStatus checklist={fixture.checklist} />
              <PolicyBoundary checklist={fixture.checklist} />
            </div>
            <ChecklistSummary checklist={fixture.checklist} />
            {fixture.checklist.items.length > 0 ? (
              <ol className="claim-progress spaced-content">
                {fixture.checklist.items.map((item, index) => (
                  <ChecklistItem item={item} index={index} key={item.key} />
                ))}
              </ol>
            ) : (
              <p className="checklist-empty-state">No document requirements are shown until an applicable policy is selected.</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
