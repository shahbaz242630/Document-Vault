# Claimant Slice 5E — offline-code V2 HTTP controller

Date: 2026-08-30 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-controller`

Starting checkpoint: `49d892a` (`Add offline-code V2 proof attempt coordinator`)

## Result

Slice 5E mounts the offline-code V2 challenge and proof endpoints behind one immutable-false controller:

- `POST /claimant/offline-code/v2/challenges`
- `POST /claimant/offline-code/v2/challenges/:challengeId/proofs`

Normal application requests receive `404` before configuration, trusted-signal derivation, Supabase client creation, or coordinator access. The enabled synthetic test path requires the exact API and claimant HTTPS origins, JSON only, one strict UUIDv4 idempotency key, bounded actual and declared body size, exact operation-specific CORS preflight, and no `Authorization` or `Cookie` input. Responses are `no-store`, origin-varying, MIME-sniff protected, same-site resource protected, and referrer-free.

Challenge issuance accepts only the checksummed public V2 locator. Network and device signals cannot be supplied in the request body and are available only through an injected trusted-edge adapter. No default adapter trusts forwarded or client-selected headers; if the adapter is absent, the enabled test path fails before creating persistence. Separate 256-bit locator-index and rate-budget keys derive domain-separated HMAC-SHA256 locator, network, device, and global digests.

Proof verification cross-binds the UUIDv4 path challenge to the strict body challenge and delegates to Slice 5D. Invalid proofs for persisted and unavailable synthetic challenges return the same safe rejection. A verified result asserts only `route_possession_only`; identity, claim creation, evidence access, and release authorization remain false.

The default server persistence composition uses a non-persistent Supabase server client and the existing Slice 5B service-only RPC boundary. Current Supabase documentation review found no relevant breaking change to this design; security-invoker functions, explicit function grants, and combined grants/RLS remain the documented posture.

No migration, hosted database/Auth/Storage/provider change, trusted-edge adapter, browser/mobile client, production KDF approval, deployment, real data, notification, claim binding, evidence access, or external activation was added.

## Verification

- New controller tests: 8 passed.
- Focused Slice 5B-5E API tests: 20 passed.
- All workspaces: 1,131 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks passed.
- Root lint passed with zero warnings.
- The unchanged 24-page production web build passed.
- API Vercel bundle, repository security, GitHub Actions security, claim-vector, custody, and Slice 5A-5E isolation checks passed.
- `git diff --check` passed.
- Slice 5E changes no SQL or database contract. The hosted rollback evidence through Slice 5C remains the database baseline; no hosted test or mutation was attempted.

## Open boundary

The routes remain permanently concealed by the literal-false controller approval. The repository has no approved trusted-edge signal adapter, distributed edge limiter, browser/mobile client proof producer, representative-device Argon2id benchmark, production KDF profile, durable post-possession session/case binding, identity decision, claim creation, evidence access, release authority, deployment, or external activation.

Any client/native proof-production, KDF benchmark, trusted-edge adapter, or post-possession case-binding slice requires separate authorization and its own hostile evidence. Flipping the controller constant or enabling external traffic is not authorized.
