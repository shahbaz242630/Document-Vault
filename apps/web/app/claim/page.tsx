import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { claimantInformationRoutes, claimantPortalStages } from "@/lib/claimant-portal";

export const metadata: Metadata = {
  title: "Claim access — not active",
  description: "Information about Sanduqkin's planned trusted-recipient routes. Claim applications are not active.",
  robots: { index: false, follow: false },
};

export default function ClaimPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Trusted-recipient access"
        title="Claim applications are not active."
        aside={<><div className="claim-status"><span aria-hidden="true" /> Not accepting applications</div><p>No claim can be started, reviewed, approved, or released through this website or the app today.</p></>}
      >
        <p>This page explains the planned process so that an emergency code or prior registration is not mistaken for automatic access. It does not accept a code, identity information, evidence, or a claim.</p>
      </PageIntro>

      <section className="content-section">
        <header><p className="eyebrow">Two planned routes</p><h2>Different preparation, one controlled review</h2><p>Both routes remain subject to future security, legal, and release-authority approval.</p></header>
        <div className="content-grid">
          {claimantInformationRoutes.map((route) => (
            <article className="content-card" key={route.key}>
              <p className="eyebrow">{route.eyebrow}</p>
              <h3>{route.title}</h3>
              <p>{route.summary}</p>
              <p><Link className="text-link" href={route.href}>Review the inactive route boundary <span aria-hidden="true">→</span></Link></p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">Planned portal structure</p><h2>Release is the final controlled state.</h2><p>The portal will separate account control, identity, evidence, review, owner protection, and cryptographic release.</p></header>
        <div>
          <ol className="steps">
            {claimantPortalStages.map((stage) => <li key={stage.title}><h3>{stage.title}</h3><p>{stage.description}</p></li>)}
          </ol>
          <p className="spaced-content"><Link className="text-link" href="/claim/synthetic-evidence">View the read-only synthetic evidence preview <span aria-hidden="true">→</span></Link></p>
          <p className="spaced-content"><Link className="text-link" href="/claim/synthetic-checklist">View the read-only synthetic checklist preview <span aria-hidden="true">→</span></Link></p>
          <p className="spaced-content"><Link className="text-link" href="/claim/synthetic-preview">View the read-only synthetic dashboard preview <span aria-hidden="true">→</span></Link></p>
        </div>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">If you hold a code</p><h2>Keep it private.</h2><p>A safe submission path does not exist yet.</p></header>
        <div>
          <div className="callout"><strong>Do not enter or send the code.</strong><p>Do not share it through email, chat, a search box, a support message, a URL, or an unfamiliar website. Sanduqkin will not ask for it until an official, authenticated claim path is launched.</p></div>
          <h3 className="spaced-heading">What you can do now</h3>
          <ul>
            <li>Keep the code and any accompanying instructions in a secure place.</li>
            <li>Do not combine it with passwords, recovery phrases, or identity documents.</li>
            <li>Return to the official Sanduqkin domain for future availability notices.</li>
            <li>Remember that an application, if launched, will not guarantee release.</li>
          </ul>
          <p><Link className="text-link" href="/how-it-works">Understand the planned review model <span aria-hidden="true">→</span></Link></p>
        </div>
      </section>
    </main>
  );
}
