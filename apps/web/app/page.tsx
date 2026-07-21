import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Private records, thoughtfully protected",
  description:
    "A calm, encrypted place for important records, with controlled continuity features being developed in reviewed stages.",
};

export default function HomePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">A private home for what matters</p>
          <h1>Keep the record. Protect the meaning.</h1>
          <p className="lede">
            Sanduqkin helps you organize important information in an encrypted mobile
            vault—so it stays useful to you today and can be prepared for carefully
            controlled continuity tomorrow.
          </p>
          <div className="hero-actions">
            <Link className="button-link" href="/how-it-works">See how it works</Link>
            <Link className="text-link" href="/security">Read our security approach <span aria-hidden="true">↗</span></Link>
          </div>
        </div>

        <aside className="vault-illustration" aria-label="Sanduqkin protection model">
          <div className="vault-orbit orbit-one" aria-hidden="true" />
          <div className="vault-orbit orbit-two" aria-hidden="true" />
          <div className="vault-core">
            <span className="vault-monogram">S</span>
            <strong>Your vault</strong>
            <small>Encrypted before storage</small>
          </div>
          <div className="orbit-label orbit-label-one"><span /> You control access</div>
          <div className="orbit-label orbit-label-two"><span /> Services store ciphertext</div>
        </aside>
      </section>

      <section className="trust-strip" aria-label="Product principles">
        <p><span aria-hidden="true">01</span> On-device encryption</p>
        <p><span aria-hidden="true">02</span> Structured private records</p>
        <p><span aria-hidden="true">03</span> No advertising trackers</p>
      </section>

      <section className="section-block feature-overview">
        <div className="section-heading">
          <p className="eyebrow">Built for clarity</p>
          <h2>Security should feel calm, not complicated.</h2>
          <p>Sanduqkin separates readable vault content from the services that store and move encrypted data.</p>
        </div>
        <div className="feature-grid">
          <article><span className="feature-number">01</span><h3>Organize what matters</h3><p>Keep important personal, financial, property, and continuity records in structured categories.</p></article>
          <article><span className="feature-number">02</span><h3>Encrypt before sync</h3><p>Vault content is encrypted on your device before ciphertext is sent for storage.</p></article>
          <article><span className="feature-number">03</span><h3>Stay in control</h3><p>Local unlock, recovery, deletion, and emergency preparation remain deliberate user actions.</p></article>
        </div>
        <Link className="text-link section-link" href="/features">Explore current features <span aria-hidden="true">→</span></Link>
      </section>

      <section className="section-block continuity-section">
        <div className="continuity-index" aria-hidden="true">02</div>
        <div className="continuity-copy">
          <p className="eyebrow">Continuity, with safeguards</p>
          <h2>A trusted recipient is a person you choose—not an automatic release.</h2>
          <p>
            Sanduqkin is developing two future routes: a person you register in advance,
            or a private emergency code you hand over yourself. Neither route currently
            accepts claims, and possession alone will not guarantee access.
          </p>
          <div className="future-badge">Future capability — not active</div>
          <Link className="text-link" href="/claim">Understand the planned process <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="section-block principle-quote">
        <blockquote>“Privacy is not a setting added later. It is the boundary the product begins with.”</blockquote>
        <p>Our product principle</p>
      </section>

      <section className="closing-panel">
        <div>
          <p className="eyebrow">Private by design</p>
          <h2>Your records deserve a thoughtful home.</h2>
        </div>
        <div>
          <p>This preview explains the product and its boundaries. Accounts and claim applications are not available on the web.</p>
          <Link className="button-link button-light" href="/privacy">Review the privacy draft</Link>
        </div>
      </section>
    </main>
  );
}
