# Sanduqkin Security Handoff

Last updated: 2026-07-15 (Asia/Dubai)

## Security Session Opener

> Phase 1 security controls are integrated on `main` at merge commit `75907c3`. PR #25 passed the required application-security, CodeQL, OWASP ZAP, Android native, and iOS simulator gates. Protected signed iOS release `1.0.0` build `2` completed EAS Build, App Store Connect processing, and build-level export-compliance clearance for the initial GCC-only scope. It is assigned manually to `GCC Internal Testers`, and installation and launch succeeded on the owner's physical iPhone. Apple signing and submission credentials remain outside Git and are injected only through the approval-gated `Release` environment. The next security slice is multi-day physical-device validation and value-free issue triage. Do not start Phase 2 until release readiness and the residual operational controls below are closed or explicitly accepted.

## Current Security Baseline

- Default/release branch: `main`
- Current merged release commit: `75907c3d1103a12619f6a1b0ccacd971a280fd70`
- PR #25: merged
- Successful protected TestFlight run: [29376883158](https://github.com/shahbaz242630/Document-Vault/actions/runs/29376883158)
- Successful EAS build: `96d15169-4f5b-47a0-adcc-402a5c42b9dd`
- App version/build: `1.0.0` (`2`)
- Bundle identifier: `com.sanduqkin.mobile`
- App Store Connect/TestFlight status: processed and `Ready to Test`; build expires 90 days after processing.
- Export-compliance scope: standard third-party encryption, initial GCC distribution, France excluded. French ANSSI approval is deferred until France is added.
- Internal testing: `GCC Internal Testers`, automatic distribution disabled, owner account invited, physical-iPhone installation and launch confirmed.
- Physical security QA: in progress over the next several days; launch is confirmed but biometrics, Keychain/Secure Enclave behavior, background locking, screenshot protection, recovery, and complete encrypted CRUD remain to be recorded.
- No Apple private key, Expo token, certificate archive, provisioning profile, archive password, test-user password, service-role key, recovery phrase, raw MEK, or raw emergency code is committed.
- Expected unrelated untracked files: `.playwright-mcp/` and `welcome.png`.

## Release Credential Boundary

### GitHub `Release` Environment

- Requires explicit owner approval.
- Restricts deployment to protected branches.
- Holds the reusable encrypted release values required by the TestFlight workflow:
  - Expo CI token;
  - App Store Connect API private key;
  - base64 PKCS#12 distribution archive;
  - PKCS#12 archive password;
  - base64 App Store provisioning profile.
- Non-secret Apple/App Store identifiers are stored as environment variables where applicable.
- Stored secret values are never readable back from GitHub and are not documented in this handoff.

### Workflow Handling

- `.github/workflows/ios-testflight.yml` is `workflow_dispatch` only.
- The caller must type the exact confirmation value `testflight`.
- The job has `contents: read` permission and a 120-minute bound.
- The job runs only through the protected `Release` environment.
- Signing assets are written into `apps/mobile/.eas/secrets` with restrictive permissions.
- `credentials.json` is generated at runtime and is ignored by Git.
- EAS uses `credentialsSource: local`; signing credentials are not stored in the repository.
- Submission uses the least-privilege App Store Connect Developer API key.
- Transient signing files and `credentials.json` are removed under `if: always()`.
- The first OpenSSL 3 PKCS#12 archive was rejected by macOS Keychain. The archive password was rotated and the certificate was re-exported with macOS-compatible legacy PKCS#12 encryption. The corrected build succeeded.

### Local Operator Material

- Apple private material is kept outside the repository under the owner's private local secrets directory.
- `.gitignore` excludes `.env*`, `AuthKey_*.p8`, `*.mobileprovision`, `*.p12`, and `credentials.json`.
- Do not move local signing material into the workspace, shell history, issue comments, PR descriptions, screenshots, artifacts, chat messages, or handoff documents.
- Rotate/revoke the Expo token, App Store Connect API key, distribution certificate, and provisioning profile immediately after suspected exposure.

## Branch Protection And CI

`main` uses strict required status checks with protected-branch freshness:

- `App security gates`
- `CodeQL JavaScript/TypeScript (javascript-typescript)`
- `OWASP ZAP baseline`
- `Android native compile`
- `iOS simulator smoke`

PR #25 evidence:

- Application security gates passed after correcting the stale `eas.json` test path.
- CodeQL passed.
- OWASP ZAP baseline passed.
- Android native compilation passed.
- Android release-emulator smoke passed on the push run.
- iOS unsigned Release compilation, simulator install, launch, and liveness verification passed on the PR run.
- Local mobile suite after the path fix: 343 tests passed, 2 protected live tests skipped.
- Supabase live security gates and hosted integration tests passed.

Post-TestFlight local re-verification:

- Mobile suite: 94 files passed, 2 skipped; 343 tests passed, 2 protected live tests skipped.
- Mobile TypeScript validation passed.
- Phase 1 Definition-of-Done guard passed.
- Mobile secret scan passed.

The prior required names `Android native debug compile` and `Supabase live security gates` were stale merge blockers. They were replaced with the current native job names; `Supabase live security gates` remains active CI coverage but is no longer a required PR context because its protected push-only execution cannot be satisfied by every pull request.

## Zero-Knowledge And Sensitive-Data Rules

- Encrypt vault payloads client-side before persistence.
- Never store plaintext vault details, passwords, recovery phrases, private keys, raw MEKs, or raw emergency codes in Supabase or application logs.
- Normalize only safe metadata; do not add plaintext asset-detail columns.
- Keep MEK wrapping and recovery operations on the client.
- Emergency access releases sealed key material; it must not produce a server-side plaintext vault export.
- Raw emergency codes are one-time values and must not be logged, retained, screenshotted, or uploaded.
- PDF exports are readable local files and must remain on-device unless the user explicitly chooses an OS-level destination.
- Hard deletion is permanent and must be described accurately in user-facing copy.
- Test failures may retain only bounded, value-free evidence. Redact UI hierarchies and suppress sensitive command arguments/output.

## Existing Security Controls

- Client-side authenticated encryption using libsodium primitives.
- Wrapped-MEK returning-user unlock and recovery re-wrapping.
- SecureStore/local-authentication foundations and app-lock behavior.
- Supabase Row Level Security and live attack/catalog checks.
- Protected hosted-Supabase integration tests with cleanup.
- Durable audit-event, account-deletion, and retention foundations.
- Static repository security guard.
- GitHub Actions workflow-security guard.
- Mobile secret scan.
- Phase 1 Definition-of-Done gate.
- CodeQL JavaScript/TypeScript analysis.
- OWASP ZAP isolated API baseline.
- Dependabot alerts, automated security updates, and weekly grouped proposals.
- Production high/critical dependency-audit gate.
- Immutable GitHub Action SHA pins.
- Bounded Android native, Android emulator, iOS simulator, processor, and release jobs.
- Protected `Preview`, `Production`, and `Release` environment boundaries.
- Explicit code ownership for workflows, cryptography, authentication, vault/recovery, deletion, retention, webhooks, migrations, scripts, and dependency manifests.
- A value-free release checklist covering exact source, CI, dependencies, migrations, compliance, device QA, submission, and go/no-go evidence.
- Secretless, value-free GitHub issue monitoring for account-deletion and audit-retention scheduler failures, isolated from the protected processor credentials and closed automatically after recovery.
- Dependency-free CycloneDX production SBOM generation and 90-day release-run artifact retention before release credentials are materialized.
- Value-free secret lifecycle and incident procedures in `docs/secret-lifecycle-operations.md`.

## Current Findings And Residual Risks

### Immediate Release Work

- Complete TestFlight test information and contact details.
- Configure the initial GCC App Store territories; keep France unavailable until French ANSSI approval is obtained.
- Run physical-device security QA for Secure Enclave/Keychain behavior, biometrics, app backgrounding, screenshot protection, deep links, recovery, and encrypted CRUD.
- Record only device/build/result metadata; never capture decrypted vault content or recovery material.
- Review the U.S. export-classification rationale before setting `ios.infoPlist.ITSAppUsesNonExemptEncryption`; do not claim that the app contains no encryption.
- Triage and remediate any findings reported during the owner's multi-day travel testing.

### Operational Gaps

- Four legacy scheduled-processor values remain repository-level secrets because GitHub cannot expose stored values for migration. During the next rotation, create replacements directly in `Production`, verify both processors, then delete the repository copies.
- Verify scheduled-workflow incident monitoring on `main` through successful manual processor dispatches; any later open processor incident requires owner triage before release.
- Add a second qualified security reviewer before enabling required code-owner approval; the sole repository owner cannot self-approve.
- Define dependency/license review ownership and move release SBOMs into a durable owner-controlled archive before the 90-day GitHub artifact expires.
- Review artifact/log retention and minimize it without losing necessary audit evidence.
- Periodically audit persisted audit metadata to prove it contains safe identifiers only.
- Review whether non-provider secret patterns and validity checks should be enabled.

### Dependency Risk

- GitHub reports one existing moderate Dependabot item on the default branch.
- The known Expo tooling path includes an upstream `uuid` advisory and moderate development-tooling audit entries.
- npm's SBOM inventory requires scoped legacy-peer resolution because Expo's current lockfile resolves `react-native-worklets` outside an older `expo-modules-core` peer range; normal install, Expo Doctor, tests, and native CI remain green.
- There are no accepted high or critical production dependency findings.
- Do not force an Expo-incompatible downgrade; apply a compatible upstream update when available and rerun all native/security gates.

### GitGuardian Triage

PR #25 reported three occurrences across two false-positive incident types:

- a password-derived test suffix in the disposable recovery bootstrap, not a stored password;
- Apple's public App Store Connect Key ID appearing in configuration/path text, not the API private key.

The findings were reviewed and did not expose credential values. GitGuardian was not a required merge check. The incidents should be marked false positive in GitGuardian when dashboard access is available so the workspace accurately reflects the triage. Do not suppress broader secret detection or treat future findings as automatically benign.

## Next Security Slice

1. Complete TestFlight test information and initial GCC territory configuration.
2. Execute and document the multi-day physical-device security smoke test.
3. Record the iPhone model, iOS version, build number, and value-free pass/fail evidence.
4. Triage and fix any reported failures without capturing vault plaintext, credentials, recovery phrases, or emergency codes.
5. Document the U.S. export-classification rationale and set `apps/mobile/app.json` compliance metadata only if the result is supportable.
6. Complete the French ANSSI declaration before enabling France in a later distribution expansion.
7. Open narrowly scoped PRs for any code or configuration changes and require all protected checks.

## Standard Security Verification

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
node --test scripts/security-check.test.cjs scripts/mobile-secret-scan.test.cjs scripts/supabase-db-security-check.test.cjs scripts/github-actions-security-check.test.cjs scripts/phase1-dod-check.test.cjs
npm audit --omit=dev --workspaces --audit-level=high
```

For a release candidate, also require a protected `iOS TestFlight release` run from `main`, explicit `Release` approval, successful EAS archive/submission, App Store processing confirmation, and recorded physical-device QA.

## Historical Material

Detailed prior finding-by-finding evidence is preserved in `docs/handoff/archive/` and Git history. This file intentionally contains only the current security boundary, current controls, open risks, and next security work.
