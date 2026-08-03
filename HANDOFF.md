# Sanduqkin Project Handoff

Last updated: 2026-08-03 (Asia/Dubai)

## Current Decision

The controlled owner-vault TestFlight candidate is now Sanduqkin `1.0.0` Build 7, produced and submitted successfully from exact `main` commit `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`. Apple processing/export-compliance confirmation and the physical-iPhone regression remain open, so the mobile release gate has not passed. The claimant merge does not authorize another claimant slice or production claimant runtime, which remains `NO-GO`.

## Repository Snapshot

- Closed review branch: `codex/claimant-synthetic-journey`; PR #54 merged after final protected CI passed.
- Base/release branch at candidate dispatch: `main` and `origin/main` at `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` (PR #56).
- PR #52 merged the claimant Slice 2 review package and divorce-certificate correction; PR #53 merged the biometric Settings repair.
- Preserve unrelated local-only items such as `.codex-runtime/`.

## Verified Product State

### Mobile owner vault

- App version is `1.0.0`; Build 7 was built and uploaded to App Store Connect from `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` by protected workflow run `30830865138` on 2026-08-03. EAS build ID: `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- Build 6 did not complete the iOS release gate because its `Biometric unlock` status/card was non-interactive. PR #53 merged the discoverable, accessible enable/disable action; Build 7 contains the repair but has not yet been physically verified.
- Apple processing and the App Store Connect export-compliance answer remain required before Build 7 can be assigned for internal device testing. The workflow warned that `ios.infoPlist.ITSAppUsesNonExemptEncryption` is not declared in `app.json`; do not infer or record the legal answer without owner confirmation.
- The underlying flow is implemented: enablement authenticates before caching the MEK, lock-screen restoration uses one authenticated SecureStore read, stale remote restoration requires a live Supabase session, and password fallback remains available.
- Android emulator evidence passed. Physical Face ID enablement and `Lock` -> `Unlock` remain unverified.
- Marriage and divorce certificate values exist in the encrypted Document Locations registry and automated tests. The corrected divorce value still needs fresh hosted create/edit/reload/delete verification.

### Owner web vault and public site

- Mobile and web share the same Supabase identity, `vault_key_material`, `vault_assets`, envelope format, and 17-category validation registry.
- The protected owner web vault is implemented locally but not deployed.
- The hosted web preview is static and protected; it has no production domain or Supabase environment variables.
- Public legal content remains a draft. Do not publish until `apps/web/LEGAL_CONTENT_REVIEW.md` is resolved and owner/counsel approval is recorded.

### Claimant work

- `/claim` is informational only. Authentication, intake, evidence, review, notifications, release, and claimant decryption are disabled.
- Synthetic Slices 1-17 and the end-to-end acceptance suite are complete locally. All seven synthetic preview surfaces remain read-only, non-indexed, runtime-disconnected, and based only on deterministic fixtures.
- Product-owner direction is recorded, but legal/privacy, security, operations, native custody, and independent approvals remain incomplete.
- Shahbaz Malik is the provisionally designated operator/data controller candidate. Incorporation, legal confirmation, controller contact details, and the processor map remain incomplete, so no real claimant data may be collected.
- `CLAIM_HANDOFF.md` is authoritative for claimant scope and stop gates.
- Its `Pending Claimant Integration Code` section is the explicit fresh-session backlog. Every listed production capability remains unbuilt or incomplete and unauthorized by PR #54.

## Non-Negotiable Boundaries

- Vault encryption and decryption remain client-side. Infrastructure stores ciphertext and approved metadata only.
- Never log or transmit plaintext vault fields, passwords, recovery phrases, raw MEKs, private keys, or complete emergency secrets.
- Claimant authentication, relationship, evidence, MFA, or code possession never authorizes release by itself.
- Claimants never receive a policy path to owner vault tables or another claimant's data.
- Public, owner, claimant, and API origins require explicit isolation before deployment.
- Do not deploy the protected vault, attach production domains, change Supabase Auth globally, publish draft legal content, or enable claimant runtime without the recorded gates.

## Next Actions

1. In App Store Connect, complete the Build 7 export-compliance answer, wait for Apple processing, and assign the build only to the intended internal TestFlight group/testers.
2. Complete value-free physical-iPhone QA on Build 7: enablement, background lock, Face ID success/cancel/error, password fallback, returning-user recovery, trusted-person information navigation, Emergency Readiness, sealed-code state, and encrypted certificate CRUD.
3. Treat PR #54 merge commit `aa84031be93b460c9addada6d2fb3b09286595de` as the closed synthetic claimant review baseline.
4. Route one immutable claimant review set to named legal/privacy, security, operations, native, and independent reviewers. Capture approver, version, decision, conditions, evidence, and expiry.
5. Keep claimant Slice 3 at `NO-GO` until every blocking checklist item is approved.

## Current Release Blockers

- Build 7 Apple processing/export-compliance confirmation, physical iOS biometric regression, and corrected divorce-certificate persistence evidence.
- Supabase Pro, backup/restore drill, single-session policy, JWT lifetime, and displacement testing before external protected-web use.
- Production owner/claimant origin decision and deployment review.
- Public legal approval.
- Transactional-email provider, operational ownership, second qualified security reviewer, and durable SBOM/license ownership.
- Legal confirmation of Shahbaz Malik as operator/data controller, contracting-entity and processor mapping, jurisdiction policy packs, evidence/retention rules, reviewer staffing, native custody proof, audit integrity, and independent assurance.

## Verification

### Owner-vault candidate on 2026-08-03

- Exact-main Security CI run `30828358898` passed the application security, CodeQL, ZAP, Android native compile, live Supabase/RLS, Android emulator, hosted Supabase integration, and iOS simulator jobs.
- Protected TestFlight workflow run `30830865138` passed, including release SBOM generation, EAS iOS production build, App Store Connect upload, and transient credential removal.
- Candidate evidence: Sanduqkin `1.0.0` Build 7; source `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- This is build/submission evidence only. Apple processing/export compliance and physical-iPhone regression remain pending.

### Claimant prototype acceptance on 2026-08-02

- Full web suite: 141 passed; shared claimant: 110 passed; shared validation: 42 passed.
- Formal-review remediation now enforces complete audit-input idempotency and case binding, validates canonical snapshot projections and evidence-preparation metadata, binds audit event types to transitions, and keeps synthetic review routes out of public navigation and the sitemap.
- All workspace typechecks, root lint, production web build, Phase 1, GitHub Actions security, static security/migration, mobile secret, and claimant isolation guards passed.
- The recursive contract isolation guard covers nested claimant modules. Live database attack/restore, physical native, TestFlight, and deployment gates were not run for the runtime-disconnected synthetic slice.

### Baseline recorded on 2026-08-01

- Focused mobile security/settings/certificate/custody tests: 27 passed.
- Shared validation tests: 42 passed.
- Inactive claimant web tests: 6 passed.
- Claim vectors, claimant-vector isolation, and claimant-custody isolation guards passed.
- Code inspection confirmed the Build 6 biometric interaction defect and the merged PR #53 repair; claimant capabilities and the custody probe remain hard-disabled.

For a release candidate, also run the repository verification matrix and the protected `iOS TestFlight release` workflow from `main`; record only value-free device/build/pass-fail evidence.
