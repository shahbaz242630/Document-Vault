# Claimant Slice 2 Approval Checklist

Last updated: 2026-08-02 (Asia/Dubai)

Status: Unapproved checklist. Completion authorizes only the specifically named next slice; it never authorizes claim submission or release by implication.

## Approval Record Template

Every approval must record:

- decision/checklist ID;
- document version or commit SHA;
- approver name and accountable role;
- decision: approve, approve with conditions, reject, or defer;
- date and review/expiry date;
- linked value-free evidence;
- conditions, residual risks and required follow-up; and
- confirmation that the approver is independent where independence is required.

A chat acknowledgement, unchecked task, passing unit test or owner enthusiasm does not substitute for a named specialist approval.

## A. Owner And Product Scope

- [x] O01 Owner approved registered-recipient preparation before V2 offline-code initiation on 2026-07-31; security evidence remains pending.
- [x] O02 Owner approved a death-only first invitation-only claimant pilot on 2026-07-31; legal/privacy approval remains pending.
- [x] O03 Owner approved that authentication, MFA, relationship, evidence and route possession never independently authorize release on 2026-07-31.
- [x] O04 Owner approved no automatic release for owner non-response, failed delivery or timer expiry on 2026-07-31; legal/security approval remains pending.
- [x] O05 Owner approved provisional verified-delivery plus 30-day cooldown policy on 2026-07-31; legal/operations sign-off remains pending.
- [x] O06 Owner approved at least two independently enrolled claimant device keys before pilot, with no server key recovery, on 2026-07-31; protocol/security review remains pending.
- [x] O07 Owner approved iOS-only Slice 3 preparation while Android remains fail-closed on 2026-07-31; security/native gates remain pending.
- [x] O08 Owner approved provisional 72-hour package availability and 15-minute retrieval sessions on 2026-07-31; security/operations review remains pending.
- [x] O09 Owner approved the two-independent-reviewer operating model on 2026-07-31; named staffing, qualifications and funding evidence remain required.
- [x] O10 Owner confirmed claimant runtime and release remain disabled after this approval package on 2026-07-31.
- [x] O11 Owner requested and approved a claimant-visible journey dashboard direction on 2026-07-31; public-state copy and specialist review remain pending.
- [x] O12 Owner requested and approved an append-only internal case audit/journey ledger direction on 2026-07-31; legal/privacy/security/operations design remains pending.
- [x] O13 Owner superseded the one-jurisdiction assumption on 2026-07-31 and approved a nationality-neutral, global-capable architecture using document-specific jurisdiction policy packs; every activated pack still requires legal/privacy approval.
- [x] O14 Owner confirmed no operating company exists yet on 2026-07-31; incorporation/operator identity remains a pre-data blocker.
- [x] O15 Owner provisionally designated Shahbaz Malik as the operator/data controller candidate on 2026-08-01; this does not complete legal confirmation, incorporation/contracting-entity, contact-detail, processor-map, or pre-data gates.
- [x] O16 Owner approved native local decryption and optional on-device PDF export on 2026-07-31; backend/browser-readable PDFs and system-known PDF passwords are out of scope.

## B. Legal And Privacy

- [ ] L01 Legally confirm Shahbaz Malik as operator/data controller, name the contracting entity, record controller contact details, and name each processor/subprocessor.
- [ ] L02 Approve the conflict-of-laws intake and each jurisdiction policy pack before it can authorize progression; define unsupported, conflicting and excluded combinations.
- [ ] L03 Provide written advice defining lawful release authority after owner death and required owner instruction/grant.
- [ ] L04 Approve the death, identity and claimant authority/relationship evidence catalogue and sufficiency rules.
- [ ] L05 Approve claimant privacy notice, evidence-processing notice, policy acceptance and lawful-basis analysis.
- [ ] L06 Approve cross-border data-flow and transfer safeguards for Supabase, Vercel, evidence scanning, email, support and review.
- [ ] L07 Approve event-based retention/deletion for invitations, profiles, drafts, evidence, decisions, events, packages, sessions and security logs.
- [ ] L08 Approve legal-hold authority, scope, review, expiry and deletion-resumption procedure.
- [ ] L09 Approve owner notice, cancellation, cooldown, dispute, appeal, rejection and claimant communication policy.
- [ ] L10 Approve rights-request, breach-notification, law-enforcement and deceased-person data procedures.
- [ ] L11 Confirm TestFlight territory does not represent a claimant launch-jurisdiction approval.
- [ ] L12 Confirm evidence is server-visible sensitive PII outside the normal zero-knowledge vault boundary and approve the resulting notices and controls.
- [ ] L13 Approve the audit ledger's purposes, lawful basis, notices, access/disclosure rules, retention, legal hold, rights-request treatment and litigation/export procedure; confirm that the system makes no unsupported promise of legal admissibility.
- [ ] L14 Approve the common evidence core and each policy-pack overlay, including authenticity, certified-copy, translation, attestation, probate/authority and document-expiry rules.

