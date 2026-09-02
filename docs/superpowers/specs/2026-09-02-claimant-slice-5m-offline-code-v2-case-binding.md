# Claimant Slice 5M — offline-code V2 post-possession case binding

Date: 2026-09-02 (Asia/Dubai)

Status: authorized for bounded local engineering with synthetic data. Runtime activation, hosted mutation, deployment, native production binding, and real claimant data remain unauthorized.

## Outcome

Add one service-only, immutable-false transaction that converts a recently verified offline-code V2 challenge into one `draft` claimant case bound to the authenticated claimant-portal context. The transaction derives the owner and route material from the locked locator row. The caller cannot choose an owner, route profile, locator version, proof-key version, or release authority.

The transaction records a pending claimant identity when needed, then creates the case atomically with the exact locator, challenge, record-binding digest, claimant account, active portal session, session version, and synthetic policy version. A locator and verified challenge may bind only once. Stable idempotent replay returns the original safe result.

## Required controls

- Require an active synthetic claimant-portal eligibility and the exact active `aal2` portal session.
- Require authentication no older than ten minutes and a verified challenge no older than five minutes.
- Lock and recheck the locator, challenge, portal session, claimant identity, idempotency record, and resulting case in one database transaction.
- Require an active, unexpired V2 locator and exact locator/challenge/version/proof-key/record-digest coherence.
- Reject owner self-binding, cross-account replay, changed idempotency input, stale or displaced sessions, expired/revoked locators, non-verified challenges, and concurrent second binding.
- Keep the route profile `offline_code_v2`, the case state `draft`, and the claimant identity `pending` unless an already active claimant identity exists.
- Store only approved identifiers, versions, safe timestamps, the public record-binding digest, and synthetic policy facts. Store no locator, client secret, KDF root, proof private key, wrap key, plaintext MEK, token, or evidence.
- Return `case_created: true` while explicitly returning `identity_verified: false`, `relationship_verified: false`, `intake_started: false`, `review_started: false`, and `release_authorized: false`.

## Acceptance

- Focused service and transaction-client tests reject malformed inputs, extra fields, incoherent results, and changed bindings.
- Static migration and isolation guards prove literal-false approval, no API mount, forced RLS, service-only execution, route-specific case integrity, and prohibited-material absence.
- Disposable database tests cover success, stable replay, changed-input rejection, stale/displaced session denial, cross-account and owner-self denial, invalid/expired/revoked proof authority, concurrency, anonymous/authenticated RLS and RPC denial, and exact possession-only output.
- Full typecheck, lint, phase/security, workspace, and serial script regressions pass after the PR #68 baseline is integrated.

## Non-goals

No claimant endpoint, UI, notification, upload, intake transition, identity decision, relationship decision, review, package, retrieval, native production adapter, KDF approval, trusted-edge provider, hosted migration, deployment, or external capability is added. Slice 5M does not make code possession sufficient for release and does not change any existing runtime approval from literal `false`.
