import type { ClaimantSyntheticSubmissionFixture } from "@/lib/claimant-synthetic-submission";

import { SubmissionBindings } from "./submission-bindings";
import { SubmissionBoundary } from "./submission-boundary";
import { SubmissionDeclarations } from "./submission-declarations";
import { SubmissionIssues } from "./submission-issues";
import { SubmissionManifest } from "./submission-manifest";
import { SubmissionStatus } from "./submission-status";

export function SyntheticSubmissionPreview({ fixtures }: { fixtures: readonly ClaimantSyntheticSubmissionFixture[] }) {
  return (
    <div className="spaced-content">
      {fixtures.map((fixture) => {
        const envelope = fixture.result.status === "assembled" ? fixture.result.envelope : null;
        return (
          <section className="content-section" aria-labelledby={`submission-${fixture.key}`} key={fixture.key}>
            <header>
              <p className="eyebrow">Synthetic assembly fixture</p>
              <h2 id={`submission-${fixture.key}`}>{fixture.label}</h2>
              <p>{fixture.description}</p>
            </header>
            <div>
              <div className="submission-decision-grid">
                <SubmissionStatus result={fixture.result} />
                <SubmissionBoundary />
              </div>
              <SubmissionBindings result={fixture.result} />
              <SubmissionIssues codes={fixture.result.issues} />
              {envelope ? (
                <>
                  <SubmissionManifest envelope={envelope} />
                  <SubmissionDeclarations declarations={envelope.declarations} />
                </>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
