import type { Metadata } from "next";
import Link from "next/link";

import { SyntheticEvidencePreview } from "@/components/claimant-evidence/synthetic-evidence-preview";
import { PageIntro } from "@/components/page-intro";
import { claimantSyntheticEvidenceFixtures } from "@/lib/claimant-synthetic-evidence";

export const metadata: Metadata = {
  title: "Synthetic claimant evidence preview",
  description: "A non-operational preview of synthetic claimant evidence-preparation outcomes.",
  robots: { index: false, follow: false },
};

export default function SyntheticClaimantEvidencePage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Claimant evidence engineering preview"
        title="Synthetic evidence preparation"
        aside={
          <>
            <div className="claim-status"><span aria-hidden="true" /> Synthetic only</div>
            <p>This preview cannot accept files, collect personal information, start review, or authorize release.</p>
          </>
        }
      >
        <p>These deterministic fixtures exercise placeholder readiness and fail-closed routing without document content, claimant data, or vault data.</p>
      </PageIntro>

      <div className="callout">
        <strong>Read-only engineering fixture.</strong>
        <p>File selection, uploads, authentication, storage, review actions, notifications, retrieval, and decryption remain hard-disabled.</p>
      </div>

      <SyntheticEvidencePreview fixtures={claimantSyntheticEvidenceFixtures} />

      <p className="spaced-content">
        <Link className="text-link" href="/claim/synthetic-checklist">Return to synthetic checklist states <span aria-hidden="true">→</span></Link>
      </p>
    </main>
  );
}
