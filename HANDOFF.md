# Sanduqkin Project Handoff

Last updated: 2026-07-15 (Asia/Dubai)

## Session Opener

> Sanduqkin Phase 1 is integrated on `main`. PR #25 merged the redesigned mobile flow, native CI, protected production boundaries, and the approval-gated iOS TestFlight workflow. Signed iOS version `1.0.0`, build `2`, is processed, export-compliance-cleared for the initial GCC-only distribution scope, assigned to the manually controlled `GCC Internal Testers` group, and installed and launched successfully on the owner's physical iPhone. The owner will continue real-device security and functional testing during travel over the next several days and report any issues. Do not start Phase 2 beneficiary/activation work or continue Phase 3 payments work until Phase 1 release readiness and the remaining security/operations gaps are closed.

## Source Of Truth

- Repository: `C:\Projects\GitHub\Sandoq Kin`
- GitHub repository: `shahbaz242630/Document-Vault`
- Default/release branch: `main`
- Product name: Sanduqkin
- Active scope: Phase 1 - Core Single-User Vault
- BRD: `Vault_BRD_v1.0.md` (document version 1.1)
- PR #25: merged 2026-07-15
- Merge commit: `75907c3d1103a12619f6a1b0ccacd971a280fd70`
- Release-fix commit included in PR #25: `852f2f2`
- Expected unrelated local-only files: `.playwright-mcp/` and `welcome.png`; leave them untracked unless explicitly scoped.

## Current Release State

