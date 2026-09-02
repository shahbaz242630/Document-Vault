# Claimant Slice 5L — offline-code V2 database acceptance

Date: 2026-09-02 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-database-acceptance`

Starting checkpoint: `1bc43c4` (Slice 5K mobile/API integration acceptance).

Implementation checkpoints: `4b32214` (database-acceptance scaffold) and `2be9d71` (client-workflow refactor). A final fixture-shape correction is included in the Slice 5L closeout checkpoint.

## Outcome

Replaced Slice 5K's final persistence double with a disposable local Supabase PostgREST/RPC boundary. The acceptance runner uses the actual mobile proof/lifecycle path, Hono controllers, keyed boundary indexer, signature verifier, transaction decoder, service-role registration, and migrated PostgreSQL functions and tables.

The database run passed registration and possession flows, a committed-response retry, concurrent registration, expiry, unknown-locator rate limiting, anonymous RLS denial, and strict possession-only output checks. The public HTTP challenge accepts the locator string while the mobile proof attempt retains the complete public-locator envelope; the closeout correction makes that representation boundary explicit.

The CI entry remains opt-in to the disposable local Supabase environment. No hosted project was mutated.

## Verification

- `SANDUQKIN_LOCAL_SUPABASE_ACCEPTANCE=1 npm run check:claimant-offline-code-v2-database-acceptance`: passed against local Supabase/PostgREST/RPC.
- Slice guard: `node --test scripts/claimant-offline-code-v2-database-acceptance.test.cjs`: 2 passed.
- Focused mobile/API integration: 30 passed.
- `npm run test --workspaces --if-present`: 1,258 passed, with 3 established environment-gated mobile skips (mobile 581, web 171, shared types 131, shared validation 42, API 333).
- Serial discovery over every `scripts/*.test.cjs`: 236 passed.
- `npm run typecheck`, zero-warning `npm run lint`, `npm run check:phase1`, and `npm run check:security`: passed.
- `git diff --check`: passed before closeout.

Supabase CLI `2.106.0`, matching CI, started the disposable stack. The current Slice 5L branch predates PR #68's replay-safe hardening repair in `20260819091516_harden_rls_auto_enable_execution.sql`; the exact repaired migration text from that PR branch was therefore applied only to the disposable database before the remaining current migrations and acceptance runner executed. No repository migration was copied or duplicated into Slice 5L. After PR #68 merges and its history is integrated, rerun this acceptance from the clean combined baseline.

Current Supabase local-development and CLI documentation was reviewed. No current platform change blocked the disposable local runner.

## PR #68 checkpoint

PR #68 remains open at `18c6df6` after a narrow live-database fixture repair. The previous live-security failure was isolated to positional inserts in `claimant-release-authorization-db`; the repair separates standalone and fully migrated fixtures and uses explicit live-schema columns. Fixture generation, seven focused release-authorization guards, repository lint, and `git diff --check` passed before push.

The fresh PR checks are running. GitGuardian is already green; the watcher is configured to report a meaningful red result or merge once required checks are green and the PR is mergeable. This record does not claim the PR is merged.

## Limits and unchanged state

This is disposable local database acceptance, not hosted, production, or physical-device evidence. It does not authorize external claimant access, production KDF/material distribution, trusted-edge deployment, post-possession case binding, native binding, EAS work, hosted MFA, or release.

All claimant runtime approvals remain literal false. No production implementation, hosted data, hosted migration history, deployment, real claimant data, external message, or activation changed. The unrelated `.codex-runtime/` and `.playwright-cli/` directories remain untouched. Docker Desktop was no longer available during final cleanup; no local Supabase service remains reachable, but its disposable Docker volume may remain until the next Docker start and explicit `supabase stop --workdir supabase --no-backup` cleanup.
