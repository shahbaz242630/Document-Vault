# Claimant Slice 3C — Owner-Notice Delivery Queue

Date: 2026-08-18 (Asia/Dubai)

## Decision

The bounded Slice 3C increment is code-complete locally on `codex/claimant-owner-notice-queue`. It adds a hard-disabled, service-only persistence and transaction boundary for the Slice 3B owner-notice delivery queue. No route, scheduler, provider implementation, network call, deployment, hosted migration, real notification, or external behavior was added.

## Implemented boundary

- A forced-RLS `claimant_owner_notice_deliveries` table stores only value-free outbox/case/cycle references, opaque notice reference, stable delivery idempotency and dispatch keys, attempt number, lease authority, terminal outcome, and result case version.
- Stable dispatch and delivery-idempotency keys are generated and stored atomically before work is returned for possible provider contact.
- `claimant_claim_owner_notice_delivery` locks one eligible outbox row with `FOR UPDATE ... SKIP LOCKED`, validates the pending cycle/case authority, issues a bounded 30–300 second lease, and excludes active leases.
- An expired lease can be reclaimed with a new lease token and incremented attempt number while preserving the exact dispatch and delivery-idempotency keys. Slice 3B therefore performs lookup without redispatch.
- `claimant_complete_owner_notice_delivery` requires the exact current lease, case, cycle, delivery key, result case version, and outcome. It independently verifies that Slice 3A already committed `cooldown/delivery_verified` or the matching fail-closed hold before completing the source outbox.
- Terminal completion replay is stable only with the same lease, bindings, outcome, and version. Changed replay, stale lease, wrong case/cycle/key, premature completion, and client-role access fail closed.
- Both functions are `SECURITY INVOKER`, explicitly revoked from `PUBLIC`, `anon`, and `authenticated`, and granted only to `service_role`.
- The TypeScript queue transaction client strictly parses and cross-binds RPC authority before returning the Slice 3B work contract; errors retain only the database code.
- The coordinator now binds the persisted lease token into completion. The queue client and coordinator remain absent from the API entrypoint.

## Verification

- Hosted Supabase rollback exercise: `CLAIMANT_OWNER_NOTICE_QUEUE_DB_TEST_PASSED`.
- Post-test catalog checks: owner-notice queue absent, prerequisite claimant schema absent, existing owner vault present.
- All workspaces: 994 tests passed; 3 established environment-gated mobile tests skipped.
- Focused coordinator/queue client: 12 passed.
- Queue migration/static regressions: 4 passed; combined delivery static matrix: 5 passed.
- All workspace typechecks, zero-warning root lint, unchanged 24-page production web build, API bundle, repository security, GitHub Actions security, claimant isolation, Security CI registration, and `git diff --check` passed.

Supabase guidance was applied through forced RLS, explicit grants/revokes, backend-only elevated access, and `SECURITY INVOKER` functions. Hosted advisors reported only the existing baseline warnings for executable `public.rls_auto_enable()` and disabled leaked-password protection, plus existing informational unused-index findings; Slice 3C was rolled back and introduced none of them.

## Staging and next boundary

Production remained unchanged and no local Supabase image or container was created. The next bounded slice should mount owner cancellation and claimant dispute behind independent immutable-false concealment, derive actor authority from verified fresh sessions, call only Slice 3A, return safe value-free results, and add no provider, owner UI, reviewer assignment, release predicate, deployment, or external activation.
