# Claimant Slice 5A — safe V2 offline-code protocol foundation

Date: 2026-08-19 (Asia/Dubai)

Branch: `codex/claimant-offline-code-v2-protocol`

Starting checkpoint: `49ee8a8` (`Add claimant retrieval lifecycle closure`)

## Outcome

Slice 5A replaces the earlier broad synthetic offline-code fixture with a closed, hard-disabled, runtime-disconnected safe V2 shared protocol foundation.

- A 128-bit non-secret public locator and a separate 192-bit client-held secret use exact uppercase Crockford Base32 grouping and checksums. V1 prefixes, weak/short values, ambiguous casing, malformed grouping, invalid checksums, and non-canonical padding fail closed.
- Every cryptographic use has an exact V2 purpose label. The client-secret root uses synthetic-only Argon2id parameters; proof-seed and MEK-wrap keys use separate HKDF-SHA256 contexts and cannot be substituted for each other.
- The server locator index is an HMAC-SHA256 keyed digest. A separate public locator commitment binds the locator, internal random locator-record UUIDv4, and locator version without treating the locator as authority.
- One canonical record binding covers the locator record/version/commitment, grant, owner, synthetic KDF profile, proof-key version, and derived Ed25519 proof public key. The challenge, proof, and wrapped-MEK envelope repeat the required safe bindings and reject cross-record, cross-version, cross-grant, cross-owner, KDF, proof-key, and digest substitution.
- Challenges are exact canonical objects with one five-minute window, an exact HTTPS origin, 32-byte nonce, and immutable `route_possession_only` authority. The domain-separated proof signature establishes route possession only; it does not establish identity, entitlement, approval, release, or retrieval.
- The MEK remains encrypted with XChaCha20-Poly1305 under a separately derived wrap key and canonical associated data. Synthetic vectors reproduce the root, locator index, proof key/signature, wrap key, ciphertext, and unwrap result, and fail after hostile message, context, binding, signature, or ciphertext mutations.
- `OFFLINE_CODE_V2_PROTOCOL_APPROVED` is literal `false`. A new CI isolation guard rejects runtime/network/storage/provider primitives inside the shared module and rejects imports of the new protocol-only symbols by normal mobile, web, or API production sources.

No persistence, migration, lookup or API route, claimant discovery/enumeration, UI, browser/server plaintext, server decryption, public or signed URL, production native binding, real data, deployment, or external behavior was added. The synthetic client secret, private proof key, root, and wrap key exist only in the deterministic test vector.

## Verification

- New shared hostile tests: 4 passed. They cover immutable-false approval, locator/secret separation and entropy, V1 and locator-only rejection, malformed/checksum/casing/grouping failures, exact challenge timing, prohibited extra authority, synthetic-only KDF pinning, and cross-object substitution.
- Updated reference-vector tests independently reproduce the Argon2id root, HMAC locator index, separately context-bound HKDF proof/wrap keys, Ed25519 proof, XChaCha20-Poly1305 unwrap, and hostile context/AAD/ciphertext failures.
- Workspace tests: 1,108 passed; 3 established environment-gated mobile tests skipped.
- Full static/security regressions: 210 passed serially, including the new immutable-false/runtime-disconnection guard.
- All workspace typechecks, zero-warning lint, the unchanged 24-page production web build, shared runtime build, API bundle, claim-vector reproducibility/isolation, claimant custody isolation, repository/GitHub Actions security, and `git diff --check` passed.
- No database or container was required. Hosted Supabase, Vercel, Apple/EAS, providers, configuration, and production state were untouched.

## Remaining gates

The Argon2id profile is deliberately synthetic-only and not production approved. Production parameters still require representative device benchmarks and security review. The protocol has no persistence, challenge service, lookup behavior, enumeration resistance evidence, throttling, attempt control, expiry/revocation state, client integration, native custody, or external activation.

Before any stateful Slice 5B work, retain V1 rejection, literal-false approval, the split-secret boundary, exact route-possession-only authority, and the prohibitions above. A proposed next bounded slice is a default-deny, service-only locator-record/challenge persistence foundation with keyed locator indexes, expiry/revocation, replay and attempt state, but no mounted route or external behavior; it requires separate owner authorization.
