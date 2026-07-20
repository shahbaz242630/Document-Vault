import type { Metadata } from "next";

import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Features",
  description: "Current Sanduqkin mobile-vault capabilities and clearly labelled future continuity features.",
};

const currentFeatures = [
  ["Structured vault", "Organize personal, property, financial, insurance, digital, and continuity information in purpose-built record types."],
  ["On-device encryption", "Readable vault content is encrypted on your device before encrypted records are sent for remote storage."],
  ["Local unlock", "Supported device authentication can protect convenient return access after the vault has been opened securely."],
  ["Recovery preparation", "A recovery flow helps the account owner prepare for loss of normal device access. Recovery material remains the owner’s responsibility."],
  ["Deletion controls", "Delete individual records, manage recently deleted items, or permanently request deletion of the account and associated vault data."],
  ["Emergency preparation", "The mobile build can prepare a sealed emergency-code package, but no web claim, review, or release service is active."],
] as const;

export default function FeaturesPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Product features"
        title="Useful now. Honest about what comes next."
        aside={<><p className="eyebrow">Current boundary</p><p>These pages describe the reviewed mobile build. The website does not open accounts or vaults.</p></>}
      >
        <p>Sanduqkin is a mobile-first encrypted vault. We describe only capabilities present in the current build and label continuity work that is still being designed.</p>
      </PageIntro>

      <section className="content-section">
        <header><p className="eyebrow">Available in the mobile build</p><h2>Private record keeping</h2><p>Features are designed around deliberate control and a clear encryption boundary.</p></header>
        <div className="content-grid">
          {currentFeatures.map(([title, description], index) => (
            <article className="content-card" key={title}>
              <p className="eyebrow">Current · {String(index + 1).padStart(2, "0")}</p>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">Future, not active</p><h2>Controlled continuity</h2><p>These concepts require separate security, legal, identity, and release-authority approval.</p></header>
        <div>
          <div className="callout"><strong>No live claim route exists.</strong><p>The website and mobile app do not currently accept a trusted-recipient application or release vault data to another person.</p></div>
          <div className="content-grid spaced-grid">
            <article className="content-card"><p className="eyebrow">Planned route</p><h3>Pre-registered recipient</h3><p>An account owner may eventually nominate a person who verifies their own account in advance. Registration will not itself authorize release.</p></article>
            <article className="content-card"><p className="eyebrow">Planned route</p><h3>Private emergency code</h3><p>A person holding a code may eventually prove possession and apply. A code will not itself establish identity, relationship, or entitlement.</p></article>
          </div>
        </div>
      </section>
    </main>
  );
}
