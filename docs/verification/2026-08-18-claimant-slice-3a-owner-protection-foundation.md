# Claimant Slice 3A — Owner-Protection Foundation

Date: 2026-08-18 (Asia/Dubai)

## Decision

The bounded Slice 3A increment is code-complete locally on `codex/claimant-owner-protection-foundation`. It adds a hard-disabled, unmounted, service-only owner-protection persistence and transaction boundary. It was not deployed. Hosted verification used the real Supabase PostgreSQL service inside one rollback-only transaction; the claimant schema, migration history, and production data remained unchanged.

## Implemented boundary

- Three forced-RLS tables hold the current protection cycle, append-only value-free lifecycle events, and idempotency results. Client roles receive explicit denials; only `service_role` can use the narrow transaction functions.
- `claimant_begin_owner_notice` creates one provider-agnostic notice intent and leaves the cycle at `owner_notified/pending_delivery`, with no active cooldown.
- `claimant_record_owner_notice_delivery` starts the configured cooldown only for a verified delivery with a bound evidence digest. Failed or ambiguous delivery moves the case to `on_hold` with no cooldown.
- `claimant_stop_owner_protection` maps owner cancellation to `cancelled_by_owner`; claimant dispute, material change, and conflicting authority fail closed to `on_hold`.
- Every mutation locks and binds the case/cycle/version, is replay-stable only for identical inputs, appends value-free events, and returns `review_started: false` plus `release_authorized: false`.
- The TypeScript transaction client rejects malformed, cross-case, cross-cycle, wrong-version, wrong-state, or incoherent RPC responses. The service validates exact synthetic inputs before delegating.
- `CLAIMANT_OWNER_PROTECTION_APPROVED` remains immutable `false`. No route, controller, provider, notification sender, UI, reviewer flow, release predicate, or normal runtime importer was added.

## Verification

- Hosted Supabase rollback exercise: `CLAIMANT_OWNER_PROTECTION_DB_TEST_PASSED`; post-test catalog checks confirmed both the owner-protection and prerequisite claimant schemas were absent and the existing owner vault remained unchanged.
- Focused API tests: 6 passed.
- Migration/isolation regressions: 5 passed.
- All workspaces: 982 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks, zero-warning root lint, unchanged 24-page production web build, and API bundle guard passed.
- Repository security, GitHub Actions security, submission/controller and custody isolation, Security CI registration, and `git diff --check` passed.

Supabase guidance was applied by using forced RLS, explicit per-role revokes/grants, service-only function execution, and `SECURITY INVOKER`. The hosted database advisors also reported pre-existing baseline warnings for an executable `public.rls_auto_enable()` security-definer function and disabled leaked-password protection, plus informational unused-index findings; Slice 3A did not create or change those items.

## Staging and next boundary

No local Supabase stack remains: all images downloaded during the abandoned local attempt were removed, while unrelated running Docker services were left untouched. The next bounded slice should add a hard-disabled, unmounted notice-delivery coordinator around the value-free outbox and an injected provider contract, preserving exact receipt/digest reconciliation without selecting or contacting a real provider.
