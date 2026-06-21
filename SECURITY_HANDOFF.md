# Sanduqkin Security Handoff and CI Checklist

This is the go-to checklist for Sanduqkin repository security, CI/CD coverage, and release-gate hardening. Update it after every security slice. Do not mark an item complete until its implementation is committed, the relevant tests have run, and GitHub Actions is green.

## Current Baseline

- Audit date: 2026-06-21
- Audited branch: `main`
- Audited commit: `4fb2ee5cc68d99ac79ecca54441c2d2c1f0f28ca`
- Working tree at audit time: clean
- Latest audited GitHub run: [Security CI run 27897164686](https://github.com/shahbaz242630/Document-Vault/actions/runs/27897164686)
- Latest audited GitHub result: `App security gates` and `Supabase live security gates` passed
- CI runtime: Node.js `24.3.0` on `ubuntu-latest`
- Important local constraint: Node.js `24.2.0` is below the repository requirement `^22.13.0 || >=24.3.0` and should be upgraded.

## Security and CI Controls Already Running

- [x] `Security CI` runs for every pull request.
- [x] `Security CI` runs for pushes to `main`.
- [x] Workflow permissions default to `contents: read`.
- [x] Concurrent obsolete runs are cancelled for the same Git reference.
- [x] Dependencies are installed reproducibly with `npm ci`.
- [x] TypeScript checks run across mobile, API, shared types, and shared validation workspaces.
- [x] Mobile Vitest suite runs in CI.
  - Audit result: 338 tests passed and 2 live Supabase tests skipped.
- [x] API Vitest suite runs in CI.
  - Audit result: 26 tests passed.
- [x] Static repository security guard runs with `npm run check:security`.
- [x] GitHub Actions workflow security guard runs with `npm run check:github-actions-security`.
  - It rejects `pull_request_target`, broad write permissions, missing action versions, unapproved actions, and pull-request workflows that reference secrets.
- [x] Mobile secret scan runs with `npm run check:mobile-secrets`.
- [x] Ten security-guard regression tests run in CI.
- [x] Production dependency audit rejects high and critical advisories.
  - Audit result: no high or critical advisories; 13 low/moderate findings remain accepted by the current threshold.
  - Do not use `npm audit fix --force`; the current suggested forced fix downgrades Expo to an incompatible release.
- [x] A local Supabase instance starts in CI.
- [x] All repository Supabase migrations are applied to the local CI database with `ON_ERROR_STOP=1`.
- [x] Live database catalog security checks run against the local CI database.
- [x] Live RLS attack tests run against the local CI database.
- [x] Local Supabase is stopped with `if: always()` cleanup.
- [x] GitHub secret scanning is enabled.
- [x] GitHub secret-scanning push protection is enabled.
- [x] Account-deletion processor runs daily and its latest audited scheduled execution passed.
- [x] Audit-retention processor runs daily and its latest audited scheduled execution passed.
- [x] Supabase Phase 1 schema guards cover RLS, owner policies, grants, safe columns, and the 20-active-record category limit.
- [x] Current security workflows do not expose repository secrets to pull-request code.

## Open Findings — Required Checklist

### 1. Protect `main`

- [ ] Enable GitHub branch protection or a ruleset for `main`.
- [ ] Require a pull request before merge.
- [ ] Require `App security gates` and `Supabase live security gates` to pass.
- [ ] Require branches to be current before merge if that matches the chosen merge workflow.
- [ ] Prevent bypass/direct pushes except for explicitly approved administrators or emergency procedures.
- [ ] Test the rule with a disposable pull request and record the evidence below.

Reason: `main` was unprotected during the audit, so GitHub did not enforce successful CI before a direct push or merge.

### 2. Integrate the Phase 1 Definition-of-Done gate

- [ ] Resolve all violations from `npm run check:phase1`.
- [ ] Add `npm run check:phase1` to required CI after it is green.
- [ ] Confirm that a deliberate oversized-function fixture fails the gate.

Current state: the gate fails on 19 functions exceeding the 100-line limit. Do not add it as a required check until the tracked debt is resolved, or CI will be permanently red.

### 3. Run the Phase 1 guard's own tests in CI

- [x] Add `scripts/phase1-dod-check.test.cjs` to the CI security-guard test command.
- [ ] Confirm all eight Phase 1 guard tests execute in GitHub Actions.

Current state: the workflow command now includes the Phase 1 guard tests and all eight pass locally. GitHub Actions confirmation remains pending until this slice is reviewed, committed, and pushed.

#### Completion evidence — 2026-06-21 (local verification)

- Scope: include the existing Phase 1 Definition-of-Done guard regression suite in Security CI.
- Files/workflows changed: `.github/workflows/security-ci.yml`, `scripts/github-actions-security-check.test.cjs`.
- Regression proof: the new workflow-wiring test failed before the workflow change because `scripts/phase1-dod-check.test.cjs` was absent.
- Focused command: `node --test scripts/github-actions-security-check.test.cjs`.
- Focused result after implementation: 4 tests passed, 0 failed.
- Full security-guard command: `node --test scripts/security-check.test.cjs scripts/mobile-secret-scan.test.cjs scripts/supabase-db-security-check.test.cjs scripts/github-actions-security-check.test.cjs scripts/phase1-dod-check.test.cjs`.
- Full local result: 19 tests passed, 0 failed, including all 8 Phase 1 guard tests.
- GitHub Actions run: pending review, commit, and push.
- Residual risk: finding 3 remains open until a GitHub-hosted run proves the expanded command passes in CI.

### 4. Scan feature-branch pushes

- [ ] Decide whether CI must run on every branch push or only on pull requests plus `main`.
- [ ] If every pushed commit must be scanned, add an appropriate `push` branch pattern.
- [ ] Preserve concurrency cancellation to control CI usage.
- [ ] Verify a feature-branch push starts Security CI before a pull request exists.

Current state: feature-branch pushes do not run Security CI until a pull request is opened. Pull requests and pushes to `main` are covered.

### 5. Cover the two skipped live Supabase integration tests

- [ ] Define a safe isolated CI test project/account and credential-rotation policy.
- [ ] Run `returning-user-live-supabase.test.ts` in an approved protected workflow.
- [ ] Run `encrypted-vault-live-supabase-smoke.test.ts` in an approved protected workflow.
- [ ] Prevent secrets from being available to untrusted fork pull requests.
- [ ] Ensure test data is disposable and cleanup is reliable.
- [ ] Confirm logs never contain passwords, recovery phrases, MEKs, ciphertext, raw emergency codes, or service-role keys.

Current state: the normal mobile suite skips these two tests unless their explicit environment flags and credentials are provided. The local Supabase RLS job does not replace these end-to-end hosted Supabase flows.

### 6. Add Expo Doctor

- [ ] Add `npx expo-doctor` or an equivalent pinned command to CI.
- [ ] Confirm Expo SDK and React Native dependency compatibility is checked on pull requests.
- [ ] Confirm the check is green on the CI Node version.

### 7. Add native build and end-to-end coverage

- [ ] Add an Android debug/native compile gate.
- [ ] Add an Android emulator smoke test for critical Phase 1 flows.
- [ ] Add an iOS build gate on macOS when an approved runner/budget is available.
- [ ] Add an iOS simulator smoke test when the macOS environment is available.
- [ ] Cover at minimum sign-in, unlock, encrypted record create/read/edit/hard-delete, recovery reset continuity, and emergency-code raw-value hiding.
- [ ] Keep native build and E2E jobs separate from fast unit checks so failures are diagnosable.

Current state: TypeScript and Vitest checks cannot detect native Gradle/Xcode, device-runtime, Expo module, or navigation integration failures.

### 8. Configure and enforce linting

- [ ] Select an Expo/React Native-compatible ESLint configuration.
- [ ] Add workspace `lint` scripts where applicable.
- [ ] Make the root `npm run lint` perform real checks.
- [ ] Add lint to CI.
- [ ] Keep formatting-only preferences separate from security/correctness rules where practical.

Current state: the root script delegates to workspace lint scripts, but no workspace currently defines one; CI therefore performs no lint check.

### 9. Add test coverage reporting and thresholds

- [ ] Enable Vitest coverage for mobile and API code.
- [ ] Establish an initial measured baseline before choosing thresholds.
- [ ] Set thresholds for security-critical modules first: cryptography, authentication, recovery, vault persistence, hard delete, audit, account deletion, and RLS-related clients.
- [ ] Publish a coverage summary or artifact without exposing secrets or source maps containing sensitive configuration.
- [ ] Fail CI on meaningful coverage regression.

### 10. Enable GitHub code scanning

- [ ] Add a minimal-permission CodeQL workflow for JavaScript/TypeScript.
- [ ] Run it on pull requests, `main`, and an appropriate schedule.
- [ ] Confirm the initial analysis completes and triage all findings.
- [ ] Configure code-scanning results as a required merge control after the baseline is clean.

Current state: the GitHub API reported that no code-scanning analysis exists for this repository. The custom static guard is useful but is not a replacement for semantic SAST.

### 11. Enable Dependabot security coverage

- [ ] Enable Dependabot alerts.
- [ ] Enable Dependabot security updates.
- [ ] Add `.github/dependabot.yml` for npm and GitHub Actions update checks.
- [ ] Define a review cadence and ownership for dependency alerts.
- [ ] Retain the CI `npm audit` high/critical gate as an independent control.
- [ ] Triage the current 13 low/moderate audit findings without forcing an incompatible Expo downgrade.

Current state: Dependabot alerts and security updates are disabled.

### 12. Add direct shared-validation tests

- [ ] Add tests for `lastFourDigitsSchema` accepting exactly four ASCII digits.
- [ ] Add rejection cases for short, long, non-digit, whitespace-padded, punctuation, and non-string values.
- [ ] Add a test script to the shared-validation workspace or place the tests in a clearly owned existing test workspace.
- [ ] Confirm CI executes the new tests.

Current state: `packages/shared-validation` is typechecked but has no direct runtime unit tests.

### 13. Pin GitHub Actions immutably

- [ ] Pin `actions/checkout`, `actions/setup-node`, and `supabase/setup-cli` to reviewed full commit SHAs.
- [ ] Keep readable version comments beside SHA pins.
- [ ] Update the workflow security guard so a mutable tag alone is not accepted as a pin.
- [ ] Add regression tests for rejecting tag-only action references.
- [ ] Use Dependabot to propose reviewed SHA updates.

Current state: workflows use explicit mutable version tags such as `@v4` and `@v2`. The current custom guard accepts any explicit version or SHA and therefore does not enforce immutable pins.

## Additional Recommended Security Work

These items were not part of the original 13 findings but should remain visible.

- [ ] Add a repository `CODEOWNERS` file for security-sensitive paths such as workflows, migrations, cryptography, authentication, recovery, audit, and deletion processors.
- [ ] Require review from the relevant code owners through the `main` ruleset.
- [ ] Protect production GitHub environments and require approval for workflows that use production credentials.
- [ ] Document CI/repository secret ownership, purpose, rotation interval, last rotation, and revocation procedure without recording secret values.
- [ ] Add scheduled-workflow failure alerting or an operational review process; a green historical run does not guarantee failures will be noticed.
- [ ] Add explicit timeouts to CI jobs and network calls so hung workflows cannot consume runners indefinitely.
- [ ] Add retry/idempotency and response-content assertions for scheduled processor workflows where safe; current workflows primarily validate secret presence and a successful HTTP status.
- [ ] Review whether secret-scanning non-provider patterns and validity checks should be enabled for the repository.
- [ ] Generate and retain an SBOM for release builds, and define a dependency/license review policy.
- [ ] Add a release checklist that links the exact commit, required green runs, dependency audit, native QA evidence, and migration status.
- [ ] Review artifact and log retention settings to minimize sensitive operational exposure while retaining adequate audit evidence.
- [ ] Periodically verify that audit metadata contains only safe identifiers and never plaintext vault content.

## Slice Completion Template

Copy this block beneath the relevant checklist item after each completed slice:

```markdown
#### Completion evidence — YYYY-MM-DD

- Scope:
- Files/workflows changed:
- Local commands run:
- Local result:
- GitHub Actions run:
- GitHub result:
- Manual/security QA:
- Residual risks or follow-up:
```

## Mandatory Verification Before Checking an Item

1. Implement one narrow slice.
2. Run the focused regression tests for that slice.
3. Run all affected workspace tests and typechecks.
4. Run the relevant security guards.
5. Push through a pull request and wait for all required GitHub checks.
6. Record the GitHub run link and exact result in this document.
7. Mark the item `[x]` only after all required evidence is green.
8. Update `HANDOFF.md` with the completed slice and next task.

## Standard Verification Commands

```powershell
npm run typecheck
npm test --workspaces --if-present
npm run check:security
npm run check:github-actions-security
npm run check:mobile-secrets
node --test scripts/security-check.test.cjs scripts/mobile-secret-scan.test.cjs scripts/supabase-db-security-check.test.cjs scripts/github-actions-security-check.test.cjs scripts/phase1-dod-check.test.cjs
npm audit --omit=dev --workspaces --audit-level=high
npm run check:phase1
```

`npm run check:phase1` is expected to remain red until finding 2 is completed. Never describe the full security checklist as green while that required gate or any required GitHub check is failing.
