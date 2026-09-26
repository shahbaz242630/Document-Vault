# Hosted claimant migration through Slice 7A

Date: 2026-09-26

Project: `pxwtexjjttpgtairpepz` (`eu-central-1`, PostgreSQL 17.6)

Code checkpoint: `b8c0cde` (merge of PR #102, Slice 7A)

## Outcome

The four repository migrations missing from the hosted project were applied in filename order, as authorised by the owner:

1. `20260902180000_claimant_offline_code_v2_case_binding` (Slice 5M)
2. `20260903075258_claimant_offline_code_v2_authenticated_handoff` (Slice 5N)
3. `20260926090000_claimant_offline_code_v2_owner_locator_list` (Slice 6J)
4. `20260926100000_claimant_single_approver_review` (Slice 7A)

## Method

The cloud session reaches the internet only over HTTPS, so the Supabase CLI could link the project but could not open a direct Postgres connection. Its temporary login role failed with a connection timeout to the pooler. `supabase db push` was therefore not used.

Each migration was sent through the Management API `POST /v1/projects/{ref}/database/query` using `SUPABASE_ACCESS_TOKEN`. The migration SQL and its `supabase_migrations.schema_migrations` row (version, name and the full file as one statement, matching earlier entries) were sent as a single request, which runs as one implicit transaction. Every request returned success, so no partial state or version reconciliation was needed.

## Hosted verification

- Migration history holds 48 entries and matches all 48 repository versions, with none missing on either side.
- 84 claimant tables exist; zero lack RLS and zero lack forced RLS.
- Anonymous and authenticated roles hold zero claimant table privileges.
- 67 claimant functions exist; zero are security definer, and anonymous and authenticated roles can execute zero.
- Seven offline-code V2 tables exist.
- `public.rls_auto_enable()` remains non-executable by anonymous and authenticated roles.
- Security Advisor: only the known administrative Auth warning (leaked-password protection disabled).
- Performance Advisor: informational only (103 unused-index, 80 unindexed-foreign-key notices). Fresh unused-index notices are expected after migration; foreign-key indexes still need a separate measured review.

## Not done

- The slice DB tests (`scripts/claimant-offline-code-v2-*-db-test.cjs`, `scripts/claimant-single-approver-review-db-test.cjs`) were not replayed inside a hosted rollback transaction. They passed on local Postgres in their slices; a hosted rollback replay is optional follow-up.
- No claimant capability, route approval, Auth/Storage/provider setting, Vercel deployment or real data changed. All claimant controls remain literal false.

## Next session opener

The hosted database now matches `main` through Slice 7A. Continue with staging wiring W1 (claimant features in Vercel Preview only), which also needs `VERCEL_TOKEN`. Future migrations can be applied the same way through the Management API; direct CLI `db push` would need a network policy that allows Postgres traffic and `SUPABASE_DB_PASSWORD`.
