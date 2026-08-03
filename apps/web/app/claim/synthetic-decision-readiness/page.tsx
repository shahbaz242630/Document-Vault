import type { Metadata } from "next";
import Link from "next/link";

import { SyntheticDecisionReadinessPreview } from "@/components/claimant-decision-readiness/synthetic-decision-readiness-preview";
import { PageIntro } from "@/components/page-intro";
import { claimantSyntheticDecisionReadinessViews } from "@/lib/claimant-synthetic-decision-readiness";

export const metadata: Metadata = {
  title: "Synthetic claimant decision and retrieval preview",
  description: "A non-operational preview of safe decision and retrieval-readiness states.",
  robots: { index: false, follow: false },
};

export default function SyntheticClaimantDecisionReadinessPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Claimant decision and retrieval engineering preview"
        title="Safe synthetic decision and retrieval states"
        aside={<><div className="claim-status"><span aria-hidden="true" /> Synthetic only</div><p>This preview cannot create a package or session, serve ciphertext, retrieve information, use a private key, decrypt, export, or authorize release.</p></>}
      >
        <p>These deterministic examples present pending, available, blocked, expired, suspended, closed, and fail-closed outcomes without exposing private decision reasons or creating retrieval capability.</p>
      </PageIntro>

      <div className="callout"><strong>Read-only engineering fixture.</strong><p>Authentication, network calls, persistence, package access, downloads, retrieval sessions, cryptography, local opening, export, and claimant confirmation remain absent or hard-disabled.</p></div>

      <SyntheticDecisionReadinessPreview views={claimantSyntheticDecisionReadinessViews} />

      <p className="spaced-content"><Link className="text-link" href="/claim/synthetic-review-tracking">Return to synthetic review-tracking states <span aria-hidden="true">→</span></Link></p>
    </main>
  );
}
