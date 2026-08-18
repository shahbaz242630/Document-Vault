# Claimant Slice 4C — signed manifest foundation

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-signed-manifest-foundation`

Starting checkpoint: `8d9d195` (`Add claimant encrypted package foundation`)

## Outcome

Slice 4C adds an immutable-false, unmounted, service-only signed-manifest and package-finalization boundary using synthetic identities and signing keys.

- Six forced-RLS tables persist separate signing authorities, versioned Ed25519 public keys, immutable finalizations, exact canonical signed manifests, value-free events, and idempotency results with explicit client denial.
- The service accepts only the frozen `sanduqkin:claim:release-package:v1` contract, canonicalizes it with the shared implementation, verifies each detached Ed25519 signature with a separately resolved active synthetic public key, and passes only verified canonical bytes and digests to persistence.
- One manifest is required for every 4B package grant in exact ordinal order. This preserves the reviewed single-grant release-manifest shape while cryptographically covering every current recipient device grant and the common ordered ciphertext snapshot.
- One advisory-locked transaction revalidates the approved case/version, current final authorization, expired verified owner-protection cycle, two-person review, active synthetic non-live release authority, no intervention, unexpired immutable 4B package, unchanged owner vault envelopes, and every current grant/key version.
- The signing authority must be active, synthetic-only, non-live, distinct from the owner, claimant, release authorizer, reviewers, and resolution authorities. The signing key must be active, in its validity window, Ed25519, version-matched, and digest-matched to its stored public key.
- The database validates every canonical manifest field against server-owned state, including case/package/party/version, cycle number, timestamps, policy version, signing-key reference, ordered ciphertext digests, and exact device-specific grant digest. It binds the immutable 4B preparation digest into the signed-manifest-set finalization digest.
- The sole case transition is `approved` to `release_ready` with one version increment. The immutable finalization marks manifests signed while retrieval authorization remains explicitly false.

PostgreSQL does not provide a suitable built-in Ed25519 verifier, and current Supabase guidance marks `pgsodium` pending deprecation. Signature verification therefore remains in the hard-disabled server service using Node's native cryptography, while PostgreSQL independently enforces all state, authority, version, digest, membership, ordering, expiry, and idempotency predicates.

No private signing key, KMS/HSM provider, HTTP route, UI, package-serving path, retrieval session, signed URL, decryption, native behavior, hosted migration, deployment, real data, or external behavior was added.

## Verification

- Standalone PostgreSQL 16 rollback coverage passed against the already-cached generic `postgres:16-alpine` image. It covered owner/signer overlap, compromised signing key, reordered manifests, changed owner ciphertext, open intervention, stable/changed replay, exact finalization/manifest/event counts, the single case transition, retrieval denial, and authenticated table/RPC denial.
- The exact temporary container `sanduqkin-slice4c-postgres` was removed after testing. No Supabase image was downloaded or started, and hosted Supabase was not contacted or changed.
- Workspace tests: 1,038 passed; 3 established environment-gated mobile tests skipped.
- Signed-manifest API tests: 5 passed.
- Full static/security regressions: 163 passed serially.
- All workspace typechecks and zero-warning lint passed.
- Production web build passed with 24 static pages.
- API Vercel bundle, claimant custody isolation, dedicated signed-manifest isolation, GitHub Actions workflow guards, and `git diff --check` passed.

## Remaining gates

The signed-manifest service approval remains immutable false and unmounted. The package is release-ready in persisted synthetic state but cannot be served or retrieved. The next bounded slice is Phase 4 Slice 4D: fresh-AAL2, active-claimant-context, short-lived single-purpose retrieval-session authorization bound to the exact current finalization and claimant key/grant. It must add no package-serving response, signed URL, decryption, native opening/export, provider, hosted migration, deployment, real data, or external behavior.
