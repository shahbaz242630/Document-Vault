import type { Metadata } from "next";
import Link from "next/link";

import { SyntheticSubmissionPreview } from "@/components/claimant-submission/synthetic-submission-preview";
import { PageIntro } from "@/components/page-intro";
import { claimantSyntheticSubmissionFixtures } from "@/lib/claimant-synthetic-submission";

export const metadata: Metadata = {
  title: "Synthetic claimant submission preview",
  description: "A non-operational preview of synthetic review-submission envelope outcomes.",
  robots: { index: false, follow: false },
};

export default function SyntheticClaimantSubmissionPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Claimant submission engineering preview"
        title="Synthetic submission assembly"
        aside={<><div className="claim-status"><span aria-hidden="true" /> Synthetic only</div><p>This preview cannot submit an application, start review, make a decision, or authorize release.</p></>}
      >
        <p>These deterministic fixtures exercise local envelope assembly and fail-closed rejection without personal information, document content, or vault data.</p>
      </PageIntro>

      <div className="callout"><strong>Read-only engineering fixture.</strong><p>Submit controls, authentication, network calls, persistence, notifications, review actions, retrieval, and decryption remain hard-disabled.</p></div>

      <SyntheticSubmissionPreview fixtures={claimantSyntheticSubmissionFixtures} />

      <p className="spaced-content"><Link className="text-link" href="/claim/synthetic-acknowledgement">View the read-only synthetic acknowledgement preview <span aria-hidden="true">→</span></Link></p>
      <p className="spaced-content"><Link className="text-link" href="/claim/synthetic-evidence">Return to synthetic evidence states <span aria-hidden="true">→</span></Link></p>
    </main>
  );
}
