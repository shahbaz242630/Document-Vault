import type { ClaimantSyntheticDashboardFixture } from "@/lib/claimant-synthetic-dashboard";

export function SyntheticClaimantDashboardPreview({
  fixtures,
}: {
  fixtures: readonly ClaimantSyntheticDashboardFixture[];
}) {
  return (
    <div className="spaced-content">
      {fixtures.map((fixture) => (
        <section
          aria-labelledby={`synthetic-dashboard-${fixture.key}`}
          className="content-section"
          key={fixture.key}
        >
          <header>
            <p className="eyebrow">Synthetic case · {fixture.label}</p>
            <h2 id={`synthetic-dashboard-${fixture.key}`}>
              {fixture.projection.title}
            </h2>
            <p>{fixture.description}</p>
          </header>
          <div>
            <article className="content-card">
              <p className="eyebrow">Safe claimant view</p>
              <h3>{fixture.projection.summary}</h3>
              <p>
                <strong>Next step:</strong> {fixture.projection.next_action}
              </p>
              <p>
                Claimant action required: {fixture.projection.claimant_action_required ? "Yes" : "No"}
              </p>
            </article>

            <ol className="claim-progress spaced-content">
              {fixture.projection.milestones.map((milestone, index) => (
                <li key={milestone.key}>
                  <span className="claim-progress-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{milestone.label}</h3>
                    <p>
                      This preview shows only the coarse public journey stage.
                    </p>
                  </div>
                  <span className="claim-progress-state">
                    {formatMilestoneStatus(milestone.status)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ))}
    </div>
  );
}

function formatMilestoneStatus(status: "complete" | "current" | "upcoming") {
  if (status === "complete") return "Complete";
  if (status === "current") return "Current";
  return "Upcoming";
}
