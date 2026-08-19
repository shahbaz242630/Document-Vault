# Claimant Slice 5C — enumeration-resistant offline-code V2 challenges

Date: 2026-08-19 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-challenge-coordinator`

Starting checkpoint: `2067b4e` (`Add offline-code V2 persistence foundation`)

## Outcome

Slice 5C adds an immutable-false, unmounted server coordinator for issuing V2 offline-code challenges without disclosing whether a locator is active, unknown, expired, revoked, or locked.

- The coordinator accepts only a normalized V2 public locator, server-bound network/device signals, and an idempotency key. An injected boundary indexer converts those values into keyed, fixed-length digests; raw locator and abuse signals do not cross into persistence or logs.
- The database consumes global, network, device, and locator fixed-window budgets before record lookup. Rate state is forced-RLS, service-only, and digest-only.
- Active and unavailable records return the exact same public challenge and KDF schema. Unavailable records receive fresh synthetic material; no record-found, locator-found, or synthetic marker exists.
- The database atomically generates the challenge ID, nonce, timestamps, canonical challenge bytes, and SHA-256 digest. Only valid active-record challenges and value-free issue events persist.
- Known and synthetic requests use the same derived opaque idempotency scope and stable replay behavior. Revoked records immediately fall back to the indistinguishable synthetic path.
- Slice 5B registration now requires a per-record 128-bit KDF salt. Pre-existing rows without one fail closed into the synthetic path.
- Every response fixes identity verification, claim creation, and release authorization false. Challenge authority remains `route_possession_only`.
- `CLAIMANT_OFFLINE_CODE_V2_CHALLENGE_COORDINATOR_APPROVED` is literal `false`; the coordinator is not exported, mounted, routed, deployed, or connected to Supabase/network/environment adapters.

Supabase API-security, database-function, and 2026 platform changelog guidance was reviewed for separate grants/RLS, explicit client denial, security-invoker functions, execute revocation, and server-side rate controls. The migration was created with Supabase CLI 2.110.0. No hosted project was modified.

## Verification

- Focused API suite: 10 passed across the transaction client, persistence service, and challenge coordinator.
- Workspace suites: 1,118 passed; 3 established environment-gated mobile tests skipped.
- Serial static/security regressions: 216 passed, including six new migration/isolation checks registered in Security CI.
- Fresh PostgreSQL 16 test passed in a disposable local container. It covered known/unknown schema equivalence, canonical bytes/digest, stable known/synthetic replay, non-persistence of synthetic facts, revoked fallback, sixth-attempt locator throttling, and authenticated-role table/RPC denial. The container was removed afterward.
- All workspace typechecks, zero-warning lint, GitHub Actions security validation, the unchanged 24-page production web build, shared runtime build, API Vercel bundle, and challenge/protocol/persistence isolation checks passed.
- The prior Slice 5B preview deployment remained the only staging action: deployment `dpl_28meXvLFMTXXxGJJ149knZ6JzwjM` was READY and its 24 pages/routes passed smoke and log review. Slice 5C itself was not deployed because it is unmounted. Production remained untouched.

## Remaining gates

No proof-verification/attempt coordinator, public API route, client/native integration, production KDF approval, distributed edge limiter, timing-distribution review, hosted migration, deployment, identity decision, claim creation, evidence access, or release authority exists.

The next bounded slice should add the unmounted proof-verification and attempt coordinator while preserving indistinguishable challenge behavior, exact transcript binding, bounded attempts, possession-only authority, V1 rejection, immutable-false approval, and zero claim/release implication. Route mounting and external activation require separate authorization.
