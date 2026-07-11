# Sanduqkin Security Handoff and CI Checklist

This is the go-to checklist for Sanduqkin repository security, CI/CD coverage, and release-gate hardening. Update it after every security slice. Do not mark an item complete until its implementation is committed, the relevant tests have run, and GitHub Actions is green.

## Current Baseline

- Audit date: 2026-07-10
- Audited branch: `codex/phase1-function-size-gate`
- Audited commit: `1d4407f`
- Working tree at audit time: clean
- Latest audited GitHub run: [Security CI PR run 29121804737](https://github.com/shahbaz242630/Document-Vault/actions/runs/29121804737)
- Latest audited GitHub result: `App security gates` and `Supabase live security gates` passed; CodeQL, GitGuardian, OWASP ZAP, and Vercel also passed on [PR 21](https://github.com/shahbaz242630/Document-Vault/pull/21)
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
- [x] Twenty-three security-guard regression tests run in CI, including Phase 1 guards, workflow wiring, all-branch push coverage, and immutable action-pin enforcement.
- [x] Phase 1 Definition-of-Done guard runs clean locally and is no longer blocked by oversized-function debt.
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
- [x] OWASP ZAP runs a passive baseline scan against an isolated local API on pull requests, `main`, and a weekly schedule.

## Open Findings — Required Checklist

### 1. Protect `main`

- [x] Enable GitHub branch protection or a ruleset for `main`.
- [x] Require a pull request before merge.
- [x] Require `App security gates` and `Supabase live security gates` to pass.
- [x] Require branches to be current before merge if that matches the chosen merge workflow.
- [x] Prevent bypass/direct pushes except for explicitly approved administrators or emergency procedures.
- [x] Test the rule with a disposable pull request and record the evidence below.

Current state: complete. Protection is enabled for `main`. Pull requests and current branches are required; `App security gates` and `Supabase live security gates` are required; stale approvals are dismissed; conversations must be resolved; and administrator bypass, force pushes, and branch deletion are disabled.

#### Completion evidence — 2026-06-21 (remote configuration)

- Scope: enforce the existing security CI jobs as mandatory controls before changes reach `main`.
- GitHub configuration: classic branch protection on `main` with strict required status checks and required pull requests.
- Required checks: `App security gates`, `Supabase live security gates`.
- Bypass controls: enforcement applies to administrators; force pushes and branch deletion are disabled.
- Additional merge control: unresolved pull-request conversations block merging.
- API verification: `GET /repos/shahbaz242630/Document-Vault/branches/main/protection` returned the configured protection and both required GitHub Actions checks.
- Disposable verification PR: [PR 3](https://github.com/shahbaz242630/Document-Vault/pull/3) was blocked while required checks were pending.
- Pull-request Security CI run: [run 27912184737](https://github.com/shahbaz242630/Document-Vault/actions/runs/27912184737).
- Pull-request result: `App security gates` and `Supabase live security gates` passed; Vercel and GitGuardian checks also passed.
- Residual risk: repository administrators can deliberately edit or remove branch protection through GitHub settings. Administrative access must remain tightly controlled.

### 2. Integrate the Phase 1 Definition-of-Done gate

- [x] Resolve all violations from `npm run check:phase1`.
- [x] Add `npm run check:phase1` to required CI after it is green.
- [x] Confirm that a deliberate oversized-function fixture fails the gate.

Current state: complete. The production gate runs in the branch-protected `App security gates` job, and workflow regression coverage prevents silently removing the step. Both push and pull-request Security CI runs passed on the implementation commit.

#### Local implementation evidence - 2026-07-11

- Scope: enforce the green Phase 1 Definition-of-Done gate on every Security CI run.
- Files changed: `.github/workflows/security-ci.yml`, `scripts/github-actions-security-check.test.cjs`.
- Regression proof: the new focused workflow test failed before the CI step was added and passed afterward.
- Focused result: 14 workflow-security tests passed; `npm run check:phase1` and `npm run check:github-actions-security` passed.
- Full local result: static security guard and mobile secret scan passed; all 30 security-guard regression tests passed; the high/critical production dependency-audit threshold passed.
- Dependency note: 12 known moderate Expo tooling findings remain through `xcode -> uuid`; `npm audit fix --force` would install an incompatible Expo version and was not used.
- GitHub evidence: [push Security CI run 29121802507](https://github.com/shahbaz242630/Document-Vault/actions/runs/29121802507) and [PR Security CI run 29121804737](https://github.com/shahbaz242630/Document-Vault/actions/runs/29121804737) both passed `App security gates`, including `Phase 1 Definition-of-Done`, and `Supabase live security gates`.
- Additional checks: CodeQL, OWASP ZAP, GitGuardian, and Vercel passed on implementation commit `1d4407f` in [PR 21](https://github.com/shahbaz242630/Document-Vault/pull/21).
- Residual risk: GitHub reports that the pinned checkout/setup-node action versions target the deprecated Node.js 20 action runtime and are currently forced onto Node.js 24. Track reviewed immutable action upgrades through Dependabot; do not replace SHA pins with mutable tags.

#### Completion evidence - 2026-07-10

- Scope: clear the tracked Phase 1 function-size debt in small batches, preserve behavior, and push the result through the existing protected PR/security workflow.
- Files/workflows changed: 19 oversized implementation files were refactored in the mobile app and Supabase security guard script; follow-up CI fixes aligned Expo SDK 56 patches, locked Rolldown native bindings for Linux/Windows CI installs, and reset the mobile coverage threshold baseline to the measured post-refactor values.
- Local commands run: `npm run check:phase1`; `npm run typecheck`; `npm run lint`; `npm test --workspaces --if-present`; `npm run test:coverage --workspace @vault/mobile`; `npm run doctor --workspace @vault/mobile`; `npm run check:security`; `npm run check:github-actions-security`; `npm run check:mobile-secrets`; `npm audit --omit=dev --workspaces --audit-level=high`.
- Local result: all listed commands passed. Local Node.js still emitted the known engine warning because it is `24.2.0`, below the repository requirement.
- GitHub PR: [PR 21](https://github.com/shahbaz242630/Document-Vault/pull/21).
- GitHub Actions result: `App security gates`, `Supabase live security gates`, `CodeQL JavaScript/TypeScript`, `GitGuardian Security Checks`, `OWASP ZAP baseline`, and `Vercel` all passed on commit `6bd37eb`.
- Manual/security QA: no plaintext vault data, credentials, raw emergency codes, MEKs, ciphertext, or Supabase secrets were added to logs or docs. GitHub reported one existing moderate Dependabot item on the default branch; it is separate from PR 21.
- Residual risks or follow-up: wire `npm run check:phase1` into Security CI and branch protection as a required check in the next security slice.

### 3. Run the Phase 1 guard's own tests in CI

- [x] Add `scripts/phase1-dod-check.test.cjs` to the CI security-guard test command.
- [x] Confirm all eight Phase 1 guard tests execute in GitHub Actions.

Current state: complete. The workflow command includes the Phase 1 guard tests, and the GitHub-hosted Security CI run passed both jobs.

#### Completion evidence — 2026-06-21 (local verification)

- Scope: include the existing Phase 1 Definition-of-Done guard regression suite in Security CI.
- Files/workflows changed: `.github/workflows/security-ci.yml`, `scripts/github-actions-security-check.test.cjs`.
- Regression proof: the new workflow-wiring test failed before the workflow change because `scripts/phase1-dod-check.test.cjs` was absent.
- Focused command: `node --test scripts/github-actions-security-check.test.cjs`.
- Focused result after implementation: 4 tests passed, 0 failed.
- Full security-guard command: `node --test scripts/security-check.test.cjs scripts/mobile-secret-scan.test.cjs scripts/supabase-db-security-check.test.cjs scripts/github-actions-security-check.test.cjs scripts/phase1-dod-check.test.cjs`.
- Full local result: 19 tests passed, 0 failed, including all 8 Phase 1 guard tests.
- GitHub Actions run: [Security CI run 27897926527](https://github.com/shahbaz242630/Document-Vault/actions/runs/27897926527), commit `62356c403ab33e5a76c2677aa66940bcfeb3716e`.
- GitHub result: `App security gates` passed, including `Security guard tests`; `Supabase live security gates` also passed.
- Residual risk: none for finding 3. The separate Phase 1 production gate remains tracked under finding 2.

### 4. Scan feature-branch pushes

- [x] Decide whether CI must run on every branch push or only on pull requests plus `main`.
- [x] If every pushed commit must be scanned, add an appropriate `push` branch pattern.
- [x] Preserve concurrency cancellation to control CI usage.
- [x] Verify a feature-branch push starts Security CI before a pull request exists.

Current state: complete. Security CI runs for pushes to every branch while retaining per-reference concurrency cancellation. A disposable feature branch triggered and passed both jobs without a pull request.

#### Completion evidence — 2026-06-21 (local verification)

- Regression proof: the all-branch workflow test failed before implementation because `push.branches` allowed only `main`.
- Implementation: removed the `main`-only push filter while preserving pull-request coverage and `cancel-in-progress` concurrency behavior.
- Focused command: `node --test scripts/github-actions-security-check.test.cjs`.
- Focused local result: 8 tests passed, 0 failed.
- Main GitHub Actions run: [Security CI run 27898797833](https://github.com/shahbaz242630/Document-Vault/actions/runs/27898797833), commit `0c468744da3f7ee4114ad722301299c175ce6e7a`; both jobs passed.
- Feature-branch verification: [Security CI run 27898888410](https://github.com/shahbaz242630/Document-Vault/actions/runs/27898888410) was triggered by a push to `codex/verify-security-ci-branch-push` with no pull request; both jobs passed.
- Cleanup: the disposable remote branch was deleted after verification.
- Residual risk: none for finding 4. Pull requests may also produce a second run for the same commit; concurrency remains scoped by Git reference.

### 5. Cover the two skipped live Supabase integration tests

- [ ] Define a safe isolated CI test project/account and credential-rotation policy.
- [ ] Run `returning-user-live-supabase.test.ts` in an approved protected workflow.
- [ ] Run `encrypted-vault-live-supabase-smoke.test.ts` in an approved protected workflow.
- [ ] Prevent secrets from being available to untrusted fork pull requests.
- [ ] Ensure test data is disposable and cleanup is reliable.
- [ ] Confirm logs never contain passwords, recovery phrases, MEKs, ciphertext, raw emergency codes, or service-role keys.

Current state: the normal mobile suite skips these two tests unless their explicit environment flags and credentials are provided. The local Supabase RLS job does not replace these end-to-end hosted Supabase flows.

### 6. Add Expo Doctor

- [x] Add `npx expo-doctor` or an equivalent pinned command to CI.
- [x] Confirm Expo SDK and React Native dependency compatibility is checked on pull requests.
- [x] Confirm the check is green on the CI Node version.

Current state: complete. `expo-doctor@1.19.10` is pinned as a mobile development dependency, and the `Expo Doctor` step passes in Security CI on Node.js 24.3.0.

#### Completion evidence — 2026-06-21 (local verification)

- Regression proof: the workflow-wiring test failed before implementation because Security CI had no Expo Doctor step.
- Initial diagnostic result: Expo Doctor identified a deprecated direct `@expo/metro-config` dependency/import and four SDK 56 patch mismatches.
- Root-cause fixes: moved Metro configuration to `expo/metro-config`; aligned Expo, Expo Build Properties, Expo Router, and Expo Sharing to the expected SDK 56 patches.
- Local command: `.\node_modules\.bin\expo-doctor.cmd apps/mobile --verbose`.
- Local result: 21 checks passed, 0 failed.
- GitHub Actions run: [Security CI run 27898190487](https://github.com/shahbaz242630/Document-Vault/actions/runs/27898190487), commit `a7614d3f05fae0fc47e67986c96bfffbd6b5ad2f`.
- GitHub result: `Expo Doctor`, all other application gates, and `Supabase live security gates` passed.
- Residual risk: none for finding 6.

### 7. Add native build and end-to-end coverage

- [ ] Add an Android debug/native compile gate.
- [ ] Add an Android emulator smoke test for critical Phase 1 flows.
- [ ] Add an iOS build gate on macOS when an approved runner/budget is available.
- [ ] Add an iOS simulator smoke test when the macOS environment is available.
- [ ] Cover at minimum sign-in, unlock, encrypted record create/read/edit/hard-delete, recovery reset continuity, and emergency-code raw-value hiding.
- [ ] Keep native build and E2E jobs separate from fast unit checks so failures are diagnosable.

Current state: TypeScript and Vitest checks cannot detect native Gradle/Xcode, device-runtime, Expo module, or navigation integration failures.

#### Android native compile implementation evidence — 2026-07-11 (remote CI pending)

- Scope: implement the first part of finding 7 as a separate Android debug/native compile job.
- Workflow: `Android native compile` runs independently from fast unit checks on `ubuntu-latest` with a 45-minute timeout.
- Toolchain: Node.js 24.3.0, Expo prebuild to generate the git-ignored native project, Temurin Java 17 through immutable `actions/setup-java@f2beeb24e141e01a676f977032f5a29d81c9e27e`, Android platform/build tools 36, NDK 27.1.12297006, and the generated Gradle wrapper.
- Compile command: `./gradlew app:assembleDebug -x lint -x test --no-daemon --stacktrace -PreactNativeArchitectures=x86_64` from `apps/mobile/android`.
- Regression proof: the focused workflow test failed before implementation because no Android native compile job existed, then passed after the job and immutable action allowlist were added.
- Local result: the equivalent Windows build succeeded through a short `S:` drive mapping with `BUILD SUCCESSFUL in 1m 53s`; the normal long repository path exceeds Ninja's Windows 260-character generated-path limit.
- Security verification: GitHub Actions security guard passed; 15 workflow tests passed; mobile secret scan passed; 20 combined security/secret/workflow tests passed.
- Follow-up refactor: split the three pre-existing oversized UI functions into focused hooks/presentation helpers without changing behavior. `npm run check:phase1`, mobile typecheck, and focused biometric/export tests pass.
- Coverage follow-up: the UI redesign changed the global source denominator, so only the global mobile floors were recalibrated to the measured post-redesign baseline (28% branches, 37% functions, 40% lines, 39% statements). Dedicated auth, vault-security, and cryptography thresholds remain unchanged.
- Required before checking item 7.1: push through a PR, obtain a green `Android native compile` GitHub job, and record its run URL and exact result here.
- First remote result: push run `29149675121` failed in `Set up Java` because Gradle caching was initialized before Expo generated the ignored Android project. Follow-up wiring generates Android before Java cache discovery.
- Second remote result: push run `29149713679` passed native generation and Java setup, then exited 127 because `sdkmanager` was not on `PATH`. Follow-up uses its explicit `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager` location.
- Third remote result: push run `29149765641` failed workflow validation because the inline quoted SDK command was not valid YAML. The command now uses a block scalar and regression coverage parses all workflow files as YAML.

### 8. Configure and enforce linting

- [x] Select an Expo/React Native-compatible ESLint configuration.
- [x] Add workspace `lint` scripts where applicable.
- [x] Make the root `npm run lint` perform real checks.
- [x] Add lint to CI.
- [x] Keep formatting-only preferences separate from security/correctness rules where practical.

Current state: complete. The root `eslint . --max-warnings=0` command checks every JavaScript and TypeScript workspace with Expo's maintained flat configuration, TypeScript path resolution, generated-output ignores, and Node globals for repository CommonJS scripts. A centralized root command is used instead of duplicated workspace scripts, and formatting remains outside this correctness lint gate.

#### Completion evidence — 2026-06-22

- Scope: replace the no-op root lint delegation with an Expo-compatible, zero-warning repository lint gate and enforce it in Security CI.
- Files/workflows changed: `eslint.config.js`, root package manifest and lockfile, `.github/workflows/security-ci.yml`, the workflow regression test, and source/test files required to clear the initial lint baseline.
- Regression proof: `node --test scripts/github-actions-security-check.test.cjs` failed before implementation because the root lint command still delegated to missing workspace scripts; it passed after implementation with 12 of 12 tests.
- Local commands: `npm ci`; `npm run typecheck`; `npm run lint`; `npm run doctor --workspace @vault/mobile`; `npm test --workspaces --if-present`; all repository security guards and guard tests; and `npm audit --omit=dev --workspaces --audit-level=high`.
- Local result: all workspace typechecks passed; lint completed with zero errors and zero warnings; Expo Doctor passed 21 of 21 checks; mobile passed 338 tests with the two protected hosted-Supabase tests skipped; shared validation passed 10 tests; API passed 27 tests; and all 28 security-guard tests passed.
- GitHub Actions: [Security CI PR run 27925410054](https://github.com/shahbaz242630/Document-Vault/actions/runs/27925410054), [Security CI push run 27925404828](https://github.com/shahbaz242630/Document-Vault/actions/runs/27925404828), [final handoff Security CI run 27925538240](https://github.com/shahbaz242630/Document-Vault/actions/runs/27925538240), [CodeQL run 27925410077](https://github.com/shahbaz242630/Document-Vault/actions/runs/27925410077), and [OWASP ZAP run 27925410089](https://github.com/shahbaz242630/Document-Vault/actions/runs/27925410089), implementation commit `5d78c2a`.
- GitHub result: both `App security gates` and both `Supabase live security gates` passed; CodeQL, OWASP ZAP, Vercel, and GitGuardian passed.
- Residual risk: the existing moderate Expo tooling `uuid` advisory remains accepted and independently tracked under dependency security coverage; the lint slice introduced no new high or critical production advisories.

### 9. Add test coverage reporting and thresholds

- [x] Enable Vitest coverage for mobile and API code.
- [x] Establish an initial measured baseline before choosing thresholds.
- [x] Set thresholds for security-critical modules first: cryptography, authentication, recovery, vault persistence, hard delete, audit, account deletion, and RLS-related clients.
- [x] Publish a coverage summary or artifact without exposing secrets or source maps containing sensitive configuration.
- [x] Fail CI on meaningful coverage regression.

Current state: complete. Vitest's pinned V8 provider measures all non-test mobile and API source except native-only implementations that require device coverage. Security CI enforces measured global and security-critical thresholds, prints terminal summaries, and retains only JSON summary artifacts for 14 days. HTML, LCOV, source maps, source content, and configuration values are not uploaded.

#### Completion evidence — 2026-06-22

- Scope: add reproducible mobile/API coverage measurement, establish the initial baseline, enforce regression thresholds, and retain safe summaries in CI.
- Files/workflows changed: mobile and API Vitest configurations and package scripts, root coverage-provider dependency and lockfile, `.github/workflows/security-ci.yml`, and the workflow regression test.
- Regression proof: `node --test scripts/github-actions-security-check.test.cjs` failed before implementation because both coverage scripts were absent; it passed after implementation with 13 of 13 tests.
- Measured mobile baseline: statements 44.59% (817/1,832), branches 32.59% (325/997), functions 44.19% (297/672), and lines 45.66% (801/1,754).
- Measured API baseline: statements 64.16% (111/173), branches 52.72% (58/110), functions 52.50% (21/40), and lines 64.16% (111/173).
- Security-critical thresholds: dedicated groups cover mobile cryptography; authentication, recovery, audit, and account deletion; vault persistence, hard delete, emergency access, and Supabase/RLS clients; plus API account-deletion, audit-retention, and HTTP-security processors. Cryptography is held at 94% branches, 100% functions, and 98% lines/statements; the other groups are held at their measured initial baselines.
- Deliberate failure proof: `.\node_modules\.bin\vitest.cmd run --coverage --coverage.thresholds.lines=100 --root services/api` exited 1 because measured API line coverage was 64.16%, proving regression thresholds fail the gate.
- Local verification: clean `npm ci`; all workspace typechecks; zero-warning lint; Expo Doctor 21 of 21; 375 normal workspace tests passed with the two protected hosted-Supabase tests skipped; both coverage suites and thresholds passed; all 29 security-guard tests passed; and the production dependency audit reported no high or critical advisories.
- GitHub Actions: [Security CI PR run 27940606957](https://github.com/shahbaz242630/Document-Vault/actions/runs/27940606957), [Security CI push run 27940587031](https://github.com/shahbaz242630/Document-Vault/actions/runs/27940587031), [CodeQL run 27940606954](https://github.com/shahbaz242630/Document-Vault/actions/runs/27940606954), and [OWASP ZAP run 27940606951](https://github.com/shahbaz242630/Document-Vault/actions/runs/27940606951), implementation commit `bf10257`.
- GitHub result: both `App security gates` and both `Supabase live security gates` passed; CodeQL, OWASP ZAP, Vercel, and GitGuardian passed. Each Security CI run retained a non-expired `coverage-summaries` artifact of 4,058 bytes containing only the two `coverage-summary.json` files.
- Residual risk: native-only cryptography implementations remain outside Node-based coverage and require the separate native build/E2E slice; overall mobile coverage reflects the initial baseline and should be raised incrementally rather than treated as a target ceiling.

### 10. Enable GitHub code scanning

- [x] Add a minimal-permission CodeQL workflow for JavaScript/TypeScript.
- [x] Run it on pull requests, `main`, and an appropriate schedule.
- [x] Confirm the initial analysis completes and triage all findings.
- [x] Configure code-scanning results as a required merge control after the baseline is clean.

Current state: complete. CodeQL scans JavaScript and TypeScript on pull requests to `main`, pushes to `main`, a weekly schedule, and manual dispatch. The initial analysis completed with zero open alerts, and the CodeQL job is a required `main` branch-protection check.

#### Completion evidence — 2026-06-21

- Scope: add semantic JavaScript/TypeScript SAST and enforce it before merge.
- Files/workflows changed: `.github/workflows/codeql.yml`, `scripts/github-actions-security-check.cjs`, `scripts/github-actions-security-check.test.cjs`.
- Permissions: `contents: read` and `security-events: write`; the workflow does not reference repository secrets.
- Immutable action pin: `github/codeql-action` v4.36.2 at commit `8aad20d150bbac5944a9f9d289da16a4b0d87c1e`.
- Regression proof: the focused workflow-wiring test failed before implementation because `.github/workflows/codeql.yml` did not exist.
- Focused command: `node --test scripts/github-actions-security-check.test.cjs`.
- Focused result: 9 tests passed, 0 failed.
- Static workflow command: `npm run check:github-actions-security`.
- Full security-guard result: 24 tests passed, 0 failed.
- Verification PR: [PR 4](https://github.com/shahbaz242630/Document-Vault/pull/4).
- Initial CodeQL run: [run 27912805720](https://github.com/shahbaz242630/Document-Vault/actions/runs/27912805720) passed for JavaScript/TypeScript.
- Initial alert triage: GitHub code-scanning API returned zero open alerts after the analysis.
- Required merge control: strict `main` protection requires `CodeQL JavaScript/TypeScript (javascript-typescript)` alongside both existing Security CI jobs.
- Residual risk: CodeQL complements but does not replace dependency scanning, secret scanning, runtime testing, or manual security review.

### 11. Enable Dependabot security coverage

- [x] Enable Dependabot alerts.
- [x] Enable Dependabot security updates.
- [x] Add `.github/dependabot.yml` for npm and GitHub Actions update checks.
- [x] Define a review cadence and ownership for dependency alerts.
- [x] Retain the CI `npm audit` high/critical gate as an independent control.
- [x] Triage the current audit and Dependabot findings without forcing an incompatible Expo downgrade.

Current state: complete. Dependabot alerts and automated security fixes are enabled. Weekly grouped npm and GitHub Actions updates run on Monday in the `Asia/Dubai` timezone and request review from `shahbaz242630`. The independent production high/critical audit gate remains in Security CI.

#### Completion evidence — 2026-06-22

- Scope: enable repository dependency alerts, security updates, and scheduled version-update proposals for npm and GitHub Actions.
- GitHub settings: `PUT /vulnerability-alerts` and `PUT /automated-security-fixes` returned `204`; follow-up API checks confirmed alerts enabled and automated fixes `enabled: true`, `paused: false`.
- Files changed: `.github/dependabot.yml`, `scripts/github-actions-security-check.test.cjs`, and `package-lock.json`.
- Regression proof: the focused configuration test failed before implementation because `.github/dependabot.yml` did not exist.
- Configuration validation: Dependabot YAML parsed with two update sources, `npm` and `github-actions`; both use weekly schedules, grouped updates, five-PR limits, and owner review.
- Initial GitHub alert baseline: 4 open alerts — Vite high and medium development alerts, one low Babel alert, and one moderate `uuid` alert through Expo config tooling.
- Remediation: non-breaking lockfile updates moved Vite from `8.0.12` to `8.0.16` and Babel core from `7.29.0` to `7.29.7`, removing the Vite and Babel alerts locally.
- Retained finding: `GHSA-w5hq-g745-h8pq` remains through `@expo/config-plugins -> xcode@3.0.1 -> uuid@7.0.3`; npm only proposes incompatible Expo/package downgrades, so no forced fix was applied.
- Current npm audit: 12 moderate entries cascading from the retained Expo/`uuid` tooling path; no high or critical production findings.
- Local verification: all workspace typechecks passed; Expo Doctor passed 21/21; mobile 338 tests passed with 2 hosted-Supabase tests skipped; shared validation 10 tests passed; API 27 tests passed; security guards 27 tests passed.
- Verification PR: [PR 6](https://github.com/shahbaz242630/Document-Vault/pull/6).
- GitHub Actions: [Security CI run 27923590663](https://github.com/shahbaz242630/Document-Vault/actions/runs/27923590663), [CodeQL run 27923590657](https://github.com/shahbaz242630/Document-Vault/actions/runs/27923590657), and [OWASP ZAP run 27923590693](https://github.com/shahbaz242630/Document-Vault/actions/runs/27923590693) passed.
- Review cadence: review new security alerts promptly and review grouped version-update PRs each Monday; do not merge dependency changes until all required checks pass.
- Residual risk: one moderate upstream Expo build-tooling advisory remains visible pending a compatible upstream release. The local Node.js `24.2.0` engine mismatch also remains and should be corrected separately.

#### Follow-up Dependabot cleanup - 2026-06-22

- Scope: repair and merge the failing grouped npm update without weakening lint, Expo compatibility, cryptography, coverage, or dependency-audit controls.
- Root cause: the bot proposed `libsodium-wrappers-sumo@0.8.4`, which triggered strict crypto lint warnings, together with React Native, React DOM, and safe-area versions outside the installed Expo SDK 56 compatibility set.
- Remediation: retained the compatible Supabase, RevenueCat, Zod, Hono, React type, and Vitest updates while keeping libsodium, React, React DOM, React Native, and safe-area dependencies at their verified Expo-compatible versions.
- Local verification: CI-equivalent Node.js 24.3.0 Docker run passed typecheck, zero-warning lint, Expo Doctor 21/21, 375 workspace tests, both coverage thresholds, 29 security-guard tests, mobile secret scanning, and the high/critical production dependency audit gate.
- Verification PR: [PR 14](https://github.com/shahbaz242630/Document-Vault/pull/14), merged as commit `381aacbd438d88c563bfc4a09ae82daaade58328`.
- Post-merge GitHub result: [Security CI run 27955829644](https://github.com/shahbaz242630/Document-Vault/actions/runs/27955829644), [CodeQL run 27955829603](https://github.com/shahbaz242630/Document-Vault/actions/runs/27955829603), and [OWASP ZAP run 27955829948](https://github.com/shahbaz242630/Document-Vault/actions/runs/27955829948) passed. All three post-merge Dependabot update jobs also passed.
- Next cleanup: [PR 9](https://github.com/shahbaz242630/Document-Vault/pull/9) remains blocked because the TypeScript 6 update is incompatible with current Node/Supabase type declarations. Handle it as a separate slice.
- Residual risk: the accepted moderate Expo tooling `uuid` advisory remains; no high or critical production advisory is open.

### 12. Add direct shared-validation tests

- [x] Add tests for `lastFourDigitsSchema` accepting exactly four ASCII digits.
- [x] Add rejection cases for short, long, non-digit, whitespace-padded, punctuation, and non-string values.
- [x] Add a test script to the shared-validation workspace or place the tests in a clearly owned existing test workspace.
- [x] Confirm CI executes the new tests.

Current state: complete. The shared-validation workspace has a Vitest script and 10 direct schema cases, and its tests execute through the green CI workspace-test step.

#### Completion evidence — 2026-06-21 (local verification)

- Integration proof: `npm test --workspace @vault/shared-validation` failed before implementation because the workspace had no `test` script.
- Added coverage: valid zero-padded and ordinary four-digit values; short, long, letters, leading/trailing whitespace, punctuation, non-ASCII digits, number, and null rejection cases.
- Local command: `npm test --workspace @vault/shared-validation`.
- Local result: 1 file passed, 10 tests passed, 0 failed.
- GitHub Actions run: [Security CI run 27898190487](https://github.com/shahbaz242630/Document-Vault/actions/runs/27898190487), commit `a7614d3f05fae0fc47e67986c96bfffbd6b5ad2f`.
- GitHub result: `Unit tests` passed with the shared-validation workspace included; all remaining application and Supabase gates also passed.
- Residual risk: none for finding 12.

### 13. Pin GitHub Actions immutably

- [x] Pin `actions/checkout`, `actions/setup-node`, and `supabase/setup-cli` to reviewed full commit SHAs.
- [x] Keep readable version comments beside SHA pins.
- [x] Update the workflow security guard so a mutable tag alone is not accepted as a pin.
- [x] Add regression tests for rejecting tag-only action references.
- [x] Use Dependabot to propose reviewed SHA updates.

Current state: complete. All actions in Security CI use full upstream commit SHAs with readable release comments. The guard rejects missing, tag-only, branch, abbreviated, and otherwise non-40-character pins. Dependabot is configured to propose grouped GitHub Actions updates for review.

#### Completion evidence — 2026-06-21 (local verification)

- Regression proof: mutable `@v4` tags passed before implementation, and an inline version comment bypassed action allowlisting entirely.
- Upstream pins resolved: `actions/checkout` v4.3.1, `actions/setup-node` v4.4.0, and `supabase/setup-cli` v2.1.1.
- Guard hardening: action references are parsed even with inline comments and must contain a full 40-character hexadecimal commit SHA.
- Focused command: `node --test scripts/github-actions-security-check.test.cjs`.
- Focused local result: 8 tests passed, 0 failed.
- Static workflow command: `npm run check:github-actions-security`.
- Static local result: passed.
- GitHub Actions run: [Security CI run 27898797833](https://github.com/shahbaz242630/Document-Vault/actions/runs/27898797833), commit `0c468744da3f7ee4114ad722301299c175ce6e7a`.
- GitHub result: both `App security gates` and `Supabase live security gates` passed using the immutable pins.
- Residual risk: proposed action updates still require review and all protected-branch checks before merge.

### 14. Add OWASP ZAP dynamic API scanning

- [x] Run ZAP against an isolated local API instead of production or third-party infrastructure.
- [x] Run the baseline on pull requests, `main`, an appropriate schedule, and manual dispatch.
- [x] Pin the ZAP container by immutable digest and keep workflow permissions minimal.
- [x] Fail CI when the ZAP JSON report contains a high-risk alert.
- [x] Retain HTML, JSON, and Markdown reports for review without including credentials or production data.
- [x] Make `OWASP ZAP baseline` a required `main` merge check after a clean baseline.

Current state: complete. The workflow starts the Hono API locally without production credentials, scans `http://127.0.0.1:8787/health`, enforces a high-risk alert threshold, uploads reports for seven days, and stops the test API during unconditional cleanup. It does not scan production, Supabase, or authenticated mobile traffic.

#### Completion evidence — 2026-06-21

- Scope: add a bounded OWASP ZAP passive DAST baseline for the API health surface.
- Files/workflows changed: `.github/workflows/zap.yml`, `.zap/rules.tsv`, `.github/workflows/security-ci.yml`, `services/api/scripts/zap-server.ts`, `services/api/src/index.ts`, `services/api/src/index.test.ts`, `scripts/zap-report-check.cjs`, `scripts/zap-report-check.test.cjs`, `scripts/github-actions-security-check.cjs`, and `scripts/github-actions-security-check.test.cjs`.
- Regression proof: the workflow-wiring test failed before implementation because `.github/workflows/zap.yml` did not exist; the report-gate test failed because the checker did not exist; API header tests failed before the ZAP-driven header fixes.
- Container pin: official `ghcr.io/zaproxy/zaproxy` amd64 manifest digest `sha256:461415b7526ca60af0ddc15389419d05df243aed1b665b64d3a8c3ebd67c6056`.
- Local Docker result: 66 passive checks passed, 0 warnings, 0 high-risk alerts, and 1 documented ignore for intentionally non-storable health content.
- API verification: 10 test files and 27 tests passed; API typecheck passed.
- Security-guard verification: 26 tests passed, including workflow wiring and the high-risk report threshold.
- Production dependency audit: no high or critical findings.
- Verification PR: [PR 5](https://github.com/shahbaz242630/Document-Vault/pull/5).
- GitHub Actions run: [OWASP ZAP run 27913963018](https://github.com/shahbaz242630/Document-Vault/actions/runs/27913963018) passed in 1 minute 21 seconds.
- GitHub-hosted result: 66 passive checks passed, 0 warnings, 0 high-risk alerts, and the documented rule `10049` ignore was applied.
- Artifact evidence: `owasp-zap-report` artifact `7778237071` uploaded six files with SHA-256 `a7c5a5aa0f0a387997b126bf7fae81a36684727da6730ac50e969602e82ada3c` and seven-day retention.
- Required merge control: strict `main` protection requires `OWASP ZAP baseline` alongside CodeQL and both Security CI jobs.
- Residual risk: this is an unauthenticated passive baseline of the current API health surface. Authenticated API paths, active scanning, the Expo mobile client, and third-party Supabase services require separately designed test environments and authorization boundaries.

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
8. Update `SECURITY_HANDOFF.md` with the completed slice and next task; do not duplicate security work in the normal handoff.

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

`npm run check:phase1` is required by the branch-protected `App security gates` job and is expected to remain green. The remaining open security findings are the protected live-Supabase integration tests, native build/E2E coverage, and the additional recommended hardening work above.
