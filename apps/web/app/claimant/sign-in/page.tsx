import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Claimant sign in",
};

export default function ClaimantSignInPage() {
  return (
    <main id="main-content" className="auth-page" tabIndex={-1}>
      <section className="auth-layout" aria-labelledby="claimant-sign-in-title">
        <div className="auth-intro">
          <p className="eyebrow">Protected claimant application</p>
          <h1 id="claimant-sign-in-title">Claimant access is being prepared.</h1>
          <p className="auth-intro-copy">
            This disabled engineering shell does not accept invitations, evidence, emergency codes,
            private keys, or claim information.
          </p>
        </div>
        <div className="auth-card">
          <header className="auth-card-header">
            <span className="auth-status"><span aria-hidden="true" /> Synthetic identities only</span>
            <h2>Eligibility comes before a claimant session</h2>
            <p>
              Authentication and multi-factor assurance do not create claimant eligibility. The
              server must approve a pre-provisioned synthetic portal identity before activation.
            </p>
          </header>
        </div>
      </section>
    </main>
  );
}
