# Claimant Slice 5J — offline-code V2 mobile lifecycle composition

Date: 2026-08-31 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-mobile-lifecycle`

Starting checkpoint: `60a8601` (`Add disabled offline-code V2 mobile coordinator`).

## Outcome

The new isolated lifecycle root composes the existing transport/coordinator with an injected proof producer and synthetic lifecycle source. Both runtime approval and production-runtime preconditions fail closed. No dependency is read when the default approval is false.

Background/inactive transitions cancel work and clear pending retries. Foreground restoration requires an explicit new action, and an attempt-generation check rejects late success from a previous foreground period. Lock, session end, kill switch, malformed/stale lifecycle input, and disposal permanently close the instance. Disposal is idempotent and awaitable: it closes immediately, detaches once, and waits for ongoing producer/transport cleanup without exposing their values or errors.

The immutable snapshot contains only a status and false identity/claim/release flags. No proof, challenge, key, identifier, secret, error detail, or durable authorization is retained there. All actual normal-app and native bindings remain absent.

The existing 5I isolation guard now permits exactly this new root after invoking its separate lifecycle guard. New hostile mutation tests prove that enabling the root, deleting its safety checks, adding direct native/provider/storage/network behavior, or importing it from normal/probe/web/API/barrel paths fails the gate.

## Verification

- New lifecycle tests: 33 passed. All five offline-code mobile test files pass 94 tests, including actual frozen proof production through the composed transport.
- All workspaces: 1,228 tests passed, with 3 established environment-gated mobile skips (mobile 581, web 171, shared types 131, shared validation 42, API 303).
- Full serial static/security suite: 234 passed, including 3 new lifecycle mutation tests and the prior 5I guard tests with the exact composition exception.
- All workspace typechecks and zero-warning root lint passed.
- Repository security, GitHub Actions security, mobile secret scanning, deterministic claim vectors, vector/custody isolation, and offline-code lifecycle isolation passed.
- Unchanged web build generated 24 static pages; API Vercel bundle guard passed.
- `git diff --check` passed. No database exercise was required because this slice changes no SQL, migration, or database contract.

## PR and watcher checkpoint

Read-only PR #68 inspection still shows open head `47a332251f567f070d84e439f985e7d05a7a0f42`. Native compile/simulator, push Android-emulator/hosted-integration, App Security, CodeQL, ZAP, and Vercel checks remain passed. Both Supabase live-security jobs and GitGuardian remain failed; no remediation or suppression was performed on this branch.

The earlier watcher's local `automation.toml` is now absent; the automation view tool rendered a card but returned no model-readable active status. Active monitoring cannot be confirmed. The owner was informed, and this session did not recreate or alter the automation. No fresh preview smoke result is claimed.

## Limitations and external state

All tests use injected local synthetic adapters; there is no physical-device/native lifecycle evidence or hosted end-to-end journey. Bounded native response streaming and actual lifecycle-source wiring remain unimplemented. A source must synchronously deliver initial state and roll back a partial subscription if it throws. Disposal cannot force a hung producer to finish; the scope stays closed and no new attempt is admitted. JavaScript strings are not claimed to be zeroizable.

No SQL/migration/database contract changed. No EAS build, device run, production KDF approval, native binding, provider/DNS/Auth/Storage change, trusted-edge adapter, post-possession binding, push, PR publication, deployment, production promotion, real claimant data, or external activation occurred. The unrelated `.codex-runtime/` and `.playwright-cli/` contents remain untouched.
