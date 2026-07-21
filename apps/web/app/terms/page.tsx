import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Terms of use — draft",
  description: "Draft Sanduqkin terms of use for review. Not yet effective.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Terms of use"
      title="Clear boundaries before public use."
      summary="These draft terms describe intended product rules but do not form an effective agreement. Entity, eligibility, governing law, payment, and dispute provisions require counsel approval."
    >
      <section><h2>1. Draft status</h2><p>These terms are provided only for product and legal review. They are not yet an offer, contract, or effective set of terms. Public availability must remain blocked until the missing legal and commercial provisions are approved.</p></section>
      <section><h2>2. The service</h2><p>Sanduqkin is designed as a mobile-first encrypted vault for organizing important information. The website currently provides information only. It does not create accounts, open vaults, accept claim applications, determine legal next-of-kin status, or release data to another person.</p></section>
      <section><h2>3. Account responsibilities</h2><p>When effective terms are introduced, account owners will be responsible for accurate registration information, protecting authentication and recovery material, maintaining secure devices, and using the service lawfully. Recovery phrases, passwords, emergency codes, and private keys must not be shared with Sanduqkin support.</p></section>
      <section><h2>4. Encryption and recovery</h2><p>Client-side encryption can limit the service’s ability to recover readable vault content. Losing approved recovery material may make encrypted content inaccessible. Final terms must explain the supported recovery model without promising that every loss scenario can be reversed.</p></section>
      <section><h2>5. Continuity and trusted recipients</h2><p>Emergency preparation in the mobile build is not a live claimant service. A person named by an owner or holding an emergency code has no present website claim route and no automatic right to release. Future identity, evidence, authority, review, approval, and revocation rules require separate security and legal approval.</p></section>
      <section><h2>6. Acceptable use</h2><p>Users must not attempt unauthorized access, probe another person’s account, interfere with security controls, upload unlawful material, misuse emergency information, impersonate another person, or use the service to evade applicable law. Security research needs a verified reporting channel, which must be published before launch.</p></section>
      <section><h2>7. Deletion, suspension, and availability</h2><p>The current mobile build provides an account-deletion path described on the <Link href="/account-deletion">account deletion page</Link>. Final terms must address notice, retention exceptions, subscription handling, lawful suspension, service changes, backups, and availability without overstating resilience.</p></section>
      <section><h2>8. Payments and third-party services</h2><p>Any final paid-service terms must identify prices, renewal and cancellation rules, taxes, refunds, app-store terms, entitlement processing, and the effect of deleting an account. Third-party platform terms may also apply.</p></section>
      <section><h2>9. Disclaimers</h2><p>To the fullest extent permitted by applicable law, the service will be provided on an “as is” and “as available” basis. Sanduqkin will not promise that the service is uninterrupted, error-free, immune from every security incident, or capable of restoring encrypted content when required recovery material has been lost. Nothing in the final terms may exclude a warranty, remedy, or consumer right that applicable law makes mandatory.</p></section>
      <section><h2>10. Excluded losses</h2><p>To the fullest extent permitted by applicable law, Sanduqkin will not be liable for indirect, incidental, special, consequential, exemplary, or punitive loss, or for loss of profits, revenue, business opportunity, goodwill, or use arising from the service. The final language requires counsel review for the selected launch jurisdictions and must not override rights that cannot lawfully be waived.</p></section>
      <section><h2>11. Intended liability cap</h2><p>To the fullest extent permitted by applicable law, the intended maximum aggregate liability of Sanduqkin and its affiliates, officers, employees, agents, and service providers for all claims arising out of or relating to the service or these terms is the total subscription fee the user paid for the service during the one month immediately before the event giving rise to the claim.</p><p>The cap is intended to apply regardless of the form of action and even if a limited remedy fails of its essential purpose. It will not apply to liability that cannot legally be limited or excluded. Counsel must approve the exact scope, protected parties, mandatory carve-outs, and treatment of users who paid no subscription fee before these terms become effective.</p></section>
      <section><h2>12. Legal provisions still required</h2><p>The responsible entity, minimum age, governing law, consumer rights, indemnity, dispute process, notices, termination, assignment, severability, contact details, and the mandatory exceptions to the intended liability provisions remain unresolved. This draft deliberately does not invent them.</p></section>
    </LegalDocument>
  );
}
