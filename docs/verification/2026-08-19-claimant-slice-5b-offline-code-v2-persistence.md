# Claimant Slice 5B — offline-code V2 persistence foundation

Date: 2026-08-19 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-persistence`

Starting checkpoint: `d6cb3d2` (`Add safe V2 offline-code protocol foundation`)

## Outcome

Slice 5B adds a default-deny, service-only persistence foundation for the hard-disabled V2 offline-code protocol.

- Five forced-RLS tables store synthetic locator records, five-minute challenges, append-only proof-attempt facts, value-free events, and idempotency results. Client roles receive explicit deny-all policies and no table or function authority.
- Locator lookup state contains only a keyed HMAC index digest. Records retain the public commitment, exact V2/proof-key versions, synthetic-only KDF profile, public proof key, record-binding digest, and wrapped-MEK ciphertext envelope. Raw locators, client secrets, private proof keys, roots, wrap keys, and plaintext MEKs are never persisted.
- Four `security invoker` service-role transactions register a synthetic record, issue a challenge by keyed locator digest, record an already externally verified proof outcome, and revoke the record. Registration, challenge issue, proof facts, lockout, revocation, events, and replay results are atomic.
- Challenge issue uses one generic unavailable error for unknown, expired, revoked, locked, or binding-mismatched records. Only one issued challenge remains open per locator, challenge expiry is exactly five minutes, and idempotent replay remains stable after later terminal state.
- Invalid proofs accumulate in a fifteen-minute window. Five failures lock the locator for fifteen minutes; a verified proof resets the failure state. Persisted signatures are digests only.
- A verified proof asserts only `route_possession_only`. Every result fixes identity verification, claim creation, and release authorization false. Revocation prevents future challenge issue and terminates an open challenge.
- `CLAIMANT_OFFLINE_CODE_V2_PERSISTENCE_APPROVED` is literal `false`. The service and injected transaction client are not exported or mounted, make no network call, and have no route, UI, discovery response, Supabase client, environment lookup, provider, or storage coupling.

The Supabase guidance reviewed for this slice supports explicit RLS on SQL-created exposed-schema tables, separate grants and RLS, invoker functions by default, and explicit function execution revocation. The migration was created with Supabase CLI 2.110.0. No hosted project was linked or modified.

## Verification

- New API tests: 5 passed. They cover all four exact RPC mappings, strict server-owned inputs/results, immutable-false behavior, V1 and prohibited-material rejection, binding checks, and rejection of unsafe or incoherent authority.
- New migration/isolation regressions: 6 passed and are registered in Security CI.
- Fresh PostgreSQL 16 integration test passed in a disposable local container. It covers exact registration and replay, five-minute challenge/replay, generic unknown-versus-locked errors, five-failure lockout, verified possession-only output, attempt replay, revocation, replay after revocation, atomic fact counts, value-free event metadata, and authenticated-role table/RPC denial. The container was removed after the test.
- Workspace tests: 1,113 passed; 3 established environment-gated mobile tests skipped.
- Full static/security regressions: 210 passed serially after the repository security guard was satisfied.
- All workspace typechecks, zero-warning lint, the unchanged 24-page production web build, shared runtime build, API bundle, claim-vector reproducibility/isolation, claimant custody isolation, persistence isolation, and `git diff --check` passed.
- Hosted Supabase, Vercel, Apple/EAS, providers, configuration, production state, real data, deployment, and external runtime were untouched.

## Remaining gates

The persisted KDF identifier is still synthetic-only and not production approved. No public lookup/controller/API route, claimant discovery response, distributed edge throttling, client integration, native custody binding, claim/case creation, evidence access, hosted migration, deployment, or activation exists.

Stop for owner review before a further slice. Any later offline-code controller or lookup boundary must preserve the generic unavailable response, server-owned keyed index, split-secret proof, V1 rejection, bounded attempts, possession-only authority, immutable-false approval, and no claim or release implication.
