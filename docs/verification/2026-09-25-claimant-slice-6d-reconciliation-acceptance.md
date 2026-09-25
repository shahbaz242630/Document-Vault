# Claimant Slice 6D mobile-to-API reconciliation acceptance verification

Date: 2026-09-25 (Asia/Dubai)

## Result

Slice 6D passes local verification on `claude/claimant-slice-6d-reconciliation`, based on `main` at `404945a` (Slice 6C merged through PR #92). The real mobile runtime chain — 6A bootstrap → 5Z foundation → 5T portal-session client, 5R/5S bridge and handoff — ran against the actual mounted portal-session, offline-code V2 and handoff Hono routes. Only the database was replaced, by a synthetic store implementing the idempotency, replay, displacement and single-use rules of the three cited migrations.

## Delivered

- `services/api/src/claimant/claimant-runtime-reconciliation-acceptance.test.ts`, with 13 tests:
  - the full route to exactly one case, followed by a normal revoke;
  - a lost committed response followed by exact retry, for activation, proof, handoff completion and revoke;
  - a lost completion followed by the kill switch or background;
  - restart after a lost completion, where no second case can be bound;
  - restart after a lost handoff issue, which recovers normally;
  - displacement of a stale portal session by a new sign-in;
  - reused-key conflicts for activation and revoke;
  - no API traffic from any entry point after the kill switch.
- Two defect fixes, each with a regression test (see below).
- Scope: `docs/superpowers/specs/2026-09-25-claimant-slice-6d-reconciliation-acceptance.md`.

## Findings

1. **Portal revoke contract mismatch.** The SQL revoke advances the session control version once and returns the new version. The 5T mobile client required equality with the active version, so every revoke against the real database was reported as failed on the device even though the server had revoked the session. The client now requires exactly the advanced version. The four earlier fixtures that encoded the wrong contract now return the real value, and a new unit test rejects both the old equal version and any other version.
2. **Kill-switch microtask window.** The 6A bootstrap deferred runtime disposal to the next microtask, so an operation started immediately after `engageKillSwitch()` reached the API; a portal activation succeeded in the suite. Disposal is now synchronous. A new bootstrap test asserts that disposal has happened before the kill switch returns.

With both fixes reverted, the new regression tests fail; with them, all pass.

## Local evidence

- 6D suite: 13 passed. Mobile claimant-session and claimant-journey: 139 passed, plus the new regression tests.
- Workspace tests: 1,560 passed with the same three established mobile skips.
- Serial script tests: 294 passed.
- Workspace typechecks and repository zero-warning lint: passed.
- Security, GitHub Actions security, Phase 1, mobile-secret and production-dependency checks: passed. All 42 claimant isolation checks passed unchanged.
- Expo Doctor: 21/21. Web production build: 24 routes.
- Not run locally: the API Vercel bundle check (needs `vercel build` credentials; covered by CI) and database acceptance (no migration or schema change; Docker is unavailable here).

## Limits

This is contract-level evidence against a store modelled on the SQL, not PostgreSQL. Row locking, RLS, rate-limit windows and concurrent transactions remain for the Docker-based database slice. No approval constant, launch-policy control, importer, route, controller configuration, migration or authority changed. No hosted state was touched.
