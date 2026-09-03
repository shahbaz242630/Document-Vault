# Slice 5M — offline-code V2 case-binding verification

Date: 2026-09-03 (Asia/Dubai)

Status: local implementation and hostile database verification passed. Final combined-main-baseline closeout remains pending PR #68 merge/integration; this is not production-readiness or activation approval.

## Candidate and scope

- Local branch: `codex/claimant-offline-code-v2-case-binding`.
- Scaffold: `af2fce3`; hardening checkpoint: `20b0d89`.
- Database baseline: all migrations from PR #68 at `6d47a23`, followed by the exact Slice 5M migration. No migration was applied to hosted Supabase.
- Service-only, security-invoker transaction creates one draft offline-code case from recent verified possession and an exact active synthetic AAL2 claimant-portal session. Owner and route material are derived from persisted authority.
- One locator and one challenge can bind once; events, pending identity creation, case creation and idempotency are transactional. Responses explicitly deny identity verification, relationship verification, intake, review and release.
- No HTTP route or client binding is added. Future controller wiring must establish trusted linkage between the authenticated caller and the verified possession result; a public challenge ID is not an HTTP authorization credential.

## Findings repaired

- Removed an inapplicable `FOR UPDATE` on read-only portal eligibility without widening its grants.
- Explicitly reject NULL RPC arguments and NULL required route-binding fields; PostgreSQL CHECK constraints otherwise accept unknown/NULL outcomes.
- Match proof/revocation lock order and advisory namespace: locator record lock before challenge row lock.
- Recheck locator lockout and challenge/locator commitment coherence.
- Added explicit local acceptance-runner container/workdir overrides while retaining loopback validation and the existing CI defaults.

## Evidence

- 1,265 workspace tests passed: mobile 581 (plus 3 established skips), web 171, shared types 131, shared validation 42, API 340.
- All workspace typechecks; root zero-warning lint; security and phase-1 guards; 78 serial script-test files; git diff whitespace check passed.
- Slice 5M live SQL passes success, exact persisted route binding, stable replay, changed input, displaced/stale session, revoked/expired/locked locator, stale/non-verified proof, owner self-binding, mismatched commitment, all eight NULL argument positions, nullable route corruption, and anonymous/authenticated table/RPC denial.
- Real concurrent sessions contend on the same locator: one case and one audit event commit, and the second claimant is rejected. Fixture cleanup deletes only generated synthetic IDs.
- Slice 5L actual mobile/Hono/verifier/PostgREST/RPC acceptance passes against the same local database.
- PR #68's current security catalog checker reports zero violations against the composite database. Supabase local security advisors report no issues.
- Fresh final-schema replay passed after checkpoint `20b0d89`: clean PR baseline reset, exact final 5M migration applied atomically, complete hostile/concurrency test, and Slice 5L end-to-end database acceptance.

## Local replay

Docker was started by the owner. The stale disposable `supabase` project was removed with `supabase stop --project-id supabase --no-backup`; its synthetic local volumes are not recoverable. The configured `sanduqkin` project now runs in `supabase_db_sanduqkin`. No other Docker project or hosted database was targeted.

For the pre-merge composite test, reset from the PR worktree with `supabase db reset --local --no-seed --workdir "C:\Projects\GitHub\Sandoq Kin-pr68-watch"`, then pipe this branch's `20260902180000_claimant_offline_code_v2_case_binding.sql` to local container psql with `ON_ERROR_STOP=1 --single-transaction`. Run:

```powershell
node scripts/claimant-offline-code-v2-case-binding-db-test.cjs --container supabase_db_sanduqkin
$env:SANDUQKIN_LOCAL_SUPABASE_ACCEPTANCE='1'
$env:SANDUQKIN_LOCAL_SUPABASE_CONTAINER='supabase_db_sanduqkin'
$env:SANDUQKIN_LOCAL_SUPABASE_WORKDIR='.'
npm run check:claimant-offline-code-v2-database-acceptance
```

Clear these test-only environment variables afterward. The Supabase CLI 2.110.0 query command rejected a multi-statement file as a prepared statement; local psql was used instead. Temporary function/constraint iteration did not create migration-history entries. After PR #68 merges, integrate its source safely and replay all final migrations from a clean local stack before calling the combined baseline closed.

## PR and remaining gates

PR #68 is open at `6d47a23`. Commits `ff40766` and `6d47a23` repair only the observed encrypted-package and signed-manifest live gates, including fully migrated fixtures, current package dates, and read-only access to immutable authorization records. Sixteen focused static tests and both repaired live gates pass locally; fresh CI is still authoritative for the whole PR.

The ACTIVE ten-minute `watch-pr-68-checks` heartbeat reports meaningful failures and merges only after required green checks and mergeability. It does not fix code, suppress checks, promote deployments, or mutate Supabase.

All claimant runtime approvals remain false. No 5M push, hosted mutation, native/EAS build, real claimant data, deployment promotion, or capability activation occurred.

Security follow-up: an earlier environment diagnostic printed an existing Supabase access token in tool output. It was not used for hosted operations. The owner was advised to rotate it; do not copy its value into evidence or handoffs.
