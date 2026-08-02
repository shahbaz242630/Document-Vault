import type { Metadata } from "next";
import Link from "next/link";

import { SyntheticAcknowledgementPreview } from "@/components/claimant-acknowledgement/synthetic-acknowledgement-preview";
import { PageIntro } from "@/components/page-intro";
import { claimantSyntheticAcknowledgementFixtures } from "@/lib/claimant-synthetic-acknowledgement";

export const metadata: Metadata = {
  title: "Synthetic claimant acknowledgement preview",
  description: "A non-operational preview of safe claimant receipt acknowledgements.",
  robots: { index: false, follow: false },
};

export default function SyntheticClaimantAcknowledgementPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Claimant acknowledgement engineering preview"
        title="Safe synthetic receipt acknowledgement"
        aside={<><div className="claim-status"><span aria-hidden="true" /> Synthetic only</div><p>This preview does not submit information, start review, make a decision, or authorize release.</p></>}
      >
        <p>These deterministic fixtures show new and already-received outcomes through an allowlisted public view with no claimant, owner, reviewer, evidence, or vault identifiers.</p>
      </PageIntro>

      <div className="callout"><strong>Read-only engineering fixture.</strong><p>References, versions, internal reasons, exact timing, network calls, persistence, notifications, review actions, retrieval, and decryption remain absent or hard-disabled.</p></div>

      <SyntheticAcknowledgementPreview fixtures={claimantSyntheticAcknowledgementFixtures} />

      <p className="spaced-content"><Link className="text-link" href="/claim/synthetic-review-tracking">View the read-only synthetic review-tracking preview <span aria-hidden="true">→</span></Link></p>
      <p className="spaced-content"><Link className="text-link" href="/claim/synthetic-submission">Return to synthetic submission states <span aria-hidden="true">→</span></Link></p>
    </main>
  );
}
