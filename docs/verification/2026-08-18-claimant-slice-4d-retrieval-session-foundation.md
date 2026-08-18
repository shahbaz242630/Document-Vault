# Claimant Slice 4D — retrieval-session authorization foundation

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-retrieval-session-foundation`

Starting checkpoint: `ef97a64` (`Add claimant signed manifest foundation`)

## Outcome

Slice 4D adds an immutable-false, unmounted, service-only retrieval-session authorization boundary using synthetic identities and records.

- Three forced-RLS tables persist short-lived single-purpose authorization records, value-free events, and safe idempotency results with explicit client denial.
- The unmounted service verifies the Supabase bearer identity and `session_id`, derives the claimant actor server-side, and reuses the existing fresh-AAL2 policy. AAL1, recovery, stale/future MFA, expired tokens, malformed input, and unverified sessions fail closed.
- One advisory-locked transaction requires the exact active claimant portal session, matching fresh authentication timestamp, eligible active claimant identity, and current `release_ready` case/version.
- The transaction binds the authorization to the exact current finalization, immutable package, selected signed manifest, package grant, active source grant, active claimant device/case key and recipient key version. Open interventions and compromised signing keys fail closed.
- Each record has the sole purpose `single_package_retrieval`, status `authorized_unserved`, and an expiry no later than 15 minutes or the package/finalization expiry, whichever comes first.
- Session authorization is not a bearer secret. The UUID is an identifier that remains dependent on the active portal context and will require a later serving transaction to revalidate and consume it.
- The case remains `release_ready` at the same version. Package serving authorization, package served, and retrieval completed are immutable false; no `released` transition exists in this slice.

No package bytes, ciphertext, nonce, manifest, signature, public key, token, signed URL, Storage access, HTTP route, UI, notification, decryption, native behavior, hosted migration, deployment, real data, or external behavior was added.

## Verification

- Standalone PostgreSQL 16 rollback coverage passed against the already-cached generic `postgres:16-alpine` image. It covered wrong portal session, stale assurance, compromised signing key, revoked grant, open intervention, stable/changed replay, exact session/event/idempotency counts, fixed case state/version, immutable serving/completion denial, and authenticated table/RPC denial.
- The exact temporary container `sandoq-claimant-4d-db-test` was removed after each run. No Supabase image was downloaded or started, and hosted Supabase was not contacted or changed.
- Workspace tests: 1,043 passed; 3 established environment-gated mobile tests skipped.
- Retrieval-session API tests: 5 passed; complete API suite: 242 passed.
- Full static/security regressions: 170 passed serially.
- All workspace typechecks and zero-warning lint passed.
- Production web build passed with 24 generated pages.
- API Vercel bundle, claimant custody isolation, dedicated retrieval-session isolation, GitHub Actions workflow guards, and `git diff --check` passed.

The live-catalog `check:supabase-db-security` command was unavailable because no local Supabase stack was running, so it is not counted as slice evidence; this slice did not download or start Supabase images. The standalone rollback harness exercised the new migration and hostile database paths directly.

## Remaining gates

The retrieval-session service approval remains immutable false and unmounted. The authorization record cannot serve or expose the encrypted package and cannot advance the case. The next bounded slice is Phase 4 Slice 4E: an immutable-false, unmounted encrypted-package delivery transaction/coordinator that consumes one exact unexpired authorization, proves complete ciphertext delivery before recording `package_served`, and advances `release_ready` to `released` only on that first successful delivery. It must add no browser plaintext, server decryption, signed public URL, native opening/export, hosted migration, deployment, real data, or external behavior.
