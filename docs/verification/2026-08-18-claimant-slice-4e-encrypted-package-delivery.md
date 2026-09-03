# Claimant Slice 4E — encrypted-package delivery

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-encrypted-package-delivery`

Starting checkpoint: `f0195fe` (`Add claimant retrieval session foundation`)

## Outcome

Slice 4E adds an immutable-false, unmounted, service-only encrypted-package delivery transaction and coordinator using synthetic records and an injected delivery adapter.

- Three forced-RLS tables persist one delivery, append-only value-free events, and safe idempotency results with explicit client denial and indexed foreign-key/query paths.
- Preparation consumes one exact unexpired Slice 4D authorization and revalidates its active portal session/version, AAL2, claimant eligibility/identity, release-ready case/version, finalization, package, signed manifest, selected grant, recipient key, signing key, and absence of intervention.
- The prepared payload contains only the frozen encrypted asset envelopes, claimant-addressed encrypted grant material, and signed canonical manifest. Its exact serialized bytes, SHA-256 digest, identifiers, and short lease are transaction-bound.
- A first attempt may dispatch once through an injected adapter. Every attempt, including ambiguous retry, uses lookup as the sole complete-delivery authority; replays never redispatch.
- Commit accepts only a verified exact digest/byte receipt completed inside both the delivery lease and retrieval-session expiry. Unknown, failed, malformed, mismatched, late, or ambiguous outcomes fail closed for reconciliation.
- Only the first verified delivery advances `release_ready` to `released` and increments the case version once. The delivery and Slice 4D session then record `package_served`; `retrieval_completed` remains false because delivery does not prove native opening.

No browser plaintext, server encryption/decryption, bearer delivery token, public/signed URL, Storage download, HTTP route, UI, notification, native opening/export, hosted migration, deployment, real data, or external behavior was added.

## Verification

- Standalone PostgreSQL 16 rollback coverage passed against the already-cached generic `postgres:16-alpine` image. It covered expired authorization, revoked grant, open intervention, exact ciphertext payload digest/byte binding, stable preparation replay, hostile receipt rejection, stable commit replay, one case transition/version increment, served/session/event/idempotency records, and authenticated table/RPC denial.
- The exact temporary container `sandoq-claimant-4e-db-test` was removed after every run. No Supabase image was downloaded or started, and hosted Supabase was not contacted or changed.
- Workspace tests: 1,051 passed; 3 established environment-gated mobile tests skipped. The new transaction/coordinator suite contributes 8 passing tests.
- Full static/security regressions: 170 passed serially, including 6 dedicated migration/isolation checks.
- All workspace typechecks and zero-warning lint passed.
- The migration defect caused by PostgreSQL identifier truncation was caught by the standalone harness and repaired with catalog-resolved single-column constraint drops.

## Remaining gates

The delivery approval remains immutable false and unmounted. The adapter is injected and has no provider, route, or production wiring. A served encrypted package is not an opened, exported, claimant-confirmed, completed, or closed retrieval.

The next bounded slice is Phase 4 Slice 4F: an immutable-false, runtime-disconnected mobile encrypted-package custody/open coordinator. It must verify the exact delivered payload and signed manifest, use only an injected production-shaped native custody adapter for claimant-device decryption, and record local open separately from delivery. Actual production Swift methods, aliases, entitlements, direct native binding, build/device evidence, export, hosted migration, deployment, real data, and external behavior remain separate gates.
