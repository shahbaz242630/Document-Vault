import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import type { ClaimantInformationRoute } from "@/lib/claimant-portal";

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
    </main>
  );
}
