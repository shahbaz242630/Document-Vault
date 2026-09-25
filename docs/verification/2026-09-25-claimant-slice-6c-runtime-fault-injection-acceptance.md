# Claimant Slice 6C runtime fault-injection acceptance verification

Date: 2026-09-25 (Asia/Dubai)

## Result

Slice 6C passes local verification on `claude/claimant-slice-6c-fault-injection`, based on `main` at `9012a75` (Slice 6B merged through PR #90). The real 6A bootstrap → 5Z foundation → 5X identity / 5Y signing / 5U–5V journey → 5T portal-session client and 5S/5R bridge chain is interrupted at every in-flight stage. In every case it fails closed and stays value-free.

## Delivered

- `runtime-fault-injection-acceptance.test.ts` has 65 tests. They cover eight in-flight stages: portal activation, fresh assertion, offline-code challenge, possession proof, handoff issue, native signing, handoff completion and portal revoke. Each stage is interrupted by the kill switch, `background`, `inactive`, bootstrap disposal and hosted-identity drift, each followed by a late success. Each stage also gets an outage followed by the kill switch, and a request that never responds followed by the kill switch. Race tests cover a same-turn kill switch with completion, concurrent disposal with lifecycle events, and construction failure in each of the three boundaries. A normal-mount test confirms the app root stays inert.
- `runtime-foundation.fixtures.test.ts` holds the shared 5Z synthetic harness, which `runtime-foundation.test.ts` now imports. It adds subscription and cleanup counters but no behavior change.
- 5T portal-session client fix, with a focused regression test for cancel and dispose. See the finding below.

## Finding

The 5T portal-session client never aborted an in-flight request on `cancel()` or closure. A request with no response therefore kept its operation pending after a kill switch, background event or disposal, and awaitable disposal waited on it. No authority was exposed, because late results were already discarded by the generation check. The client now aborts the active controller on cancel and close, and it stops waiting on an aborted request even if the transport ignores the signal. With the fix reverted, the three portal-session never-responding cases in the 6C suite time out; with it, all pass.

## Local evidence

- Focused: 6C suite 65 passed, and claimant-journey plus portal-session-client 128 passed.
- Workspace tests: 1,544 passed with the same three established mobile skips.
- Serial script tests: 296 passed.
- Workspace typechecks: passed.
- Repository zero-warning lint: passed.
- Security, GitHub Actions security, Phase 1, mobile-secret and production-dependency checks passed. All 42 claimant isolation checks passed unchanged, including 5X–5Z, 6A and 6B.
- Expo Doctor: 21/21 checks passed.
- Web production build: passed, with 24 generated routes.
- `git diff --check`: passed.
- Not run locally: the API Vercel bundle check (it needs `vercel build` credentials) and database acceptance (no server, migration or schema change; Docker is unavailable in this environment). Both are covered by PR CI where applicable.

No approval constant, launch-policy control, importer, operation or authority changed. No hosted state was touched.
