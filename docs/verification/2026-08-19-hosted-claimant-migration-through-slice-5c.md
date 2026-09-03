# Hosted claimant migration through Slice 5C

Date: 2026-08-19 (Asia/Dubai)

Project: `pxwtexjjttpgtairpepz` (`eu-central-1`, PostgreSQL 17.6)

Starting code checkpoint: `5117cb2` (`Add enumeration-resistant offline-code challenges`)

## Outcome

The complete committed migration chain after the prior hosted checkpoint was applied to the existing Sanduqkin Supabase project. This includes the June grant hardening and every claimant database foundation through Slice 5C. Claimant routes, controllers, client integrations, and compile-time approvals remain disabled and unmounted.

The independent-review migration initially failed atomically because its composite foreign key referenced `(case_id, case_version)` without a matching unique constraint on `claimant_submission_receipts`. A narrow conditional prerequisite was added, tested against disposable PostgreSQL, applied hosted, and the chain then completed. A separate hosted advisor remediation revoked direct execution of the existing `public.rls_auto_enable()` security-definer event-trigger helper from `public`, `anon`, `authenticated`, and `service_role`.

The Supabase connector stamped execution-time migration versions. After successful schema verification, 33 history entries were transactionally reconciled by exact migration name to the repository filename versions; the final comparison reported zero unmatched entries. The CLI account could not create its temporary login role because the Management API returned 403, so the supported project-scoped connector performed the migration and verification.

## Hosted verification

- Migration history contains 44 entries and matches all repository migration name/version pairs.
- 77 claimant tables exist; zero lack RLS and zero lack forced RLS.
- Anonymous/authenticated roles hold zero claimant table privileges.
- 54 claimant functions exist; zero are security-definer and anonymous/authenticated roles can execute zero.
- Six offline-code V2 tables exist.
- The full Slice 5C hostile database exercise passed inside a hosted rollback transaction, including known/unknown equivalence, canonical challenge bytes, replay, revocation, rate limiting, and authenticated-role denial.
- Security Advisor is clear of database-function/RLS findings. One administrative Auth warning remains: leaked-password protection is disabled. Enable it through the approved Auth configuration workflow when plan/settings authority is available.
- Performance Advisor reports informational unindexed-foreign-key and newly-unused-index notices. Fresh unused-index notices are expected immediately after migration; foreign-key index recommendations require a separate measured review before changing the schema.
- PostgreSQL migration logs showed the expected migration statements and RLS auto-enable events. The known failed independent-review attempts were followed by the tested prerequisite and successful atomic migration.
- Final local regression: 1,118 workspace tests passed with 3 established mobile skips; 217 serial static/security tests, all workspace typechecks, zero-warning lint, and `git diff --check` passed.

No claimant capability was activated, no HTTP route was mounted, no real claimant data was added, no Storage/provider/Auth configuration was changed, and no production web/API deployment was performed.

## Next session opener

Resume from the hosted-migrated Slice 5C branch HEAD. First verify the repository is clean except for the preserved `.codex-runtime/` and `.playwright-cli/` directories, confirm Supabase migration history remains aligned, and review the remaining leaked-password-protection administrative warning plus measured foreign-key index recommendations. The next bounded engineering slice is the immutable-false, unmounted offline-code V2 proof-verification and attempt coordinator. Do not mount a route or enable external claimant access without separate authorization.
