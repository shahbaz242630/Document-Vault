# Claimant Portal Session Boundary Evidence

Date: 2026-08-04 (Asia/Dubai)

## Scope

This value-free record covers the first bounded Phase 2 Slice 1A foundation only. It adds claimant-host concealment, a server-owned synthetic portal-eligibility decision, and claimant-portal-specific session activation/assertion/revocation. It does not complete the claimant sign-in/MFA UX, account bootstrap, invitation acceptance, device-key enrollment, case access, evidence, release, deployment, or external activation.

## Source And Fingerprint

- Base commit: `887abd0459197c5123b8972e1b8c5bed14ec5528` (`main` / `origin/main` at the start of the in-progress Phase 0-2 bundle).
- The repository remained an intentionally uncommitted working tree containing the earlier Phase 0-1 bundle and this boundary slice.
- Boundary implementation aggregate SHA-256: `50ff7651ece1a5c7551e5bbc8539d6815ed680ed63626e686ff78d665388df5c`.
- Fingerprint algorithm: sort the 20 boundary implementation paths ordinally, calculate SHA-256 over each complete file, serialize each as `<lowercase-sha256><two spaces><path>` joined by LF, then SHA-256 the UTF-8 serialization. Handoff documents and this evidence file are excluded to avoid a recursive documentation hash.

## Database State

- Migration order through this slice ends with `supabase/migrations/20260804210000_claimant_portal_session_boundary.sql`, after the four claimant Phase 1 migrations.
- The new migration was applied directly to the already verified local `supabase_db_supabase` container with `psql -v ON_ERROR_STOP=1`; the container was not reset.
- Hosted Supabase was not linked, migrated, or changed.
- The live catalog, rollback-only portal database suite, and hostile anonymous/authenticated REST/RPC suite passed after application.
- A clean replay in a separate disposable Supabase stack remains required before the whole Slice 1A can be recorded complete. The current verified container must not be reset to satisfy that gate.

## Verification Results

- Pre-edit Phase 1 baseline: 68 API tests, 64 static security regressions, four rollback-only claimant database suites, live catalog/RLS attack checks, all workspace typechecks, full lint, claimant vector/custody isolation, and repository/GitHub Actions security guards passed.
- Boundary API: 73 tests across 18 files passed.
- Boundary web: 148 tests across 42 files passed, including 9 focused claimant host/config/header/page tests.
- Static security and migration regressions: 67 passed.
- Portal database boundary, live catalog security, and hostile RLS/REST/RPC checks passed.
- All workspace typechecks and full repository lint passed after the boundary implementation.
- The production web build completed and emitted `/claimant/sign-in` as a dynamic route behind the fail-closed proxy boundary.

## Exact Commands

```text
npm test --workspace @vault/api
npm test --workspace @vault/web
node --test scripts/security-check.test.cjs scripts/mobile-secret-scan.test.cjs scripts/supabase-db-security-check.test.cjs scripts/claimant-foundation-migration.test.cjs scripts/claimant-registered-recipient-mutations-migration.test.cjs scripts/claimant-session-assurance-migration.test.cjs scripts/claimant-registered-recipient-lifecycle-migration.test.cjs scripts/claimant-portal-session-boundary-migration.test.cjs scripts/github-actions-security-check.test.cjs scripts/phase1-dod-check.test.cjs scripts/zap-report-check.test.cjs scripts/generate-release-sbom.test.cjs scripts/report-processor-status.test.cjs
npm run check:claimant-portal-session-boundary-db
npm run check:supabase-db-security
npm run check:supabase-rls
npm run typecheck
npm run lint
npm run check:claim-vectors
npm run check:claim-vector-isolation
npm run check:claim-custody-isolation
npm run check:security
npm run check:github-actions-security
git diff --check
```

## Stop Boundary

All claimant production flags remain false. No real identity, invitation, evidence, secret, key, case, notification, or release material was used. No deployment, provider, DNS, hosted Auth, hosted database, TestFlight, or production change was made.
