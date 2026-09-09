# Slice 5P — mobile authenticated handoff client

Authorized on 2026-09-05 for bounded synthetic engineering. Baseline: PR #72 merge `96e41e0` (Slice 5O), following PR #71 (5N). Earlier handoff snapshots describing PR #71 as blocked are historical.

Add a separate, literal-false mobile transport and coordinator for the existing handoff issue/completion routes. Dependencies are injected; no normal app importer, ambient network/authentication adapter, native signer, or persistent storage is introduced.

The coordinator takes a synthetic source challenge and record binding, obtains the current claimant-portal session, validates the server transcript's domain, account/session/version, source, record binding, handoff ID and two-minute expiry, and passes its exact opaque bytes to an injected synthetic signer. Local session checks are consistency checks, never server authority. The bearer travels only in the Authorization header; client-selected account/session/case authority is absent from request bodies.

Completion exposes only the server's strict draft-case result. Identity, relationship, intake, review and release remain false. An ambiguous completion may retry the identical signature, handoff ID and idempotency key up to three sends within the original expiry and unchanged session binding. Reacquire the token for each send. Clear pending state on success, cancellation, expiry, session change, terminal failure or retry exhaustion. Discard late results after cancellation; reject concurrent attempts and clock rollback.

Acceptance: hostile transport/header/envelope and streaming bounds, cross-account/session/source/domain transcript rejection before signing, exact-byte signing, real Ed25519 client-to-Hono integration, bounded retry, stale/recovery/expired assurance, cancellation and late-result tests, static isolation and proportional regression/security gates.

No schema changes, hosted mutation, production deployment, capability activation, native builds, production key retention, UI integration, real data or downstream intake/release behavior. Production custody and lifecycle composition remain separate slices.

Delivery uses a watcher for exact-head PR checks and preview logs. Green permits progression; red requires a focused repair and watcher re-evaluation. Pending is neither green nor red. Do not weaken checks or preview protection.
