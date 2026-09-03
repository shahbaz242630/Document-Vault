# PR 68 live database fixture repair — 2026-09-03

Scope: repair the failing local-Supabase CI fixtures on
`codex/claimant-offline-code-v2-controller`, based on `6d47a23`.
No production migrations, grants, feature flags, or mounted routes changed.

## Causes and repair

- Retrieval-session setup omitted the required invitation/key/case authority
  chain. Reuse the complete encrypted-package live fixture and explicitly name
  the portal columns, intervention fields, and grant revocation timestamp.
- Delivery inherited that setup and also used an obsolete asset category and
  invalid V2 envelope lengths. Align those values with the actual constraints.
- The later offline-code persistence gate still called RPC signatures removed
  by the enumeration-resistant challenge migration. Exercise the current
  registration signature with KDF salt and the server-generated challenge API;
  obtain challenge IDs/digests from the exact idempotent issuance results.
  Preserve five-failure lockout, invalid/verified attempts, replay, revocation,
  denied client access, and no additional claimant authority. Test locked and
  unknown locators as non-persisted synthetic responses. Clear only the test
  locator's rate bucket inside the rolled-back transaction to isolate lockout
  from the rate limiter, which retains its separate live test.
- Wire signed-manifest, retrieval, and persistence fixture regression tests into
  Security CI. Standalone persistence setup now applies both relevant migrations.

## Local verification

- Reset the disposable local database from this PR worktree with
  `supabase db reset --local --no-seed --workdir .`; the newer, unpushed Slice 5M
  migration was not part of this replay.
- All nine live DB gates passed: encrypted package, signed manifest, retrieval
  session, encrypted delivery, completion, access control, lifecycle closure,
  offline-code V2 persistence, and offline-code V2 challenge.
- Standalone persistence also passed in a newly created temporary database;
  that empty test database was removed afterward.
- All 236 script regression tests passed serially.
- Local Supabase catalog security check passed with no violations; local RLS
  attack test passed; security advisors reported no issues.
- Unqualified workspace lint encountered generated Supabase CLI code under
  `supabase/.temp/`, outside the tracked source. Source lint passed with only
  that generated directory excluded (`npx eslint . --max-warnings=0
  --ignore-pattern 'supabase/.temp/**'`); no lint configuration was weakened.

Remote CI must still validate the pushed repair. The existing PR 68 watcher
remains active. Slice 5N remains gated on passing checks, merge, and successful
Slice 5M verification against the merged baseline. The separate Slice 5M
worktree and its untracked runtime/browser directories were left unchanged.
