# Sanduqkin MVP Handoff

Last updated: 2026-08-03 (Asia/Dubai)

## Current Decision

Finish the mobile owner-vault release gate first. Sanduqkin `1.0.0` Build 7 was built and uploaded successfully from exact `main` commit `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; Apple processing/export-compliance confirmation and physical-iPhone regression remain. Public website publication, protected owner-web deployment, and production claimant implementation remain separate gated workstreams.

Repository reference: Build 7 was dispatched from `main`/`origin/main` at `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` after PR #56. The earlier claimant publication does not authorize claimant runtime or real claimant data.

## MVP Surfaces

| Surface | Intended host | Current state |
| --- | --- | --- |
| Mobile owner vault | Native app | Build 7 submitted with the biometric repair; Apple processing/export compliance and physical verification remain |
| Public website | `sanduqkin.com` | Protected static preview; legal publication blocked |
| Owner web vault | `vault.sanduqkin.com` | Implemented locally; not deployed |
| Claimant portal | `app.sanduqkin.com` | Informational pages only; all runtime disabled |
| Canonical API | `api.sanduqkin.com` | Hono API deployed in `fra1`; no claimant runtime |
| Identity/data | Supabase `eu-central-1` | Existing Free project plus local test stack |

Production hosts remain subject to final security/privacy approval. Use host-only cookies and exact origin/CORS/redirect allowlists; do not rely on path separation between owner and claimant contexts.

## Included Product

- Mobile owner authentication, recovery continuity, encrypted 17-category CRUD, deletion lifecycle, local PDF export, Emergency Readiness, and sealed emergency-code foundation.
- Shared mobile/web validation, ciphertext envelope, and Supabase owner-vault records.
- Protected owner-web authentication and encrypted CRUD implementation, pending deployment gates.
- Static product, support, security, accessibility, privacy, terms, deletion, and inactive claimant information pages.
- Completed runtime-disconnected claimant synthetic prototype, protocol contracts, vectors, end-to-end acceptance suite, threat/decision documents, and native custody feasibility probe.

## Explicitly Excluded

- Public legal publication before owner/counsel approval.
- External authenticated web users before Supabase, backup, session, origin, configuration, and smoke gates pass.
- Live claimant accounts, invitations, evidence upload, case processing, notifications, entitlement decisions, release, or claimant decryption.
- V1 emergency-code lookup, server-side vault decryption, browser-readable release PDFs, automatic release for owner non-response, payments, or financial/legal/executor positioning.

## Current Mobile Finding

Build 6 was submitted and subsequently tested on a physical iPhone. Its Settings biometric card/status was a plain `View`; only the conditional enable/disable buttons were pressable, so physical Face ID setup and the protected-key `Lock` -> `Unlock` path did not pass.

PR #53 merged a discoverable and accessible Settings action with focused coverage. Build 7 contains the repair and was uploaded successfully, but it has not yet been verified on a physical iPhone, so the release gate remains open.

Protected TestFlight workflow run `30830865138` produced Sanduqkin `1.0.0` Build 7 from `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build ID `0d8fce13-9ec8-46c9-a4de-6c9224523856`. Apple processing and the App Store Connect export-compliance answer remain required before internal assignment. The build warned that `ios.infoPlist.ITSAppUsesNonExemptEncryption` is not declared; the owner must confirm the correct legal answer.

Code review confirms the underlying enablement, authenticated key retrieval, session validation, and password fallback paths are present. Android emulator evidence passed. Build 7 now requires the controlled physical-iPhone verification.

Marriage/divorce certificate options are present in the encrypted Document Locations registry and automated tests. The corrected divorce value has not received fresh hosted persistence evidence.

## Owner Web Contract

- Mobile and web share one Supabase identity and one encrypted vault; do not create a parallel vault.
- Passwords, KEKs, MEKs, and plaintext records remain client-side and are not persisted in browser storage.
- Browser cryptography and the active MEK remain inside the Web Worker.
- Protected pages are private, `no-store`, and `noindex`; lock, sign-out, timeout, displacement, and fatal failures clear decrypted/key state.
- The Hono API remains the canonical privileged surface; durable state belongs in Postgres, not page components or process memory.

## Claimant Product Direction

Status: synthetic prototype complete; product direction approved; specialist approval and evidence pending; runtime `NO-GO`.

- Registered-recipient route first; death-only invitation pilot.
- Claimant authentication/MFA, relationship, documents, or code possession do not authorize release.
- Verified owner notice, provisional 30-day cooldown, owner cancellation, no automatic release for non-response, and two independent reviewers.
- At least two independently enrolled device-bound claimant keys; no server recovery.
- iOS-only preparation is acceptable while Android remains fail-closed. This authorizes documentation, probes, and assurance work only—not runtime integration.
- Future evidence uses private quarantine storage; future delivery remains ciphertext-only with native local decrypt/read-only presentation and optional local PDF export.
- Package served, opened, exported, claimant-confirmed, expired, and closed are separate auditable events; none should be represented as confirmed plaintext receipt without evidence.
- Provisional package availability is 72 hours and retrieval sessions 15 minutes, subject to security/operations approval.
- A safe claimant journey dashboard and append-only internal audit ledger are required.
- Architecture is nationality-neutral, but claims proceed only under an approved, signed/versioned document-specific jurisdiction policy pack.

Detailed decisions and gates live in `CLAIM_HANDOFF.md` and the 2026-07-31 claimant Slice 2 documents.

The explicit production-code backlog is recorded under `Pending Claimant Integration Code` in `CLAIM_HANDOFF.md`. None of that integration is built or authorized by the synthetic prototype merge; Production Slice 3 remains `NO-GO`.

## Next Actions

1. Complete Build 7 processing/export compliance in App Store Connect, assign it only to the intended internal testers, and complete the physical-iPhone owner-flow regression.
2. Reverify corrected divorce-certificate encrypted CRUD on the hosted test path.
3. Treat the merged synthetic claimant prototype as the closed review baseline; keep all claimant runtime disabled and require a new exact authorization before production integration.
4. Resolve `apps/web/LEGAL_CONTENT_REVIEW.md` before public publication.
5. Complete Supabase Pro, backup/restore, single-session, JWT, origin, hosted-configuration, monitoring, rollback, and synthetic smoke gates before protected-web deployment.
6. Route the immutable claimant package to named specialists; keep all claimant runtime disabled.

## Verification

### Owner-vault candidate on 2026-08-03

- Exact-main Security CI run `30828358898` passed the full protected matrix, including live Supabase/RLS, hosted integration, Android emulator, and iOS simulator jobs.
- Protected TestFlight workflow run `30830865138` passed release SBOM, EAS production build, App Store Connect upload, and transient credential cleanup.
- Candidate: Sanduqkin `1.0.0` Build 7; source `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- Submission success does not satisfy the physical-device release gate.

### Claimant prototype acceptance on 2026-08-02

- Full web suite: 141 passed; shared claimant: 110 passed; shared validation: 42 passed.
- Formal-review remediation now enforces complete audit-input idempotency and case binding, validates canonical snapshot projections and evidence-preparation metadata, binds audit event types to transitions, and keeps synthetic review routes out of public navigation and the sitemap.
- All workspace typechecks, root lint, production web build, Phase 1, security, secret, and claimant isolation guards passed.
- All claimant runtime capabilities remain disabled. Synthetic completion does not authorize claimant runtime or real claimant data.

### Baseline on 2026-08-01

- Focused mobile tests: 27 passed.
- Shared validation tests: 42 passed.
- Inactive claimant web tests: 6 passed.
- Claim vector, vector-isolation, and custody-isolation guards passed.
