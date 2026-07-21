import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Support",
  description: "Sanduqkin support boundaries and safe self-service information for the private preview.",
};

export default function SupportPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Support"
        title="Start with a safe path."
        aside={<><p className="eyebrow">Preview status</p><p>A monitored public support address is being approved. This preview does not accept support submissions.</p></>}
      >
        <p>Use the guidance below for this preview. Before public launch, this page must provide a verified, monitored contact and clear response expectations.</p>
      </PageIntro>

      <section className="content-section">
        <header><p className="eyebrow">Self-service</p><h2>Choose the right information</h2><p>No support route should ask for a secret.</p></header>
        <div className="content-grid">
          <article className="content-card"><h3>Account deletion</h3><p>Use the current in-app path and review what permanent deletion means.</p><p><Link className="text-link" href="/account-deletion">Deletion instructions →</Link></p></article>
          <article className="content-card"><h3>Trusted-recipient access</h3><p>Claims are not active. Keep any emergency code private and read the planned boundary.</p><p><Link className="text-link" href="/claim">Inactive claim notice →</Link></p></article>
          <article className="content-card"><h3>Security model</h3><p>Understand on-device encryption, metadata limits, and the current website boundary.</p><p><Link className="text-link" href="/security">Security approach →</Link></p></article>
          <article className="content-card"><h3>Accessibility</h3><p>Review the current accessibility target, known preview limits, and planned feedback route.</p><p><Link className="text-link" href="/accessibility">Accessibility statement →</Link></p></article>
        </div>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">Protect yourself</p><h2>Never send secrets to support</h2></header>
        <div><div className="callout"><strong>Sanduqkin support should never need your readable vault.</strong><p>Do not send a password, one-time authentication code, recovery phrase, private key, emergency code, plaintext vault entry, identity document, or payment-card number through email, chat, or a website form.</p></div><p className="spaced-content">Only trust contact details published on the official Sanduqkin domain after the public launch. This preview deliberately publishes no unapproved address.</p></div>
      </section>
    </main>
  );
}
