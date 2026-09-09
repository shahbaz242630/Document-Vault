# Slice 5P — mobile authenticated handoff client verification

Date: 2026-09-05 (Asia/Dubai)

Baseline: PR #72 merge `96e41e0`, refreshed from origin before creating `codex/claimant-offline-code-v2-handoff-client`. PR #71 is already merged at `201f079`. Existing local handoff edits were preserved and reconciled with this newer baseline.

## Delivered boundary

- Separate literal-false mobile transport and coordinator; no normal app importer, default network/auth adapter, persistent storage, production crypto or native signer.
- Strict handoff envelopes and session consistency validation; exact transcript domain, account/session/version, source challenge, record binding, handoff ID and expiry validation before signing the unchanged bytes.
- Fixed API paths, header-only bearer, strict allowlisted body, omitted credentials, rejected redirects, protected response headers, bounded streamed JSON and timeouts.
- Completion is a server-selected draft case with identity, relationship, intake, review and release false. Client metadata grants no server authority.
- Up to three identical completion sends after ambiguous delivery, with a freshly acquired token and unchanged account/session/version. No signature regeneration on retry. Clear pending state on success, cancellation, expiry, changed session, terminal failure and exhaustion; ignore late results and reject overlapping attempts.
- Static guard plus CI regression tests prohibit activation, ambient network/storage/native adapters and production importers.

## Local evidence

- Merged baseline: 13 focused server route/service/controller tests passed before implementation.
- Full workspace suite: 1,349 passed and 3 established mobile skips; a subsequently added account-change regression also passed in the focused rerun.
- Final focused mobile handoff suite: 66 passed. API mobile-to-Hono integration: 4 passed with real Ed25519 signatures, real route/service/RPC adapter, deterministic synthetic RPC responses, lost-response replay, wrong-account rejection and old-domain signature rejection.
- New and adjacent static isolation regressions: 7 passed.
- Phase 1, repository security, GitHub Actions security, mobile-secret scan, existing client-coordinator and server handoff isolation, and production dependency audit passed. The existing patched image-size exception remains bounded through 2026-09-30.
- All workspace typechecks and root ESLint passed with zero warnings. ESLint excluded only generated `supabase/.temp/**` and the protected unrelated `.codex-runtime/**` and `.playwright-cli/**` at invocation. `git diff --check` passed.

## Limits and delivery

The integration test uses an injected synthetic RPC implementation; it is not a new live PostgreSQL acceptance claim. Schema and server implementation are unchanged from the merged baseline. Production custody/secret reacquisition, native signing, foreground/background lifecycle composition and UI remain separate work. Cancellation after a server commit cannot undo that commit; discard the local result and rely on the existing server binding/idempotency behavior, never infer intake or release.

No hosted database/Auth/Storage mutation, production deployment/promotion, native/EAS build, real claimant data, capability activation or downstream authority was added. Protected local directories were not inspected or staged.

The owner requests watcher-based delivery: watch the exact PR head and required checks plus protected preview smoke/logs, report green/red only when actionable, repair focused failures and re-evaluate. Pending is not green. Never weaken checks or preview protection; do not merge without staging evidence. On confirmed green, merge with a merge commit without deleting the branch, verify ancestry, report completion and retire the watcher. Do not start another engineering slice automatically.
