import type { Metadata } from "next";
import Link from "next/link";

import { SyntheticChecklistPreview } from "@/components/claimant-checklist/synthetic-checklist-preview";
import { PageIntro } from "@/components/page-intro";
import { claimantSyntheticChecklistFixtures } from "@/lib/claimant-synthetic-checklist";

export const metadata: Metadata = {
  title: "Synthetic claimant checklist preview",
  description: "A non-operational preview of policy-selected claimant requirements using synthetic fixtures only.",
  robots: { index: false, follow: false },
};

export default function SyntheticClaimantChecklistPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Claimant checklist engineering preview"
        title="Synthetic document requirements"
        aside={
          <>
            <div className="claim-status"><span aria-hidden="true" /> Synthetic only</div>
            <p>This preview cannot collect documents, change a case, complete review, or authorize release.</p>
          </>
        }
      >
        <p>These deterministic fixtures exercise checklist selection, completion, unavailable-document routing, and fail-closed policy handling without personal or vault data.</p>
      </PageIntro>

      <div className="callout">
        <strong>Read-only engineering fixture.</strong>
        <p>Authentication, intake, uploads, storage, review actions, notifications, retrieval, and decryption remain hard-disabled.</p>
      </div>

      <SyntheticChecklistPreview fixtures={claimantSyntheticChecklistFixtures} />

      <p className="spaced-content">
        <Link className="text-link" href="/claim/synthetic-preview">Return to synthetic dashboard states <span aria-hidden="true">→</span></Link>
      </p>
    </main>
  );
}
