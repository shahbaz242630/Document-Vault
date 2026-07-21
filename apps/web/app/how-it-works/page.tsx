import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Sanduqkin separates owner-controlled encryption from storage and future continuity review.",
};

export default function HowItWorksPage() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <PageIntro
        eyebrow="How it works"
        title="Your readable vault stays on your side of the boundary."
        aside={<><p className="eyebrow">Plain-language model</p><p>Encryption protects vault content. Account, billing, security, and operational metadata have different handling and are explained in the privacy draft.</p></>}
      >
        <p>The mobile app turns readable vault entries into encrypted records before they leave your device. Remote services authenticate the owner and store ciphertext without needing the plaintext vault.</p>
      </PageIntro>

      <section className="content-section">
        <header><p className="eyebrow">For the account owner</p><h2>Four deliberate steps</h2><p>The product is mobile-first. Public information and claim pages never ask for credentials or vault records; only the separately authenticated login and owner-vault flow does.</p></header>
        <ol className="steps">
          <li><h3>Create and verify your account</h3><p>Authentication establishes who may access the encrypted records tied to the account. It does not give the service a readable copy of the vault.</p></li>
          <li><h3>Unlock encryption locally</h3><p>The mobile client or protected browser worker derives or retrieves the material needed to open the vault. Sensitive key material is not intended to be logged, sent to the web server, or stored by Supabase.</p></li>
          <li><h3>Organize and encrypt</h3><p>Vault fields are encrypted on the device. The encrypted record and necessary operational metadata can then be stored and synchronized.</p></li>
          <li><h3>Plan recovery and deletion</h3><p>The owner can prepare recovery, review emergency settings, and permanently request account deletion from the mobile app.</p></li>
        </ol>
      </section>

      <section className="content-section">
        <header><p className="eyebrow">For a trusted recipient</p><h2>A future controlled process</h2><p>“Trusted recipient” means a person selected by the owner. It is not a legal finding of next-of-kin status.</p></header>
        <div>
          <ol className="steps">
            <li><h3>Owner prepares a route</h3><p>The owner may eventually register a person in advance or create a private emergency code to pass on separately.</p></li>
            <li><h3>The person applies</h3><p>A future claimant would authenticate and provide only the approved proof for the selected route.</p></li>
            <li><h3>Authority is reviewed</h3><p>Identity, code possession, relationship evidence, and release authority are separate questions. The final protocol is not yet approved.</p></li>
            <li><h3>Only an authorized package is released</h3><p>If approved in a future version, release would be limited to a claimant-specific sealed package and encrypted records—not an unrestricted service-side plaintext vault.</p></li>
          </ol>
          <div className="callout"><strong>This process is not live.</strong><p>Do not send an emergency code, recovery phrase, password, identity document, or vault information to this website or to an unverified support contact.</p></div>
          <p className="spaced-content"><Link className="text-link" href="/claim">Read the inactive claim notice <span aria-hidden="true">→</span></Link></p>
        </div>
      </section>
    </main>
  );
}
