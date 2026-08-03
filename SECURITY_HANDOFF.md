# Sanduqkin Security Handoff

Last updated: 2026-08-03 (Asia/Dubai)

## Security Status

Owner-vault controls are implemented and under controlled internal testing. Sanduqkin `1.0.0` Build 7, containing the PR #53 biometric interaction repair, was built and uploaded successfully from exact `main` commit `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; Apple processing/export-compliance confirmation and the full physical Face ID path remain open. Public legal publication, external protected-web access, real claimant data, and all claimant runtime remain disabled.

Repository reference: Build 7 was dispatched from `main`/`origin/main` at `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` after PR #56. PR #54 remains the closed synthetic claimant review baseline and did not enable claimant runtime.

## Enforced Boundaries

### Zero knowledge

- Passwords, KEKs, MEKs, recovery phrases, private keys, plaintext vault fields, and complete emergency secrets never go to Sanduqkin infrastructure, logs, analytics, URLs, notifications, or support tooling.
- Encryption/decryption and readable PDF export occur only in the active client.
- Mobile and web use versioned authenticated envelopes and the same encrypted owner-vault records.

### Authentication and authorization

- Sensitive operations require server-validated identity and the appropriate fresh assurance level.
- Clients do not choose owner IDs, roles, claim states, approval results, deadlines, or release eligibility.
- Lock, sign-out, timeout, session displacement, and fatal failures must clear decrypted/key state.
- Service credentials remain inside protected processors and never reach clients.

### Browser and origin isolation

- Public, owner, claimant, and API surfaces are separate trust contexts.
- Recommended production hosts are `sanduqkin.com`, `vault.sanduqkin.com`, `app.sanduqkin.com`, and `api.sanduqkin.com`, using host-only cookies and exact origin/CORS/redirect allowlists.
- Do not expose owner or claimant routes on the public host or use a parent-domain cookie.

### Claimant boundary

- Claimant web capabilities and the native custody probe are hard-disabled in code.
- Claimants have no database or Storage path to `vault_assets`, `vault_key_material`, another claim, or another claimant's evidence.
- Future evidence is server-visible sensitive PII and requires an isolated private quarantine, strict file controls, malware scanning, bounded capabilities, retention/deletion rules, and hostile cross-tenant tests.
- Future release remains claimant-addressed ciphertext with native local decryption. Backend/browser-readable PDFs and system-known PDF passwords are out of scope.
- Non-response never causes automatic release; uncertainty moves a case to hold/manual review.

## Verified Controls

- Owner authentication, wrapped-MEK continuity, encrypted CRUD, deletion lifecycle, local PDF export, sealed emergency grant, audit processors, secret guards, CodeQL/ZAP workflows, SBOM generation, and Supabase database/RLS test harnesses exist.
- Browser crypto and active MEK state remain in a Web Worker and are not persisted in browser storage.
- Claim contracts, canonical validation, deterministic synthetic vectors, state invariants, and cross-consumer tests are runtime-disconnected.
- End-to-end claimant acceptance covers the synthetic submission-to-closure ledger, every safe public projection, all seven read-only preview surfaces, hard-disabled runtime capabilities, truthful receipt language, and collapsed private outcomes.
- Claimant contract isolation recursively scans nested production modules; its regression test prevents a return to top-level-only coverage.
- The offline-code V2 KDF profile is synthetic-only and not production-approved.
- Biometric enablement authenticates before storing the MEK; lock-screen restoration uses the authenticated SecureStore read as the single native prompt; password fallback remains available.

## Open Security Gates

### Mobile release

- Complete Build 7 Apple processing and export-compliance confirmation, then assign it only to the intended internal TestFlight group/testers.
- On Build 7, physically verify Face ID enablement, `Lock` -> `Unlock`, background lock, cancel/error handling, expired-session fallback, and returning-user recovery.
- Reverify corrected divorce-certificate encrypted persistence and cleanup.
- Resolve the workflow warning that `ios.infoPlist.ITSAppUsesNonExemptEncryption` is absent by recording the owner-confirmed App Store Connect answer; do not infer the legal classification.

