# Sanduqkin Web Legal Content Review

Status: **Publication blocked — Phase 3 preview only**

Content version: **Preview draft 0.1**
Last reviewed: **2026-07-19**

This internal checklist tracks unresolved fields outside the rendered website. No token below should be copied into public copy as if it were approved.

## Required before Phase 4 public-domain publication

- [ ] Confirm the contracting legal entity name, type, registration number, and registered address.
- [ ] Confirm the privacy controller identity and whether a DPO or representative is required.
- [ ] Approve monitored `privacy@`, `support@`, `security@`, accessibility, and legal-notice contact routes on the official domain.
- [ ] Confirm initial launch countries and whether UAE federal, DIFC, ADGM, Saudi, Bahrain, Qatar, Oman, Kuwait, EU/UK, or other rules apply.
- [ ] Approve governing law, venue, consumer-rights, dispute, warranty, limitation, indemnity, termination, and notices provisions.
- [x] Record the owner's commercial position that aggregate liability should be capped at the subscription fee paid during the one month immediately before the event giving rise to the claim.
- [ ] Have qualified counsel validate the one-month liability cap, the exclusion of indirect and consequential losses, the entities and people protected by the clause, treatment of free users, and every non-excludable liability or mandatory consumer-remedy carve-out in each launch jurisdiction.
- [ ] Approve minimum age and any parental-consent position.
- [ ] Approve the data inventory: account identifiers, encrypted vault ciphertext, operational metadata, device/session context, audit events, subscriptions, deletion requests, and emergency settings.
- [ ] Approve the purpose and lawful basis for each data category and launch jurisdiction.
- [ ] Confirm the named processor/subprocessor list, including Supabase, Vercel, RevenueCat, Apple, and any future email or monitoring provider.
- [ ] Confirm processing locations, cross-border transfer position, safeguards, and change-notification method.
- [ ] Approve a record-level retention schedule for active data, soft-deleted records, backups, security/audit logs, deletion jobs, transactions, support records, and future claimant evidence.
- [ ] Confirm deletion completion expectations, backup expiration, narrow retention exceptions, subscription cancellation wording, and user notification.
- [ ] Provide a functional web account-deletion request channel that does not require reinstalling the app; test it before using `/account-deletion` in a store listing.
- [ ] Reconcile Apple App Privacy and Google Play Data Safety disclosures with the approved inventory and behavior.
- [ ] Decide how legal versions are accepted, retained, and presented in the mobile app.
- [ ] Approve the responsible-disclosure process, safe-harbor wording, severity expectations, and monitored security address.
- [ ] Complete independent accessibility review, approve the conformance wording, and publish an accessibility feedback route.
- [ ] Obtain qualified counsel approval and record the approver/date for every effective legal document.

## Claim-specific publication blockers

- [ ] Approve release authority and evidence standards; do not characterize Sanduqkin as legally certifying a next-of-kin relationship.
- [ ] Approve claimant privacy notice, data minimization, retention/deletion, identity verification, sanctions/fraud controls, appeal, and human-review rules.
- [ ] Complete the separate claim protocol, threat model, schema/RLS/API design, and security test gates in `MVP_HANDOFF.md`.
- [ ] Keep `/claim` informational with no input, form, upload, authentication, or secret-bearing URL until those gates pass.

## Drafting sources checked on 2026-07-19

- UAE Government official data-protection overview and Federal Decree-Law No. 45 of 2021.
- Apple Developer account-deletion guidance.
- Google Play account-deletion requirements.
- W3C WCAG 2.2 and focus-order/focus-visible guidance.

This checklist is product-operational guidance, not legal advice.
