import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { SyntheticClaimantDashboardPreview } from "@/components/synthetic-claimant-dashboard-preview";
import { claimantSyntheticDashboardFixtures } from "@/lib/claimant-synthetic-dashboard";

export const metadata: Metadata = {
  title: "Synthetic claimant dashboard preview",
  description:
    "A non-operational preview of safe claimant journey states using synthetic fixtures only.",
  robots: { index: false, follow: false },
};

export default function SyntheticClaimantDashboardPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Claimant journey engineering preview"
        title="Synthetic dashboard states"
        aside={
          <>
            <div className="claim-status">
              <span aria-hidden="true" /> Synthetic only
            </div>
            <p>
              This preview cannot create or update a case, accept personal
              information, or release encrypted information.
            </p>
          </>
        }
      >
        <p>
          These deterministic examples test the safe public dashboard vocabulary.
          They contain no real claimant, owner, reviewer, evidence, or vault data.
        </p>
      </PageIntro>

      <div className="callout">
        <strong>Read-only engineering fixture.</strong>
        <p>
          Authentication, claim intake, uploads, review actions, notifications,
          retrieval, decryption, and persistence remain hard-disabled.
        </p>
      </div>

      <SyntheticClaimantDashboardPreview
        fixtures={claimantSyntheticDashboardFixtures}
      />

      <p className="spaced-content">
        <Link className="text-link" href="/claim">
          Return to the inactive claim overview <span aria-hidden="true">→</span>
        </Link>
      </p>
    </main>
  );
}