## C. Security And Cryptography

- [ ] S01 Independently review `registered_recipient_v2` P-256 ECDH, HKDF labels, canonical encoding, possession proof, AEAD envelope and bindings.
- [ ] S02 Approve hardware-backed, non-exportable keys with user presence for every private-key operation and no software fallback.
- [ ] S03 Approve the hybrid web/native boundary and strict owner/claimant mode separation.
- [ ] S04 Approve multi-device registration/grant semantics and total-device-loss behaviour.
- [ ] S05 Approve key replacement, revocation, owner re-finalization and active-claim invalidation rules.
- [ ] S06 Approve the production origin/cookie/CSP/CORS/CSRF/deep-link boundary.
- [ ] S07 Approve claimant authentication, MFA, recovery, fresh-`aal2`, JWT/session and displacement controls.
- [ ] S08 Approve private workflow schema principles, least privilege, service-role boundary and hostile RLS/API/Storage test plan.
- [ ] S09 Approve separate, default-off kill switches for every claimant capability and the authorization to change them.
- [ ] S10 Review every Critical threat in the threat/control matrix; document control owner, evidence and residual-risk decision.
- [ ] S11 Approve signing/service-key custody, rotation and incident response before package creation is ever enabled.
- [ ] S12 Name the independent cryptographic/native assessor and approve review scope.
- [ ] S13 Approve the audit event schema, server-authoritative timestamps, actor attribution, append-only enforcement, tamper evidence, integrity verification, redaction, monitoring and immutable export design.
- [ ] S14 Approve signing, versioning, activation, expiry, rollback and tamper detection for jurisdiction policy packs and document-checklist rules.

## D. Native Custody Evidence

- [ ] N01 Physical iPhone proves Secure Enclave P-256 key agreement, passcode-required device-only protection and per-use user presence.
- [ ] N02 Physical iPhone proves public-key-only export, key deletion, passcode removal/biometric change handling and backup non-migration.
- [ ] N03 Decide the Android compile/minimum device baseline required for transaction-bound `KeyAgreement`.
- [ ] N04 Representative Android devices prove accepted TEE/StrongBox level, per-use authentication, public-key-only export, invalidation and no fallback.
- [ ] N05 Approve Android attestation, root/revocation checking, privacy-minimized device metadata and platform-downgrade handling.
- [ ] N06 Confirm emulators, unknown security levels and unsupported providers are ineligible.
- [ ] N07 Remove all probe-only aliases and record value-free device model, OS, app build, security-level class and pass/fail evidence.
- [ ] N08 Resolve every material independent-review finding before production key registration.

## E. Reviewer And Case Operations

- [ ] R01 Name two qualified reviewer roles and the accountable operations owner.
- [ ] R02 Approve training, evidence handbook, conflict-of-interest and recusal requirements.
- [ ] R03 Prove one identity cannot submit both approvals or review its own/conflicted case.
- [ ] R04 Approve independent-decision sequencing and what each reviewer can see.
- [ ] R05 Approve hold, escalation, dispute, appeal, suspected fraud, coercion and vulnerable-person procedures.
- [ ] R06 Approve service levels and capacity thresholds without creating pressure to bypass controls.
- [ ] R07 Approve break-glass access, dual control, immutable audit and periodic access review.
- [ ] R08 Approve value-free claimant, owner, reviewer and support communications.
- [ ] R09 Complete synthetic tabletop exercises for routine approval, cancellation, dispute, fraud, outage and incident suspension.
- [ ] R10 Confirm support cannot recover claimant keys, override evidence, approve release or view vault plaintext.
- [ ] R11 Approve which claimant journey stages are public and which reviewer, fraud, owner-notice and security details remain internal.
- [ ] R12 Require every evidence access, reviewer view/decision, recusal, hold, escalation, appeal, override attempt and export to create an attributable audit event.
- [ ] R13 Approve operations for unsupported/conflicting jurisdiction facts, unavailable documents, foreign-language evidence, certified translation/attestation and counsel escalation.
- [ ] R14 Approve the manual-release runbook: two independent decisions, owner protection, value-free claimant notification, retrieval support, claimant confirmation, closure and controlled reopening.