- Apple bundle identifier: `com.sanduqkin.mobile`
- App Store Connect app: Sanduqkin
- App Store Connect Apple ID: `6790954883`
- Expo owner/project: `@shahbaz242630/sanduqkin`
- EAS project ID: `34fd69a5-169f-45bb-a0b5-9edaf515b12f`
- App version: `1.0.0`
- First successful signed archive: build `2`
- EAS build ID: `96d15169-4f5b-47a0-adcc-402a5c42b9dd`
- GitHub TestFlight run: [29376883158](https://github.com/shahbaz242630/Document-Vault/actions/runs/29376883158)
- GitHub result: `Build and submit iOS` completed successfully at 2026-07-15 01:39 UTC.
- Submission result: EAS completed the App Store Connect submission after an Expo iOS submission-queue incident.
- App Store Connect processing: complete.
- Export-compliance result: Apple accepted standard third-party encryption with France excluded from the initial distribution scope; no French approval document is required for this scope.
- Initial market scope: GCC expatriate community, starting with Bahrain, Kuwait, Oman, Qatar, Saudi Arabia, and the United Arab Emirates. France and wider expansion are deferred.
- TestFlight status: build `2` is `Ready to Test` and expires 90 days after processing.
- Internal group: `GCC Internal Testers`, with automatic distribution disabled so builds are assigned deliberately.
- Internal tester: owner account invited; TestFlight installation and launch on a physical iPhone confirmed.
- Remaining device confirmation: complete the multi-day real-device functional and security smoke and record device/iOS details and value-free results.

## Completed This Session

### Apple and App Store Connect

- Confirmed active Apple Developer membership and Team ID.
- Registered explicit App ID `com.sanduqkin.mobile`.
- Created the Sanduqkin App Store Connect application record.
- Enabled App Store Connect API access.
- Created a least-privilege Developer API key for CI submission.
- Created a new Apple Distribution certificate, valid through 2027-07-14.
- Generated `Sanduqkin App Store 2026`, an App Store provisioning profile valid through 2027-07-15.
- Kept private keys, certificate archives, provisioning profiles, API private keys, and passwords out of Git.

### Expo and TestFlight Automation

- Created and linked EAS project `@shahbaz242630/sanduqkin`.
- Moved EAS configuration to `apps/mobile/eas.json`.
- Created a dedicated Expo CI access token.
- Added `.github/workflows/ios-testflight.yml`.
- The workflow is manual-only and requires the exact `testflight` confirmation input.
- The workflow uses GitHub's approval-gated `Release` environment.
- Apple signing assets and the App Store Connect key are materialized only inside the runner and removed in an unconditional cleanup step.
- EAS uses local iOS credentials assembled from protected GitHub environment secrets.
- The first PKCS#12 export used an OpenSSL 3 format that macOS Keychain could not import. It was replaced with a legacy-compatible PKCS#12 archive and a rotated random archive password.
- The corrected signed build and App Store Connect submission succeeded.

### Integration And CI

- Merged PR #25 into `main` after required checks passed.
- Corrected the stale EAS regression-test path after `eas.json` moved into `apps/mobile`.
- Local mobile verification after the fix: 94 files passed, 2 skipped; 343 tests passed, 2 protected live tests skipped.
- PR checks passed for application security, CodeQL, OWASP ZAP, Android native compilation, iOS simulator smoke, Supabase security, Android emulator smoke, and hosted Supabase integration.
- The PR-associated iOS simulator job compiled and launched the unsigned Release app successfully.
- Updated `main` branch protection to require the current check names:
  - `App security gates`
  - `CodeQL JavaScript/TypeScript (javascript-typescript)`
  - `OWASP ZAP baseline`
  - `Android native compile`
  - `iOS simulator smoke`

### TestFlight Readiness

- Confirmed build `2` completed App Store Connect processing.
- Reviewed the implemented libsodium encryption path and answered Apple's build questionnaire as standard encryption outside Apple's operating-system-only cryptography.
- Limited the initial release scope to the GCC and excluded France; French ANSSI documentation is deferred until France is added to distribution.
- Cleared the build-level `Missing Compliance` status.
- Created `GCC Internal Testers` with automatic distribution disabled.
- Assigned build `1.0.0` (`2`) and added the owner as the sole intended internal tester.
- Confirmed the TestFlight build installs and launches on the owner's physical iPhone.
- Re-ran local verification after the TestFlight setup: 94 files passed, 2 skipped; 343 tests passed, 2 protected live tests skipped; mobile typecheck, Phase 1 DoD guard, and mobile secret scan passed.

### Release Hardening

- Added `.github/CODEOWNERS` coverage for workflows, cryptography, authentication, vault/recovery, deletion, retention, webhooks, migrations, scripts, and dependency manifests.
- Added `docs/release-checklist.md` for commit, CI, dependency, SBOM, migration, compliance, native-QA, submission, and go/no-go evidence.
- Added dependency-free CycloneDX SBOM generation through the repository's pinned npm toolchain.
- The protected TestFlight workflow now generates and uploads a production-dependency SBOM before the credential-bearing build job can start.
- SBOM artifacts are named with the release commit SHA and retained in GitHub Actions for 90 days; durable archival ownership still needs to be defined.
- Local release-hardening verification passed: typecheck, lint, workspace tests, mobile coverage, Expo Doctor, Phase 1/security/workflow/secret guards, release-tool tests, and the high-severity production dependency-audit threshold.

## Current Product And Security Guardrails

- Sanduqkin is a secure information organizer, not a financial, legal, investment, estate-planning, or executor service.
- Phase 1 is single-user only.
- Phase 1 excludes beneficiaries, activation, witnesses, document upload, production notifications, web application work, and payments.
- Normal vault storage must remain zero-knowledge. Do not store plaintext vault content, passwords, seed phrases, private keys, raw MEKs, or raw emergency codes in Sanduqkin infrastructure.
- Vault detail fields must remain inside authenticated encryption; only safe metadata may be normalized.
- Emergency access is a key-release design, not server-side plaintext export.
- Vault deletion is permanent hard deletion and the UI must state that Sanduqkin cannot restore deleted encrypted records.
- Generated readable PDF exports remain local to the device and are not uploaded or emailed by the service.

## Verified Phase 1 Coverage

- Email/password authentication and returning-user wrapped-MEK unlock.
- Recovery-phrase password reset with encrypted-record continuity.
- Biometric preference and app-lock foundations.
- Encrypted Supabase-backed vault CRUD and permanent deletion.
- Expanded Phase 1 vault categories.
- One-time emergency-code display and proof that the raw code is not retained.
- Durable audit, account-deletion, and audit-retention foundations.
- Android release emulator coverage for onboarding, returning-user unlock, encrypted CRUD, emergency-code hiding, and recovery-reset continuity.
- Hosted Supabase integration coverage after Android cleanup.
- Credential-free iOS Release compilation, simulator installation, launch, liveness check, and termination.
- Signed iOS EAS archive and App Store Connect/TestFlight submission.
- App Store Connect processing, build-level compliance clearance for the initial GCC scope, controlled internal-group assignment, and physical-iPhone installation and launch.

## Next Slice: Multi-Day Physical QA And Release Metadata

1. Complete TestFlight test information and contact details.
2. Configure App Store availability for the intended initial GCC territories; do not enable France until the French encryption declaration is approved.
3. Continue testing build `2` on the physical iPhone over the next several days.
4. Run the minimum real-device smoke:
   - cold launch and onboarding navigation;
   - sign in and wrapped-MEK unlock;
   - create/read/edit/permanently delete an encrypted record;
   - background/foreground and app-lock behavior;
   - biometric behavior on supported hardware;
   - screenshot protection and sensitive-screen behavior;
   - recovery and emergency-access screens;
   - sign out and returning-user sign in.
5. Record device model, iOS version, build number, results, and any failure evidence without capturing secrets or decrypted vault values.
6. Review the U.S. export classification rationale before adding a persistent `ITSAppUsesNonExemptEncryption` value to `apps/mobile/app.json`; do not encode the misleading claim that the app contains no encryption.
7. Triage and fix any travel-testing findings before declaring Phase 1 release-ready.

## Remaining Phase 1 Work

- Finish TestFlight metadata, GCC territory configuration, and multi-day real-device QA.
- Confirm production entitlements and physical-device behavior.
- Complete the French ANSSI declaration before any later France distribution expansion.
- Select and integrate the production transactional-email provider; Resend remains the leading candidate but is not approved or implemented.
- Migrate four legacy repository-level processor secrets into the protected `Production` environment during their next rotation, verify both processor workflows, then remove the repository copies.
- Add scheduled-workflow failure alerting/operational review.
- Add a second qualified security reviewer before enforcing required code-owner approval; the current sole owner cannot approve their own pull request.
- Define durable SBOM/dependency-license review ownership and complete the broader artifact/log retention review.
- Address the remaining compatible dependency/tooling updates without forcing an Expo-incompatible downgrade.

## Standard Verification

```powershell
npm run typecheck
npm run lint
npm test --workspaces --if-present
npm run test:coverage --workspace @vault/mobile
npm run doctor --workspace @vault/mobile
npm run check:phase1
npm run check:security
npm run check:github-actions-security
npm run check:mobile-secrets
npm audit --omit=dev --workspaces --audit-level=high
```

Release builds must additionally pass the protected `iOS TestFlight release` workflow from `main` with explicit `Release` approval.

## Historical Material

Detailed pre-refresh history is preserved in `docs/handoff/archive/`. This document intentionally contains only the current operational state, current evidence, remaining risks, and next work.
