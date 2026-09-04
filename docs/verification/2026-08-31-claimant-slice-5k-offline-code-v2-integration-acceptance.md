# Claimant Slice 5K — offline-code V2 integration acceptance

Date: 2026-08-31 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-integration-acceptance`

Starting checkpoint: `5b0fcdb` (Slice 5J mobile lifecycle composition).

## Outcome

Added 30 synthetic integration scenarios connecting the actual mobile lifecycle, coordinator, HTTP transport, and platform Argon2id/HKDF/Ed25519 producer to the actual Hono controllers, keyed boundary indexer, server signature verifier, and persistence transaction decoder. The injected sender calls Hono in process. Global fetch is trapped and asserted unused. Only the database RPC is replaced with deterministic fixture responses and replay bookkeeping.

The suite checks successful possession-only output; absence of client secrets and authority fields on the wire; unchanged disabled route concealment; lost committed responses and identical bounded retries without new crypto; cancellation after server acceptance; challenge expiry and inactive lifecycle; corrupted signatures and substituted bindings; hostile headers, origin, idempotency, and body fields; rate limiting; absent trusted-edge signals; kill switches; RPC errors; and malformed or authority-expanding database output.

Cancellation cannot undo an already recorded server fact. The tested guarantee is that the local lifecycle suppresses stale success, destroys retry eligibility, and never converts possession into identity verification, a claim, or release authorization.

Run the focused suite with `npm run check:claimant-offline-code-v2-integration`. Existing workspace test discovery in `.github/workflows/security-ci.yml` includes the suite without a workflow exception or duplicate CI step. The API test references the mobile adapter's existing sodium declaration; no compiler loosenings or new dependency are introduced.

## Verification

- Dedicated integration command: 30 tests passed.
- `npm run test --workspaces --if-present`: 1,258 passed, with 3 established environment-gated mobile skips (mobile 581, web 171, shared types 131, shared validation 42, API 333).
- Serial `node --test --test-concurrency=1` over every `scripts/*.test.cjs`: 234 passed.
- `npm run typecheck` and zero-warning `npm run lint`: passed.
- `npm run web:build`: passed, with 24 static pages. `npm run check:api-vercel-bundle`: passed.
- Repository security, GitHub Actions security, mobile secret scanning, deterministic claim vectors, vector/custody isolation, and offline-code lifecycle/coordinator isolation: passed without modifying any guard or allowlist.
- `git diff --check`: passed before the local checkpoint.

Supabase RPC reference and current changelog were consulted for the boundary review: <https://supabase.com/docs/reference/javascript/rpc> and <https://supabase.com/changelog.md>. No SDK, schema, migration, or database contract change was needed.

## PR and watcher checkpoint

Read-only inspection of PR #68 still shows open head `47a332251f567f070d84e439f985e7d05a7a0f42`. Both Supabase live-security jobs and GitGuardian remain failed; native, push emulator/hosted-integration, App Security, CodeQL, ZAP, and Vercel checks remain passed. This local slice does not remediate or suppress those failures.

The `watch-claimant-integration-delivery` automation file remains absent; active monitoring is unconfirmed. No watcher was recreated or modified. No fresh preview smoke or hosted readiness result is claimed.

## Limits and unchanged state

This is local compatibility evidence, not database or native end-to-end acceptance. Replay bookkeeping in the RPC double does not prove PostgreSQL uniqueness, locks, transactions, expiry, rollback, RLS, or distributed rate limits. The unavailable-record test checks fixture response shape/length and generic client failure, not timing indistinguishability or actual database concealment. The injected clock uses the frozen fixture's validity interval; database time remains outside this test.

No production implementation or immutable-false approval changed. No native lifecycle/transport/crypto binding, physical-device evidence, production KDF approval, material distribution, trusted-edge adapter, post-possession case binding, hosted MFA, SQL/migration exercise, EAS build, provider change, push, PR publication, deployment, real claimant data, or external activation occurred. The unrelated `.codex-runtime/` and `.playwright-cli/` directories remain untouched.
