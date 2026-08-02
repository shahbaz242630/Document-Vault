import type { Metadata } from "next";
import Link from "next/link";

import { SyntheticReviewTrackingPreview } from "@/components/claimant-review-tracking/synthetic-review-tracking-preview";
import { PageIntro } from "@/components/page-intro";
import { claimantSyntheticReviewTrackingViews } from "@/lib/claimant-synthetic-review-tracking";

export const metadata: Metadata = {
  title: "Synthetic claimant review tracking preview",
  description: "A non-operational preview of safe owner-protection and review progress.",
  robots: { index: false, follow: false },
};

export default function SyntheticClaimantReviewTrackingPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Claimant review-tracking engineering preview"
        title="Safe synthetic protection and review tracking"
        aside={<><div className="claim-status"><span aria-hidden="true" /> Synthetic only</div><p>This preview cannot contact an owner, assign a reviewer, progress a case, record a decision, or authorize release.</p></>}
      >
        <p>These deterministic examples show coarse public progress without private communications, reviewer details, internal controls, exact timing, or decision information.</p>
      </PageIntro>

      <div className="callout"><strong>Read-only engineering fixture.</strong><p>Authentication, network calls, persistence, notices, timers, review actions, case transitions, retrieval, and decryption remain absent or hard-disabled.</p></div>

      <SyntheticReviewTrackingPreview views={claimantSyntheticReviewTrackingViews} />

      <p className="spaced-content"><Link className="text-link" href="/claim/synthetic-acknowledgement">Return to synthetic acknowledgement states <span aria-hidden="true">→</span></Link></p>
    </main>
  );
}
