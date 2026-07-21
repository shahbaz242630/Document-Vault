import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import {
  claimantApplicationStatuses,
  claimantDataBoundaries,
  claimantEvidenceChecklist,
  type ClaimantInformationRoute,
} from "@/lib/claimant-portal";

export function InactiveClaimRoutePage({ route }: { route: ClaimantInformationRoute }) {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="Trusted-recipient access"
        title={`${route.title} claims are not active.`}
        aside={<><div className="claim-status"><span aria-hidden="true" /> Information only</div><p>This route cannot create an account, accept personal information or a code, upload evidence, start a review, or release encrypted information.</p></>}
      >
        <p>{route.summary}</p>
      </PageIntro>

      <section className="content-section">
        <header><p className="eyebrow">Future route boundary</p><h2>Preparation is not authorization.</h2><p>{route.audience}</p></header>
        <div>
          <ol className="steps">
            {route.requirements.map((requirement) => <li key={requirement}><h3>{requirement}</h3></li>)}
          </ol>
          <div className="callout spaced-content"><strong>Do not submit information here.</strong><p>Keep emergency codes, identity documents, private keys, recovery phrases, passwords, and vault information out of this preview. Sanduqkin will publish a separately authenticated route only after its protocol, legal, privacy, security, and operating gates pass.</p></div>
          <p className="spaced-content"><Link className="text-link" href="/claim">Return to the claim access overview <span aria-hidden="true">→</span></Link></p>
        </div>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">Future application entry</p><h2>One secure review after route verification.</h2><p>The entry check differs by route. Identity, documents, owner protection, human review, and release controls remain independent.</p></header>
        <div>
          <ol className="steps">
            {route.startSteps.map((step) => <li key={step}><h3>{step}</h3></li>)}
          </ol>
          <div className="callout spaced-content"><strong>Placeholder only.</strong><p>Sign-in, code processing, application creation, and account verification are not connected on this page.</p></div>
        </div>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">Evidence checklist placeholder</p><h2>Documents stay out of email.</h2><p>The final checklist depends on jurisdiction, release authority, privacy, retention, and evidence-policy approval.</p></header>
        <div className="content-grid">
          {claimantEvidenceChecklist.map((item) => (
            <article className="content-card" key={item.key}>
              <p className="eyebrow">Required only if approved</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">Application progress placeholder</p><h2>A claimant can track each controlled state.</h2><p>Future status updates will use safe reason classes and will not reveal private reviewer notes, evidence contents, owner vault fields, or exploitable account-existence signals.</p></header>
        <ol className="claim-progress">
          {claimantApplicationStatuses.map((status, index) => (
            <li key={status.key}>
              <span className="claim-progress-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{status.label}</h3><p>{status.description}</p></div>
              <span className="claim-progress-state">Not active</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">Privacy boundary</p><h2>Review evidence without exposing the vault.</h2><p>Claim evidence and encrypted vault contents have different visibility rules.</p></header>
        <div className="content-grid">
          {claimantDataBoundaries.map((boundary) => (
            <article className="content-card" key={boundary.title}>
              <h3>{boundary.title}</h3>
              <p>{boundary.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
