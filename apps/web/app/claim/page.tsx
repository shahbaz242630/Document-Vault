import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";

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
          <article className="content-card"><p className="eyebrow">Route 01 · Future</p><h3>Pre-registered trusted recipient</h3><p>The account owner selects a person, who may eventually verify a separate account in advance. Being registered will not itself prove legal entitlement or trigger release.</p></article>
          <article className="content-card"><p className="eyebrow">Route 02 · Future</p><h3>Private emergency code</h3><p>The account owner gives a private code directly to a chosen person. Holding it may eventually support proof of possession, but will not itself prove identity, relationship, or release authority.</p></article>
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