### Protected web

- Upgrade Supabase to Pro; approve backup retention and complete restore testing.
- Enable and test managed single-session behavior, JWT lifetime, displacement, and decrypted-state cleanup.
- Approve the owner/claimant origin architecture, hosted configuration, CSP/CORS/cookies, monitoring, rollback, and synthetic authenticated smoke.

### Claimant Slice 3

Current result: `NO-GO`.

Product-owner direction is approved: registered recipient first; death-only invitation pilot; verified notice with provisional 30-day cooldown; no automatic release for non-response; two independent reviewers; at least two device-bound claimant keys with no server recovery; provisional 72-hour package availability and 15-minute retrieval sessions; safe journey dashboard; append-only audit ledger; native local decrypt/export; and signed/versioned jurisdiction policy packs.

Still required:

- Legal confirmation of the provisional Shahbaz Malik operator/data controller designation, contracting-entity/controller details, and processor map.
- Legal/privacy authority, jurisdiction, evidence, retention, rights, dispute, and cross-border policies.
- Physical iOS custody proof and independent native/cryptographic review.
- Security/operations approval of authentication, origin, notifications, storage, audit integrity, backup/restore, kill switches, and incident response.
- Named, trained, separated reviewers and operational evidence.
- Android remains fail-closed until transaction-bound key agreement and the required device/attestation baseline are independently approved. Owner approval permits iOS-only preparation; it does not authorize runtime implementation.
- Offline-code V2 remains disabled pending protocol review and representative KDF benchmarks.

`CLAIM_HANDOFF.md` now records the full pending production integration-code backlog. PR #54 supplies synthetic contracts, projections, fixtures, previews, and tests only; it supplies no production claimant authentication, persistence, RLS/Storage policy, evidence pipeline, case processor, reviewer operations, notification delivery, native custody, or release runtime.

## Verification

### Owner-vault candidate on 2026-08-03

- Exact-main Security CI run `30828358898` passed the application security, CodeQL, ZAP, Android native compile, live Supabase/RLS, Android emulator, hosted Supabase integration, and iOS simulator jobs.
- Protected TestFlight workflow run `30830865138` passed release SBOM generation, EAS production build, App Store Connect upload, and transient credential cleanup.
- Candidate: Sanduqkin `1.0.0` Build 7; source `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- Apple processing/export compliance and physical-device verification remain open; claimant runtime remains `NO-GO`.

### Claimant prototype acceptance on 2026-08-02

- Full web suite: 141 passed; shared claimant: 110 passed; shared validation: 42 passed.
- Formal-review remediation now rejects partial-match replays, cross-case audit appends, altered snapshot projections, evidence-preparation metadata mismatches, and event/transition mismatches while keeping synthetic review routes out of public discovery surfaces.
- All workspace typechecks, root lint, production web build, Phase 1, GitHub Actions security, static security/migration, mobile secret, and claimant isolation guards passed.
- Claimant capabilities remain hard-disabled, the custody probe remains hard-disabled, and no runtime, database, native custody, TestFlight, or deployment action was added or performed.
- Live Supabase attack/restore and physical-device gates remain required at their production release gates; passing synthetic acceptance is not specialist approval.

### Focused baseline on 2026-08-01

- Mobile biometric/settings/certificate/custody tests: 27 passed.
- Shared validation: 42 passed.
- Inactive claimant web: 6 passed.
- Claim-vector reproducibility, vector isolation, and custody isolation guards passed.
- Code inspection confirmed the Build 6 biometric interaction defect and the merged PR #53 repair; claimant portal capabilities are all `false`, and `CLAIMANT_CUSTODY_PROBE_ENABLED` is `false`.

Before any release candidate, run the full application, security, database/RLS, native, dependency, SBOM, and protected TestFlight gates defined in `HANDOFF.md` and the repository scripts.
