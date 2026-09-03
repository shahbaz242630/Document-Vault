# Claimant Slice 1I — Enrollment Attempt Persistence and Reconciliation

Date: 2026-08-12 (Asia/Dubai)

## Decision

Phase 2 Slice 1I is code-complete locally on `codex/claimant-enrollment-reconciliation`. It remains hard-disabled, runtime-disconnected, and unactivated. No hosted migration, deployment, Apple request, real claimant data, or external behavior was introduced.

## Implemented boundary

- The mobile attempt store validates a strict, bounded V1 record and encrypts it with XChaCha20-Poly1305 before device-only SecureStore persistence.
- The record contains only account and invitation bindings, a non-secret key-alias reference, all four idempotency keys, registration/App Attest/native challenge identifiers, request digests, phase, and expiry timestamps.
- Bearer tokens, recovery phrases, private keys, possession-proof plaintext, attestation/assertion objects, and client authority are prohibited.
- The coordinator durably records `key_created`, `challenge_issued`, `finalization_pending`, and `reconciliation_required`. It clears terminal state on authoritative completion.
- Pre-final process-death recovery deletes the new custody key and clears the attempt without contacting reconciliation.
- Final or ambiguous recovery asks the server before key deletion. `committed` preserves the key and clears state; `not_committed` deletes the key and clears state; `unknown` preserves both for later reconciliation.
- Cancellation before recovery preserves state and custody. Expiry does not permit local inference for a final attempt; the server remains authoritative.
- The reconciliation endpoint requires the current claimant portal session, fresh AAL2, exact origin/content type/body/idempotency constraints, and a separate forced-RLS throttle.
- The service-only database function serializes against final acceptance using the same advisory lock and row locks. A terminal `not_committed` decision expires both challenges before returning, closing the delayed-completion race. Stable committed replay returns the original atomic result.

## Fail-closed gates and limitations

- `CLAIMANT_NATIVE_ENROLLMENT_ATTEMPT_PERSISTENCE_APPROVED`, the Slice 1H coordinator approval, and the Slice 1G server route approval remain immutable `false`.
- Normal mobile routes do not import this boundary. Production App Attest/custody adapters remain a separate slice and the disposable probe aliases are not reused.
- Persisted state is non-authoritative and cannot itself prove a commit. Tamper, malformed state, oversize envelopes, and cross-account reuse are rejected.
- The implementation records exact request digests and idempotency keys but does not automatically replay a pre-final request; pre-final recovery cleans up and starts a new attempt. Only server-authoritative final reconciliation is implemented in this slice.
- Reinstall or loss of device-only storage can remove the local recovery record. The server challenge expires independently; this slice makes no claim that a deleted local key can be recovered.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 884 passed, 3 environment-gated mobile tests skipped.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed after the Slice 1I test-style correction.
- `npm run check:phase1`: passed.
- `npm run check:security`: passed.
- `npm run check:claim-custody-isolation`: passed.
- Focused mobile store/coordinator/transport: 19 passed.
- Focused API route/transaction client: 9 passed.
- Reconciliation migration plus database-security static tests: 5 passed.
- `npm run check:claimant-native-enrollment-reconciliation-db`: passed against the existing local Supabase database inside a rollback-only transaction.
- `git diff --check`: passed.

The database exercise covers stable committed replay, terminal non-commit cleanup, delayed-completion invalidation, current-session displacement, mismatched challenge authority, and denial to the authenticated database role. Mobile hostile coverage includes ciphertext-only persistence, device-only accessibility, tamper, malformed/partial state, prohibited fields, cross-account isolation, cancellation, expiry, ambiguous completion, and all three reconciliation outcomes.
