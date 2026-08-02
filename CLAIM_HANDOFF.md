# Sanduqkin Claimant And Release Handoff

Last updated: 2026-08-01 (Asia/Dubai)

## Status And Stop Gate

Current result: `NO-GO` for claimant Slice 3.

The public `/claim` routes are informational. Claimant authentication, invitations, key registration, persistence, migrations, RLS/Storage policies, evidence upload, notifications, processors, case transitions, release packages, retrieval, and claimant decryption are disabled.

Product-owner direction is approved. Legal/privacy, security, operations, native custody, staffing, and independent-review gates remain incomplete. No operating company/controller is named, so no real claimant data may be collected.

Repository reference: PR #52 merged the Slice 2 package into `main`/`origin/main` at `37b05d0`. Draft PR #53 contains the isolated biometric Settings repair; claimant runtime remains unchanged.

## Non-Negotiable Boundaries

- Authentication, MFA, code possession, relationship, identity proofing, evidence review, release authority, and cryptographic possession are separate controls.
- No individual control—and no owner non-response—authorizes release.
- Never submit, log, email, place in a URL, or store a complete emergency secret.
- Claimants never receive a policy path to owner vault rows, key material, another claim, or another claimant's evidence.
- Infrastructure serves ciphertext plus exactly one claimant-addressed release-material profile. Decryption and optional readable PDF export occur only in the native claimant client.
- Browser-readable release PDFs, server-side decryption, system-known PDF passwords, and server-recoverable claimant private keys are prohibited.
- Claim-sensitive actions require fresh authenticated sessions and enforced `aal2` in UI, API, and database policy.
- Case state, authority, approvals, deadlines, and release eligibility are server/database controlled; client values are untrusted.
- Evidence, if approved, is sensitive server-visible PII outside the owner-vault zero-knowledge claim and must use an isolated private quarantine.
- Development uses dedicated identities and synthetic records/documents only.

## Approved Product Direction

These are product-owner decisions, not specialist authorization:

- Registered-recipient route before V2 offline-code initiation.
- Invitation-only death-claim pilot; other claim types remain deferred.
- Verified value-free owner notice, provisional 30-day cooldown, owner cancellation, and no automatic release for non-response.
- Two distinct trained human reviewers; no self-review, duplicate approval, or conflicted reviewer.
- At least two independently enrolled, device-bound claimant keys before pilot; no server recovery.
- iOS-only preparation while Android remains fail-closed. Preparation means documentation, physical probes, benchmarks, tests, and assurance review—not runtime integration.
- Private evidence quarantine and value-free notifications.
- Claimant-addressed ciphertext delivery with native local read-only decryption and optional local PDF export.
- Provisional 72-hour package availability and 15-minute retrieval sessions, subject to security/operations approval.
- Safe claimant journey dashboard using public states that exclude reviewer identity, owner-response detail, fraud signals, exact timers, and internal notes.
- Append-only server-authored case ledger with integrity evidence and value-free metadata.
- Nationality-neutral architecture using signed/versioned document-specific jurisdiction policy packs. A claim without an approved applicable pack remains on hold.

## Route Boundaries

### Registered recipient

The intended route is: value-free single-use invitation; verified normalized-address binding; mandatory MFA; hardware-backed claimant public-key registration; owner-local sealed-grant finalization; revocation/replacement; and later independent claim review.

Runtime remains blocked until physical iOS custody evidence, multi-device protocol, key replacement/loss journeys, origin/auth design, security review, and independent cryptographic/native approval pass.

### V2 offline handover code

V1 has no safe public locator and must never be used for claim lookup. V2 remains disabled until it has a split public locator/client-only secret, domain-separated proof, enumeration resistance, throttling/attempt controls, revocation/expiry, explicit V1 compatibility policy, and approved representative-device KDF benchmarks. The current V2 fixture KDF profile is synthetic-only and `production_approved: false`.

## Evidence And Release Rules

- Evidence storage requires randomized case-bound paths, short-lived capabilities, allowlisted formats, signature/type verification, strict size/page/count/decompression limits, malware scanning, and claimant/case-bound authorization.
- Define reviewer access, workstation controls, retention, deletion, legal hold, breach response, database backup, Storage backup, and restore behavior before implementation.
- Notifications contain no evidence, owner identity, secret, countdown detail, or release material.
- Release requires a current owner grant, approved authority policy, completed review, elapsed cooldown, no cancellation/hold, two independent approvals, fresh `aal2`, and an unexpired bounded retrieval session.
- Package prepared, served, opened, exported, claimant-confirmed, expired, suspended, and case-closed are distinct events. Do not use one ambiguous `released` event as proof that plaintext was received.
- Suspension may block future retrieval but cannot recall information already decrypted by the claimant.

