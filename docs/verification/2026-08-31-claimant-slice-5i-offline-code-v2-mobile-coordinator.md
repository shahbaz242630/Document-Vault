# Claimant Slice 5I — offline-code V2 mobile transport/coordinator

Date: 2026-08-31 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-mobile-coordinator`

Starting checkpoint: `f8dce80` (`Add offline-code V2 physical KDF probe host`).

## Outcome

Slice 5I connects challenge retrieval, the existing local proof producer, and proof submission through two independently disabled, runtime-disconnected mobile modules. The transport requires an explicitly injected adapter, exact HTTPS origins and request allowlists, bounded streamed JSON, canonical challenge bytes, and strict possession-only responses. It sends no client secret, owner/grant record, authentication/cookie input, or trusted-edge authority.

The coordinator accepts only synthetic, production-unapproved KDF material. It freezes local inputs, checks challenge/KDF/public-record/proof bindings, suppresses concurrent or cancelled work, enforces expiry and nondecreasing time, and discards late results. Ambiguous proof delivery can be explicitly retried with identical public bytes and idempotency, up to three total sends without rerunning the KDF. Pending public proof state is memory-only and cleared on cancellation, definite failure, expiry (including an idle timer), exhausted retries, or success.

`CLAIMANT_OFFLINE_CODE_V2_TRANSPORT_APPROVED` and `CLAIMANT_OFFLINE_CODE_V2_CLIENT_COORDINATOR_APPROVED` remain literal false. No normal mobile runtime, probe app, web route, API route, or shared barrel imports them. The AST-assisted isolation guard and hostile mutation tests are registered in Security CI.

## Verification

- New transport/coordinator behavior tests: 52 passed, including actual frozen proof production and independent Ed25519 signature verification. The full offline-code mobile feature suite passes 61 tests.
- All workspaces: 1,195 passed, with 3 established environment-gated mobile skips (mobile 548, web 171, shared types 131, shared validation 42, API 303).
- Full serial static/security suite: 231 passed, including 3 new isolation/mutation tests.
- All workspace typechecks and zero-warning root lint passed.
- Unchanged web build generated 24 static pages; API Vercel bundle guard passed.
- Repository/GitHub Actions security, mobile secret scan, deterministic vectors, vector/custody isolation, and all offline-code isolation tests passed.
- Review caught and corrected a mobile Buffer compatibility issue: canonical bytes use supported base64 conversion rather than Node-only base64url encoding. No dependency change was needed.
- `git diff --check` passed. No database exercise was required because this slice changes no SQL, migration, or database contract.

## Watcher / PR checkpoint

Read-only inspection confirmed PR #68 remains open at `47a332251f567f070d84e439f985e7d05a7a0f42`. App Security, CodeQL, ZAP, both native compile/simulator pairs, the push Android-emulator and hosted-integration checks, and Vercel API/web checks passed. Both Supabase live-security jobs and GitGuardian remain failed. The corresponding pull-request emulator/hosted-integration jobs were skipped. The existing watcher is ACTIVE; its latest inspected turn was interrupted/idle. Its branch/worktree were not modified.

The direct staging `/health` request returned a 302 deployment-protection redirect. This session did not bypass protection or claim a fresh healthy/concealment smoke result. Existing handoff smoke evidence remains historical.

## Open boundaries

This is not a complete production native journey. The injected HTTP adapter must provide bounded response streams; native runtime compatibility is unverified and absent streams fail closed. The caller supplies pre-provisioned synthetic public record material; no production record discovery or distribution path is added. Cancellation suppresses results and waits for ongoing producer cleanup; JavaScript input strings are not claimed to be zeroizable. No persistence/reload recovery is introduced.

No production KDF selection, EAS build, physical-device execution, native binding, trusted-edge adapter, post-possession claim binding, migration, hosted database/Auth/Storage mutation, provider action, deployment, push, PR publication, real claimant data, or external activation occurred. Existing `.codex-runtime/` and `.playwright-cli/` contents were not inspected or changed.
