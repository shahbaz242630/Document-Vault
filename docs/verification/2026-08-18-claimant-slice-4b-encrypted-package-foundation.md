# Claimant Slice 4B — encrypted package foundation

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-encrypted-package-foundation`

Starting checkpoint: `f4dcdaf` (`Add claimant release authorization foundation`)

## Outcome

Slice 4B adds an immutable-false, unmounted, service-only encrypted-package preparation boundary using synthetic identities and existing client-sealed vault material.

- Five forced-RLS tables persist an immutable package header, exact ciphertext/nonce asset snapshots, exact current recipient-grant/key bindings, value-free events, and idempotency results with explicit client denial.
- One advisory-locked transaction revalidates the approved case and version, current final authorization, expired verified owner-protection cycle, two-person review aggregate, active synthetic non-live release authority, current policy, and absence of intervention.
- Every supplied asset is locked and matched against an active owner vault row by ID, type, ciphertext, nonce, and server-computed digest. The server copies the existing envelope without encryption, decryption, plaintext access, signed URLs, or provider behavior.
- The input must include every current active recipient grant. Each grant is locked and bound to its current claimant device key and key version, then matched by a digest over the complete sealed-grant envelope.
- The server computes an ordered preparation-manifest digest itself and persists a bounded 72-hour `prepared_unsigned` snapshot. It returns only aggregate identifiers, state, counts, and false authority booleans—never ciphertext, nonce, digest, party, asset, grant, or key detail.
- The case remains `approved` at version 6. Manifest signing and retrieval authorization remain explicitly false, and the API approval literal is immutable false with no mounted route.

No server encryption/decryption, HTTP route, UI, retrieval session, signed URL, native behavior, provider, hosted migration, deployment, real data, or external behavior was added.

## Verification

- Standalone PostgreSQL 16 rollback coverage passed against the already-cached generic `postgres:16-alpine` image. It covered wrong-owner authority, ciphertext tampering, revoked-grant rollback, intervention rollback, duplicate input, stable and changed replay, exact atomic row counts, copied ciphertext equality, unchanged case state/version, and authenticated table/RPC denial.
- The exact temporary container `sanduqkin-slice4b-postgres` was removed after testing. No Supabase image was downloaded or started, and hosted Supabase was not contacted or changed.
- Workspace tests: 1,033 passed; 3 established environment-gated mobile tests skipped.
- Encrypted-package API tests: 6 passed.
- Full static/security regressions: 155 passed serially.
- All workspace typechecks and zero-warning lint passed.
- Production web build passed with 24 static pages.
- API Vercel bundle, claimant custody isolation, dedicated encrypted-package isolation, GitHub Actions workflow guards, and `git diff --check` passed.

## Remaining gates

The encrypted-package service approval remains immutable false and unmounted. The package is unsigned and cannot be retrieved. The next bounded slice is Phase 4 Slice 4C: a separately controlled synthetic signing authority and signed-manifest/package-finalization transaction bound to the exact immutable Slice 4B preparation digest. It must keep retrieval false and add no provider, hosted migration, native opening/export, deployment, real data, or external behavior.
