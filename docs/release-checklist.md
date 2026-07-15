# Sanduqkin Release Checklist

Use one copy of this checklist for each TestFlight or production release. Link
to value-free evidence; never paste credentials, decrypted vault content,
recovery phrases, raw emergency codes, signing material, or protected logs.

## Release identity

- [ ] App version and build number:
- [ ] Release commit SHA:
- [ ] Pull request:
- [ ] EAS build ID:
- [ ] App Store Connect build:
- [ ] Protected GitHub release run:
- [ ] Release owner and UTC approval time:

## Scope and compliance

- [ ] Product scope matches the approved BRD phase; deferred features remain disabled.
- [ ] Intended App Store territories are recorded.
- [ ] France remains unavailable unless the French encryption declaration is approved.
- [ ] Apple encryption answers match the shipped cryptography and distribution scope.
- [ ] Any persistent `ITSAppUsesNonExemptEncryption` value has a documented U.S. export-classification rationale.
- [ ] TestFlight test information, contact details, privacy information, and review notes are current.

## Source and required checks

- [ ] Release commit is on protected `main` and the working tree used for release was clean.
- [ ] `App security gates` passed:
- [ ] `CodeQL JavaScript/TypeScript (javascript-typescript)` passed:
- [ ] `OWASP ZAP baseline` passed:
- [ ] `Android native compile` passed:
- [ ] `iOS simulator smoke` passed:
- [ ] Hosted Supabase and protected Android smoke evidence was reviewed when applicable:
- [ ] No unresolved high- or critical-severity production dependency finding exists.

## Dependency and artifact evidence

- [ ] `npm audit --omit=dev --workspaces --audit-level=high` passed.
- [ ] The release SBOM artifact is attached to the protected release run.
- [ ] SBOM artifact name includes the release commit SHA and uses the approved retention period.
- [ ] The resolved SBOM was reviewed with the documented Expo peer-range compatibility condition in mind.
- [ ] Dependency and license review owner recorded the review outcome:
- [ ] Build, failure-evidence, coverage, and security artifact retention remains minimized and appropriate.

## Migrations and operations

- [ ] Required Supabase migrations are identified and applied before release use.
- [ ] Production and Release secrets are environment-scoped; no secret value appears in evidence.
- [ ] Account-deletion and audit-retention processors have a recent successful run or explicit acceptance.
- [ ] Scheduled-workflow failure monitoring or the documented operational review was completed.
- [ ] Rollback, credential-revocation, and incident contacts are available to the release owner.

## Native device QA

- [ ] Device model, OS version, app version, and build number are recorded.
- [ ] Cold launch, onboarding, sign-in, wrapped-MEK unlock, and returning-user sign-in passed.
- [ ] Encrypted create/read/edit/permanent-delete behavior passed using disposable non-sensitive data.
- [ ] Background/foreground locking and biometric behavior passed on supported hardware.
- [ ] Keychain/SecureStore continuity, recovery, and emergency-access screens passed.
- [ ] Screenshot protection and sensitive-screen behavior were reviewed.
- [ ] Sign-out and subsequent unlock passed.
- [ ] Failures have value-free reproduction steps and are fixed, deferred with approval, or release-blocking.

## Submission and post-submission

- [ ] The manual workflow confirmation is exactly `testflight`.
- [ ] The protected `Release` environment approval is recorded.
- [ ] EAS archive and App Store Connect submission succeeded.
- [ ] App Store Connect processing completed and export compliance is cleared for the intended scope.
- [ ] The build is assigned only to the intended TestFlight group and testers.
- [ ] Post-release monitoring owner and review time are recorded.
- [ ] `HANDOFF.md` and `SECURITY_HANDOFF.md` reflect the final release state and residual risks.

## Release decision

- [ ] **GO** — all required evidence is complete and no release blocker remains.
- [ ] **NO-GO** — blocker, owner, and next review time are recorded below.

Decision notes:
