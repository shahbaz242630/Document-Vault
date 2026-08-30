# Claimant Slice 5D — offline-code V2 proof verification and attempt coordination

Date: 2026-08-30 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-proof-attempt-coordinator`

Starting checkpoint: `81e1fca` (`Record hosted claimant migration verification`)

## Result

Slice 5D adds an immutable-false, unmounted server coordinator that verifies the exact offline-code V2 Ed25519 possession transcript and records the bounded attempt through the existing Slice 5B service-only transaction.

The coordinator accepts only the canonical V2 challenge bytes, strict challenge and possession-proof objects, and one UUIDv4 idempotency key. It fixes locator version 2 and proof-key version 1, cross-binds every proof identifier and digest to the challenge, reconstructs the frozen domain-separated canonical message, verifies the detached Ed25519 signature, and hashes only the public challenge/signature evidence passed to persistence.

A verified proof asserts only `route_possession_only`. It never asserts identity, creates a claim, authorizes release, exposes wrapped material, or returns private/internal state. Invalid signatures and cross-binding substitutions consume the existing bounded attempt when a real challenge exists. An invalid proof against an unavailable/synthetic challenge returns the same safe rejection even when no persistence row exists.

The approval constant remains literal `false`; the API entrypoint does not import or mount the coordinator. No migration, hosted database/Auth/Storage/provider change, route, client/native integration, production KDF approval, deployment, real data, notification, claim binding, evidence access, or external behavior was added.

## Verification

- Focused Slice 5A-5D API tests: 15 passed.
- New coordinator tests: 5 passed, covering immutable-false short-circuiting, exact Ed25519 verification, cross-binding and signature rejection, unavailable-record indistinguishability, strict V1/extra/canonical-byte rejection, and unsafe persistence output.
- All workspaces: 1,123 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks passed.
- Root lint passed with zero warnings.
- The unchanged 24-page production web build passed.
- API Vercel bundle, repository security, GitHub Actions security, claim-vector, custody, and Slice 5A-5D isolation checks passed.
- `git diff --check` passed.
- The optional local Slice 5B/5C database replay could not connect because Docker Desktop was not running. This slice changes no SQL or database contract. The previously recorded hosted rollback evidence through Slice 5C remains the database baseline; no hosted test or mutation was attempted for Slice 5D.

## Open boundary

No public proof route, controller/CORS/origin boundary, distributed edge limiter, client/native proof producer, representative KDF benchmark, protocol specialist approval, identity decision, claim creation, evidence access, release authority, or external activation exists.

Any route/controller work requires a separate reviewed authorization. It must keep the Slice 5C challenge response indistinguishable, conceal disabled requests, treat possession as route authority only, preserve bounded attempts and generic failures, and remain independent of identity, claim, evidence, and release decisions.
