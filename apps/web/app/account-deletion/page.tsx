import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument } from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Account deletion",
  description: "How to request permanent deletion from the current Sanduqkin mobile build and the web-channel status.",
};

export default function AccountDeletionPage() {
  return (
    <LegalDocument
      eyebrow="Account deletion"
      title="Permanent means permanent."
      summary="The current mobile build includes an in-app deletion path. A public web request channel is not active in this protected preview and must be approved before store publication."
    >
      <section><h2>Delete from the mobile app</h2><ol><li>Open Sanduqkin and unlock your account.</li><li>Open <strong>Settings</strong>.</li><li>Select <strong>Delete account</strong>.</li><li>Review the irreversible-deletion warning.</li><li>Type <strong>DELETE</strong> exactly as shown.</li><li>Select <strong>Permanently delete account</strong>.</li></ol><p>The app submits the authenticated deletion request, locks the vault, removes local encryption material and settings, clears the local session, and starts the controlled server-side deletion process.</p></section>
      <section><h2>What deletion is intended to cover</h2><p>Deletion is intended to remove the account, encrypted vault records, encryption-key material held for the account, emergency grants, and associated application data through the approved deletion processor. Final legal review must identify any narrow information that must be retained for security, fraud prevention, transaction records, disputes, or law—and the applicable period.</p></section>
      <section><h2>Before deleting</h2><ul><li>Deletion cannot be undone and encrypted records cannot be restored afterward.</li><li>Cancel any app-store subscription separately if the store does not cancel it automatically.</li><li>Do not delete the account merely to troubleshoot sign-in or recovery; use the future verified support route instead.</li><li>Never send recovery or emergency secrets to request deletion.</li></ul></section>
      <section><h2>If the app is unavailable</h2><div className="callout"><strong>Web deletion requests are not active yet.</strong><p>This preview cannot accept personal information or deletion requests. A verified public contact or authenticated web pathway must be live, tested, and stated here before this URL is supplied to an app store as a deletion resource.</p></div><p>Until then, use the in-app path. Do not send account data to an address that is not published on the official Sanduqkin domain.</p></section>
      <section><h2>Related information</h2><p>See the <Link href="/privacy">privacy draft</Link> for the unresolved retention and rights disclosures. The owner’s deletion flow is separate from any future trusted-recipient application.</p></section>
    </LegalDocument>
  );
}
