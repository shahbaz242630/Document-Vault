# Claimant Slice 2D — Streaming Upload And Reconciliation Processor

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 2D processor increment is code-complete on `codex/claimant-upload-processor`. It remains hard-disabled and unmounted. No HTTP upload route, real parser, real Storage or malware provider adapter, hosted migration, hosted Storage change, deployment, real file, or external claimant behavior was added.

## Implemented boundary

- The processor accepts an async byte stream only through injected adapters and enforces 25 MiB total, 1 MiB per chunk, the exact expected byte count, and a 30-second abort signal.
- It validates the exact case-bound `v1/<case UUID>/<object UUID>` path, hashes bytes with SHA-256 while streaming, and never forwards or persists the raw capability token. Only its digest reaches database authority.
- An injected inspector must report an allowlisted detected type, valid file signature, PDF page count where applicable, expanded-size bound, and single non-archive entry. Any mismatch causes fail-closed cleanup.
- Bytes enter the existing private quarantine before scanning. An injected scanner result is persisted as `clean`, `malicious`, `error`, or `timeout`; thrown or unexpected scanner responses become retryable `error`, never clean.
- The service-only reconciliation function reports only `upload_pending`, `upload_uncommitted`, or `object_recorded` plus bounded authority fields. It requires the exact capability digest and exposes no token or content digest.
- An ambiguous quarantine response is reconciled before cleanup. If the database committed the object, bytes are preserved and scanning continues from the authoritative version.
- Orphan cleanup first invokes a service-only abandonment transaction. Advisory and row locks serialize it against quarantine commit; only an unrecorded, unconsumed capability can become revoked. Storage deletion happens after that authority is removed.
- If authority lookup, abandonment, cleanup, or scan-result persistence is ambiguous, the processor returns only `reconciliation_required` and does not claim success.
- Explicit reconciliation retries scanning for authoritative `quarantined`/`scan_failed` objects, returns terminal authoritative states unchanged, preserves an in-flight unexpired upload, and removes only expired/revoked uncommitted bytes after abandonment authority is confirmed.

## Immutable gates and limitations

- `CLAIMANT_UPLOAD_PROCESSOR_APPROVED = false`.
- No normal API route imports or mounts the processor.
- Storage, inspector, and malware scanner remain injected interfaces. The abort guarantee requires the future Storage adapter to observe the supplied `AbortSignal`.
- No production parser safety, provider timeout, callback authenticity, regional processing, DPA/subprocessor, backup, or operational evidence is claimed.
- The local migration and expanded rollback exercise were not applied to hosted Supabase.
- A future controller must independently enforce exact claimant origin, fresh AAL2, active portal context, content type, idempotency, per-account/network concurrency and rate limits, response redaction, and disabled-route concealment.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 928 passed; 3 environment-gated mobile tests skipped.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- Focused processor/transaction suite: 13 passed across 2 files.
- Processor/static security suite: 7 passed.
- `npm run check:phase1`: passed.
- `npm run check:security`: passed.
- `npm run check:github-actions-security`: passed.
- `npm run check:claim-custody-isolation`: passed.
- `npm run check:claimant-private-quarantine-db`: passed against the expanded rollback-only local database exercise.
- `git diff --check`: passed.

Hostile coverage includes disabled-before-touch behavior, invalid capability/path, oversized streams, byte-count mismatch, unsafe inspection, cleanup failure, ambiguous commit preservation, confirmed-uncommitted cleanup, scanner exceptions, scan-failure retry, stable and changed-input capability replay, wrong reconciliation digest, atomic abandonment rollback, direct client-role denial, and Storage/quarantine lifecycle isolation.

## Next bounded slice

Add a concealed, hard-disabled upload controller around this processor. Require fresh AAL2 and active claimant-portal context; exact claimant origin, method, content type, headers, and body semantics; strict idempotency and concurrency controls; safe generic responses; and deterministic local inspector/Storage/scanner adapters. Real provider selection/configuration and external access remain separate gates.
