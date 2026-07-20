import type { Metadata } from "next";

import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Security",
  description: "A plain-language explanation of Sanduqkin's encryption boundary, safeguards, and current limits.",
};

export default function SecurityPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Security approach"
        title="Protect the plaintext. Minimize what crosses the boundary."
        aside={<><p className="eyebrow">Responsible disclosure</p><p>A monitored security-reporting address must be approved before public launch. This preview does not accept vulnerability reports.</p></>}
      >
        <p>Sanduqkin is designed so readable vault content is encrypted in the owner’s mobile or browser client before storage. Security also depends on account protection, safe recovery, tested deletion, operational controls, and honest limits.</p>
      </PageIntro>

      <section className="content-section">
        <header><p className="eyebrow">Core boundary</p><h2>What encryption does</h2><p>Encryption protects vault fields; it does not make every piece of service metadata invisible.</p></header>
        <div className="content-grid">
          <article className="content-card"><h3>Before storage</h3><p>The mobile app and protected browser vault encrypt supported fields before remote persistence. Storage services receive ciphertext rather than readable vault content.</p></article>
          <article className="content-card"><h3>Key separation</h3><p>Encryption-key and recovery design aims to keep plaintext key material away from application logs, analytics, support systems, storage services, and the web server.</p></article>
          <article className="content-card"><h3>Owner isolation</h3><p>Database access policies and API authorization are tested against cross-account reads and writes. These controls complement—not replace—encryption.</p></article>
          <article className="content-card"><h3>Permanent deletion</h3><p>Account deletion requests remove encrypted vault data and related account material through a controlled processor, subject to approved retention obligations.</p></article>
        </div>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">Important limits</p><h2>What we do not claim</h2><p>Precise language is part of the security model.</p></header>
        <div>
          <ul>
            <li>We do not claim that all metadata is end-to-end encrypted.</li>
            <li>We do not claim multi-region database failover or uninterrupted availability.</li>
            <li>We do not claim that biometrics replace account authentication or recovery safeguards.</li>
            <li>We do not claim that a trusted recipient or emergency-code holder can currently submit or complete a claim.</li>
            <li>We do not ask anyone to send a password, recovery phrase, emergency code, plaintext vault record, or private key through this site.</li>
          </ul>
          <div className="callout"><strong>Preview boundary</strong><p>The public information and inactive claim routes collect no data. Login and owner-vault routes are separately authenticated, use essential session cookies and a browser crypto worker, and remain protected engineering surfaces—not a public claimant service.</p></div>
        </div>
      </section>
    </main>
  );
}
