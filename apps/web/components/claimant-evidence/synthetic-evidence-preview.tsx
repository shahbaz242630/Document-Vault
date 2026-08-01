import type { ClaimantSyntheticEvidenceFixture } from "@/lib/claimant-synthetic-evidence";

import { EvidenceBoundary } from "./evidence-boundary";
import { EvidenceIssues } from "./evidence-issues";
import { EvidenceItem } from "./evidence-item";
import { EvidenceStatus } from "./evidence-status";
import { EvidenceSummary } from "./evidence-summary";

export function SyntheticEvidencePreview({ fixtures }: { fixtures: readonly ClaimantSyntheticEvidenceFixture[] }) {
  return (
    <div className="spaced-content">
      {fixtures.map((fixture) => (
        <section className="content-section" aria-labelledby={`evidence-${fixture.key}`} key={fixture.key}>
          <header>
            <p className="eyebrow">Synthetic evidence fixture</p>
            <h2 id={`evidence-${fixture.key}`}>{fixture.label}</h2>
            <p>{fixture.description}</p>
          </header>
          <div>
            <div className="evidence-decision-grid">
              <EvidenceStatus preparation={fixture.preparation} />
              <EvidenceBoundary />
            </div>
            <EvidenceSummary preparation={fixture.preparation} />
            <EvidenceIssues codes={fixture.preparation.issues.map(({ code }) => code)} />
            <ol className="claim-progress spaced-content">
              {fixture.preparation.items.map((item, index) => (
                <EvidenceItem item={item} index={index} key={item.key} />
              ))}
            </ol>
          </div>
        </section>
      ))}
    </div>
  );
}
