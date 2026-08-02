# Sanduqkin Claimant And Release Handoff

Last updated: 2026-08-02 (Asia/Dubai)

## Next Session Opener

1. Read `HANDOFF.md`, `CLAIM_HANDOFF.md`, `SECURITY_HANDOFF.md`, and `MVP_HANDOFF.md` completely before making changes.
2. Check PR #53, `main`/`origin/main`, and the current branch status. PR #52 is already merged. If starting from `main`, merge PR #53 first because the claimant prototype branch is stacked on its biometric-control work.
3. Preserve `.codex-runtime/` and `.playwright-cli/`; do not stage, delete, or modify them.
4. Do not push or publish `codex/claimant-synthetic-journey` until its base is merged and the product owner explicitly authorizes publication.
5. Resume with **Synthetic Slice 13: owner-protection/review tracking model**. Keep the implementation modular, run the focused and proportional regression checks, report the result, and wait for approval before starting the next slice.
6. Do not create a TestFlight build or perform any deployment.

## Synthetic Claimant Prototype Checkpoint

The current local branch is `codex/claimant-synthetic-journey`. Synthetic Slices 1-12 are implemented as small, modular, tested increments. Slice 12 is commit `cad7ccd` (`Add safe synthetic claimant acknowledgement`), followed by the current handoff refresh. The branch has not been pushed.

Completed synthetic capabilities cover journey projection, audit modelling, scenario execution, dashboard projection, checklist modelling and preview, evidence preparation and preview, review submission, submission preview, and idempotent synthetic submission handoff. They remain disconnected from production runtime and real claimant data.

Five bounded synthetic slices remain, in this order:

1. **Slice 13 — Owner-protection/review tracking model:** define the safe public projection for review progress and owner-protection controls, with no reviewer identity, owner-response detail, fraud signals, or release authority.
2. **Slice 14 — Review tracking UI:** render the synthetic public review projection with fail-closed states and accessible status guidance.
3. **Slice 15 — Decision/retrieval-readiness model:** model safe claimant-facing decision and retrieval-readiness states without performing release, serving ciphertext, or authorizing decryption.
4. **Slice 16 — Decision/retrieval UI:** render those synthetic states and blocked/expired/suspended outcomes without any live retrieval capability.
5. **Slice 17 — End-to-end claimant acceptance suite and handoff refresh:** exercise the complete synthetic journey, run proportional regressions and repository guards, then refresh the handoffs for the next authorization decision.

These five slices finish the synthetic claimant prototype phase only. They do not authorize real authentication, persistence, database work, migrations, RLS, uploads, notifications, review operations, submission runtime, cryptographic retrieval or release, real claimant data, TestFlight, or deployment. Those capabilities remain separately gated.

## Status And Stop Gate

Current result: `GO` only for the five bounded synthetic prototype slices above; `NO-GO` for production claimant runtime.

The public `/claim` routes are informational. Claimant authentication, invitations, key registration, persistence, migrations, RLS/Storage policies, evidence upload, notifications, processors, case transitions, release packages, retrieval, and claimant decryption are disabled.

Product-owner direction is approved, and Shahbaz Malik is the provisionally designated operator/data controller candidate. Legal confirmation, incorporation/contracting-entity details, controller contact details, the processor map, and the remaining legal/privacy, security, operations, native custody, staffing, and independent-review gates are incomplete. No real claimant data may be collected.

Repository reference: PR #52 merged the Slice 2 package into `main`/`origin/main` at `37b05d0`. PR #53 contains the biometric Settings control base. The unpushed `codex/claimant-synthetic-journey` branch is stacked on that base; claimant production runtime remains unchanged.

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

## Production Implementation Order (Still Gated)

1. **Slice 1 — complete:** inactive informational routes and hard-disabled capability model.
2. **Slice 2 — current:** immutable decision/threat/approval package, named specialist review, physical custody evidence, benchmark plans, and assurance closure.
3. **Slice 3 — blocked:** registered-recipient setup only; no claim submission, evidence, review, or release.
4. **Slice 4 — blocked:** V2 initiation and synthetic evidence quarantine; no release.
5. **Slice 5 — blocked:** controlled review/cooldown/hold/approval state machine; release disabled.
6. **Slice 6 — blocked:** encrypted packages, bounded retrieval, native local decryption, read-only viewer, expiry, suspension, restore drill, penetration review, and invitation-only pilot approval.

Every slice requires explicit scope/non-goals, kill switches, transactional/idempotent processing, hostile authorization/race/replay tests, rollback, value-free evidence, and recorded approval before proceeding.

## Current Slice 2 Blockers

- Legal confirmation of Shahbaz Malik as operator/data controller, incorporation/contracting-entity details, controller contact details, processor map, governing law, supported policy packs, and counsel opinion on release authority.
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

Circulate one immutable, accessible version only after recording its Git SHA. The current claimant branch changes parts of the PR #52 review set and is still local-only, so neither PR #52 nor the working tree should be described as the final circulated version. Every approval record must identify the document version/hash, approver and role, decision, conditions, supporting evidence, date, and expiry/re-review trigger. Chat acknowledgement or passing tests do not substitute for specialist approval.

## Production Authorization Work (Separate From Synthetic Slices)

1. Merge or otherwise freeze the Slice 2 review package so every specialist reviews the same version.
2. Legally confirm the provisional Shahbaz Malik operator/data controller designation, complete the contracting-entity/controller record and processor map, and keep all claimant data collection blocked until approval.
3. Obtain physical iOS custody evidence and complete the multi-device/loss/replacement design.
4. Route the immutable package to named legal/privacy, security, operations, native, and independent reviewers.
5. Resolve every blocking checklist item and record conditions/evidence/expiry.
6. Stop for an explicit `GO` decision before any Slice 3 runtime change.

## Verification

### Slice 12 on 2026-08-02

- Safe acknowledgement UI focused suite: 13 passed.
- Web typecheck and lint passed.
- Claim vectors, vector isolation, and custody isolation guards passed.
- The public acknowledgement projection is explicitly allowlisted and excludes protocol references, case versions, internal reason codes, reviewer identity, owner-response detail, fraud signals, runtime controls, and network or persistence integration.

### Baseline on 2026-08-01

- Inactive claimant web tests: 6 passed.
- Mobile custody/settings/certificate/security-focused suite: 27 passed.
- Shared validation: 42 passed.
- Claim vectors, vector isolation, and custody isolation guards passed.
- Code inspection confirmed all web claimant capability flags are `false` and `CLAIMANT_CUSTODY_PROBE_ENABLED` is `false`.
