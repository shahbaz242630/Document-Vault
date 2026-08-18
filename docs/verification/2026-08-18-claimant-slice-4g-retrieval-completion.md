# Claimant Slice 4G — verified retrieval completion

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-retrieval-completion`

Starting checkpoint: `79a1d94` (`Add claimant native package open boundary`)

## Outcome

Slice 4G adds an immutable-false, unmounted service boundary and one service-only database transaction that records retrieval completion only after a separately verified native-open proof is bound to the exact served Slice 4E delivery.

- The service strictly validates and cross-binds the completion, delivery, retrieval session, case, release package, active portal session, claimant device key, payload, manifest, opaque native-open reference, and open time returned by an injected verifier.
- Only the SHA-256 digest of the opaque native-open reference crosses the database boundary. No assertion object, challenge, plaintext, key material, manifest body, signature, ciphertext, or native-local reference is persisted.
- The database transaction locks the delivery authority and revalidates the exact served delivery, consumed retrieval session, released case version, active AAL2 claimant portal, active identity and eligibility, signed synthetic manifest, active claimant key binding, active App Attest key, monotonic assertion counter, proof digest, and bounded session/finalization time.
- One atomic commit advances the App Attest counter, appends its value-free verification event, inserts the completion/event/idempotency records, and changes only delivery/session retrieval completion to true. The case remains `released` and its version does not change.
- Replay with the exact completion/idempotency input is stable. Changed, stale, cross-bound, expired, future, malformed, or unauthorized input fails closed.
- Three new server-only tables use forced RLS, explicit client denial, narrow service grants, immutable-safe constraints, and indexed foreign-key lookup paths.
- Export and closure are structurally fixed false. This receipt proves only that the separately verified native boundary reported a local open; it does not claim export, claimant confirmation, plaintext receipt by the server, or closure.

No API route, app entrypoint, production native implementation/binding, browser plaintext, server decryption, public or signed URL, hosted migration, deployment, real data, Supabase image download, or external behavior was added.

## Verification

- New API tests: 11 passed, covering the disabled default, strict input/proof parsing, expected-context binding, counter advancement, proof/reference digest construction, hostile substitutions, safe error reduction, exact RPC mapping, response allowlisting, and service-role client construction.
- New migration/isolation checks: 7 passed.
- Standalone PostgreSQL rollback harness passed against the already-cached `postgres:16-alpine` image. It constructs the complete synthetic Slice 4E served state, rejects stale counter/wrong portal/wrong manifest/future-open attacks, verifies atomic completion and replay, checks App Attest counter/event state, proves export/closure false, and confirms authenticated table/function denial. The temporary container was removed after the run.
- Workspace tests: 1,076 passed; 3 established environment-gated mobile tests skipped.
- Full static/security regressions: 189 passed serially.
- All workspace typechecks, zero-warning lint, production web build, API bundle check, claimant custody isolation, retrieval-completion isolation, and `git diff --check` passed.

## Remaining gates

The Slice 4G approval remains immutable false and the service/client are not imported by the API entrypoint. The injected verifier is not a production App Attest/native implementation, and no hosted migration or device evidence was performed.

Delivery, native local open, server retrieval completion, optional local export, suspension/expiry, claimant confirmation, and closure remain separate facts. The next bounded slice is Phase 4 Slice 4H: an immutable-false, unmounted suspension/expiry foundation that prevents future serving and retrieval authority while never claiming that already opened local plaintext can be recalled or deleted. Export and closure remain separate.