## F. Evidence, Data And Resilience

- [ ] E01 Approve a separate private evidence bucket, randomized paths and case-bound short-lived upload capabilities.
- [ ] E02 Approve allowlisted types plus signature, MIME, size, page/count and decompression checks.
- [ ] E03 Approve malware-scanning provider, quarantine states, scanner outage behaviour and reviewer workstation controls.
- [ ] E04 Prove claimant/case binding in application authorization and Storage RLS with hostile cross-account tests.
- [ ] E05 Prove filenames, evidence, owner identity and claimant PII do not enter ordinary logs, notifications, analytics or audit metadata.
- [ ] E06 Approve separate database and Storage backup coverage, RPO/RTO, restore access and deletion limitations.
- [ ] E07 Complete a restore drill that detects cancelled claims, revoked keys, stale approvals and stale package eligibility.
- [ ] E08 Prove event-based deletion and legal-hold behaviour using synthetic records and documents.
- [ ] E09 Approve outage, provider failure, retry, dead-letter, reconciliation and no-auto-release behaviour.
- [ ] E10 Approve incident classification, containment, evidence preservation, notification and recovery ownership.
- [ ] E11 Prove the audit ledger excludes vault plaintext, secrets, evidence bodies, unsafe filenames and unnecessary PII while retaining sufficient case traceability.
- [ ] E12 Prove state, event, notification/outbox and claimant-dashboard projections reconcile; alert and fail safely on gaps or divergence.
- [ ] E13 Test a redacted, integrity-verifiable case-history export using synthetic data, including access authorization and chain-of-custody recording.
- [ ] E14 Approve the private evidence-review workspace and prove it has no public/shared-drive links, unmanaged sync, emailed attachments or unlogged reviewer access.

## G. Pre-Slice-3 Engineering Gate

- [ ] G01 All D01-D32 decisions have an accountable status; every Slice 3 blocker is approved.
- [ ] G02 No unresolved Critical Slice 3 threat remains.
- [ ] G03 Owner, legal/privacy, security and operations approvals reference the same immutable document versions.
- [ ] G04 Claimant vector, vector-isolation and custody-isolation guards pass without fixture drift.
- [ ] G05 Standard repository typecheck, lint, unit, coverage, secret, security, native and Supabase gates pass.
- [ ] G06 Hosted/public claimant capabilities remain hard-disabled with no environment override.
- [ ] G07 No claimant migration, table, RLS/Storage policy, account, invitation, API route, notification, evidence or processor exists before the authorized Slice 3 change set.
- [ ] G08 Slice 3 has its own objective, non-goals, abuse tests, rollback, kill switch and owner stop gate.
- [ ] G09 Slice 3 remains preparation only: no claim submission, evidence intake, review progression, package creation, release or decryption.
- [ ] G10 The owner issues a written go/no-go decision for that exact Slice 3 scope.
- [ ] G11 The shared event catalogue and append-only audit baseline are approved before the first claimant state mutation is implemented.
- [ ] G12 The claimant journey dashboard is read-only, server-authorized and derived from reconciled public-state projections rather than client-authored status.
- [ ] G13 The end-to-end manual-review/retrieval flow proves two-reviewer separation, value-free notification, ciphertext-only backend delivery, native local open/export and truthful receipt-event semantics.

## Current Result

`NO-GO` for Slice 3.

The owner has approved the complete product direction, including the journey dashboard, audit ledger and nationality-neutral policy-pack/document-checklist model, and provisionally designated Shahbaz Malik as the operator/data controller candidate. No operating company exists yet. Legal confirmation of the designation, contracting-entity/controller details, processor mapping, legal authority and jurisdiction policy packs, evidence rules, retention/logging schedule, reviewer staffing, multi-device design, physical custody proof, Android transaction binding, authentication/origin design, backup/restore, audit integrity and independent-assurance approvals remain incomplete.
