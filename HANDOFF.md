# Sanduqkin Project Handoff

Last updated: 2026-07-15 (Asia/Dubai)

## Session Opener

> Sanduqkin Phase 1 is integrated on `main`. PR #25 merged the redesigned mobile flow, native CI, protected production boundaries, and the approval-gated iOS TestFlight workflow. The first signed iOS archive succeeded as version `1.0.0`, build `2`, and the GitHub release workflow completed after submitting it to App Store Connect. The next slice is TestFlight readiness: confirm Apple processing, complete export-compliance metadata, create an internal testing group, add the owner as an internal tester, and perform a real-device smoke test. Do not start Phase 2 beneficiary/activation work or continue Phase 3 payments work until Phase 1 release readiness and the remaining security/operations gaps are closed.

## Source Of Truth

- Repository: `C:\Projects\GitHub\Sandoq Kin`
- GitHub repository: `shahbaz242630/Document-Vault`
- Default/current branch: `main`
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
- Remaining release confirmation: verify build `2` is processed and selectable in App Store Connect/TestFlight.

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

## Next Slice: TestFlight Readiness

1. Open App Store Connect and confirm Sanduqkin `1.0.0` build `2` has finished processing.
2. Resolve the export-compliance prompt. The app uses encryption; confirm the correct exemption classification before setting `ITSAppUsesNonExemptEncryption` in app configuration.
3. Complete TestFlight test information and contact details.
4. Create an internal testing group and add the owner account as an internal tester.
5. Install build `2` on a physical iPhone through TestFlight.
6. Run the minimum real-device smoke:
   - cold launch and onboarding navigation;
   - sign in and wrapped-MEK unlock;
   - create/read/edit/permanently delete an encrypted record;
   - background/foreground and app-lock behavior;
   - biometric behavior on supported hardware;
   - recovery and emergency-access screens;
   - sign out and returning-user sign in.
7. Record device model, iOS version, build number, results, and any failure evidence without capturing secrets or decrypted vault values.

## Remaining Phase 1 Work

- Finish TestFlight metadata, compliance, internal testing, and real-device QA.
- Confirm production entitlements and physical-device behavior.
- Select and integrate the production transactional-email provider; Resend remains the leading candidate but is not approved or implemented.
- Migrate four legacy repository-level processor secrets into the protected `Production` environment during their next rotation, verify both processor workflows, then remove the repository copies.
- Add scheduled-workflow failure alerting/operational review.
- Add `CODEOWNERS` and require appropriate review for security-sensitive paths.
- Add a release checklist/SBOM and review artifact/log retention.
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
