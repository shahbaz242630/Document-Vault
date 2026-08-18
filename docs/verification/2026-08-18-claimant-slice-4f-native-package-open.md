# Claimant Slice 4F — native encrypted-package open boundary

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-native-package-open`

Starting checkpoint: `5122c6f` (`Add claimant encrypted package delivery`)

## Outcome

Slice 4F adds an immutable-false, runtime-disconnected mobile coordinator and production-shaped native adapter contract for local encrypted-package verification and opening.

- The coordinator accepts only an exact Slice 4E `served` result while `retrieval_completed` remains false and requires the single expected case-version transition.
- It strictly parses the delivered ciphertext package and canonical release manifest, rejects non-canonical or expired manifests, and cross-binds the case, package, retrieval session, claimant, grant, recipient key/version, ordered asset IDs, and ciphertext digests.
- A separately injected signing-key resolver must return the exact active synthetic Ed25519 key identified by the signed manifest.
- Exact payload bytes/digest, manifest digest/signature, delivery ID/key/receipt, signing public key, claimant key alias, and case/package/session bindings pass to one injected native-shaped verification/opening operation.
- The native result must bind every expected identifier and digest, asset count, recipient key, and a bounded open timestamp. Hostile or malformed output fails closed.
- JavaScript receives no decrypted asset or release material. Success returns only a value-free asset count, opaque native-local open-session reference, timestamps and identifiers. Plaintext export and server retrieval completion remain immutable false.
- Concurrent opening is rejected, cancellation is honored, and native failures are reduced to one safe error class.

No production Swift/Kotlin method, Expo native-module binding, app entrypoint, route, network call, browser storage, filesystem persistence, Supabase change, database migration, server decryption, plaintext return, export, deployment, real data, or external behavior was added.

## Verification

- New mobile coordinator/adapter tests: 14 passed, covering disabled defaults, exact successful binding, unserved/completed/version/key rejection, canonical/expiry/signing-key/native-output substitution, serialization, cancellation, missing native binding, exact native mapping, and hostile plaintext/export output.
- Dedicated static contract/isolation checks: 6 passed. They prove both approvals remain literal false, the feature is not imported by normal mobile runtime, direct network/storage/native-module dependencies are absent, no production Swift method exists, and success returns only an opaque local reference with export false.
- Workspace tests: 1,065 passed; 3 established environment-gated mobile tests skipped.
- Full static/security regressions: 176 passed serially.
- All workspace typechecks and zero-warning lint passed.

## Remaining gates

Both Slice 4F approvals remain immutable false. There is no native implementation or binding, so this slice does not decrypt or present anything on a device and is not native custody evidence. Delivery, local open, export, claimant confirmation, retrieval completion, expiry, suspension and closure remain distinct.

The next bounded slice is Phase 4 Slice 4G: an immutable-false, unmounted retrieval-completion receipt foundation. It must consume the exact served delivery and a separately verified claimant-device/App-Attest local-open proof, record `retrieval_completed` only after that proof, and leave export/closure separate. It must add no browser plaintext, server decryption, production native binding, hosted migration, deployment, real data or external behavior.