## Implementation Order

1. **Slice 1 — complete:** inactive informational routes and hard-disabled capability model.
2. **Slice 2 — current:** immutable decision/threat/approval package, named specialist review, physical custody evidence, benchmark plans, and assurance closure.
3. **Slice 3 — blocked:** registered-recipient setup only; no claim submission, evidence, review, or release.
4. **Slice 4 — blocked:** V2 initiation and synthetic evidence quarantine; no release.
5. **Slice 5 — blocked:** controlled review/cooldown/hold/approval state machine; release disabled.
6. **Slice 6 — blocked:** encrypted packages, bounded retrieval, native local decryption, read-only viewer, expiry, suspension, restore drill, penetration review, and invitation-only pilot approval.

Every slice requires explicit scope/non-goals, kill switches, transactional/idempotent processing, hostile authorization/race/replay tests, rollback, value-free evidence, and recorded approval before proceeding.

## Current Slice 2 Blockers

- Operator/controller identity, processor map, governing law, supported policy packs, and counsel opinion on release authority.
- Evidence sufficiency/authenticity/translation rules, data minimization, consent/legal basis, retention/deletion, rights, legal hold, breach, and cross-border policy.
- Named reviewer roles, qualifications, conflict checks, staffing, access controls, escalation, appeal, and incident procedures.
- Physical iOS Secure Enclave proof, two-device enrollment design, loss/replacement/revocation journeys, and independent native/cryptographic review.
- Final claimant authentication/recovery/session design and owner/claimant origin isolation.
- Evidence Storage provider/design, malware controls, backup/restore drill, stale-state reconciliation, and deletion limits.
- Notification provider, value-free templates, delivery/retry/abuse handling, monitoring, and kill switches.
- Audit event catalogue, public-state vocabulary, integrity/tamper evidence, access/retention/export policy, and hostile omission/mutation tests.
- Independent assurance and recorded acceptance of residual risks.

Android is not a blocker to owner-approved iOS-only preparation, but it remains ineligible for runtime enrollment until transaction-bound P-256 key agreement, accepted hardware security/attestation, per-use authentication, downgrade handling, representative devices, and independent Android review pass.

## Authoritative Review Set

- `docs/superpowers/specs/2026-07-31-claimant-slice-2-decision-register.md`
- `docs/superpowers/specs/2026-07-31-claimant-threat-control-matrix.md`
- `docs/superpowers/specs/2026-07-31-claimant-slice-2-approval-checklist.md`
- `docs/superpowers/specs/2026-07-31-claimant-slice-2-specialist-review-pack.md`
- `docs/superpowers/specs/2026-07-31-claimant-document-checklist-catalog.md`
- `docs/superpowers/specs/2026-07-31-claimant-mvp-manual-review-retrieval-flow.md`
- `docs/superpowers/specs/2026-07-28-claimant-key-custody-client-boundary.md`
- `docs/superpowers/specs/2026-07-28-claimant-custody-probe-evidence.md`

Circulate one immutable version. Every approval record must identify the document version/hash, approver and role, decision, conditions, supporting evidence, date, and expiry/re-review trigger. Chat acknowledgement or passing tests do not substitute for specialist approval.

## Next Authorized Work

1. Merge or otherwise freeze the Slice 2 review package so every specialist reviews the same version.
2. Name the operator/controller or keep all claimant data collection blocked.
3. Obtain physical iOS custody evidence and complete the multi-device/loss/replacement design.
4. Route the immutable package to named legal/privacy, security, operations, native, and independent reviewers.
5. Resolve every blocking checklist item and record conditions/evidence/expiry.
6. Stop for an explicit `GO` decision before any Slice 3 runtime change.

## Verification On 2026-08-01

- Inactive claimant web tests: 6 passed.
- Mobile custody/settings/certificate/security-focused suite: 27 passed.
- Shared validation: 42 passed.
- Claim vectors, vector isolation, and custody isolation guards passed.
- Code inspection confirmed all web claimant capability flags are `false` and `CLAIMANT_CUSTODY_PROBE_ENABLED` is `false`.
