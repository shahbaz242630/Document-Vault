# Claimant Slice 2C — Private Quarantine Foundation

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 2C private-quarantine foundation is code-complete on `codex/claimant-private-quarantine`. It remains hard-disabled and unmounted. No HTTP upload route, byte-stream processor, real file, scanner/provider selection, hosted Storage change, hosted migration, deployment, or external claimant behavior was added.

## Implemented boundary

- The migration defines one private `claimant-evidence-quarantine-v1` bucket with a 25 MiB limit and only PDF, JPEG, and PNG media types.
- Restrictive anonymous/authenticated `storage.objects` policies exclude the quarantine bucket. Restrictive policy composition prevents a future permissive policy from accidentally granting direct client access.
- Upload capabilities are one-time, expire within five minutes, use opaque server-keyed case-bound object IDs/tokens, and persist only a SHA-256 capability digest. Domain-separated HMAC derivation makes an idempotent retry reproduce the same secret without storing it.
- Capability issuance requires the current active claimant-portal session, active identity/key, exact `identity_pending` case/version, current intake/preparation version, and exact prepared checklist-item/placeholder binding.
- Quarantine receipt consumes the capability atomically and requires exact path, media type, byte count, digest, PDF page count, expanded-size, archive-count, and retention bounds.
- Evidence remains quarantined until an injected malware scanner returns `clean`. Malicious results are rejected; exceptions, timeouts, and unexpected scanner values fail closed as retryable `scan_failed` state.
- Checklist availability changes to `available` only after a clean scan. It can project `ready_for_review` only when every selected item is clean and none is unavailable. This slice does not submit or advance the case.
- The provisional synthetic retention profile is capped at 30 days. Legal hold blocks deletion.
- Deletion is two phase: the database first records `deletion_pending`; an injected Storage adapter must remove the object; only then may a separate transaction record `deleted` and reset the checklist projection. Storage failure never claims deletion.
- Lifecycle functions are security-invoker, service-role-only, advisory-locked, versioned, idempotent, and append value-free audit events.

## Immutable gates and limitations

- `CLAIMANT_PRIVATE_QUARANTINE_APPROVED = false`.
- No API route imports or mounts the quarantine services.
- Hosted Supabase and Storage are unchanged; the migration was exercised only inside a rolled-back local transaction.
- Validation and scanner/Storage integrations are injected contracts. No byte parser, streaming upload implementation, malware product, provider credentials, callback/webhook, or production configuration exists yet.
- The 30-day retention identifier is synthetic and provisional. It is not a legal/privacy retention approval.
- A future upload route must independently enforce fresh AAL2, active claimant-portal context, hard stream/time/concurrency limits, server-side capability redemption, safe parsing, orphan reconciliation, and privacy-safe observability.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 918 passed; 3 environment-gated mobile tests skipped.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- Focused quarantine API suite: 10 passed across 2 files.
- Quarantine/static security suite: 7 passed.
- `npm run check:phase1`: passed.
- `npm run check:security`: passed.
- `npm run check:github-actions-security`: passed.
- `npm run check:claim-custody-isolation`: passed.
- `npm run check:claimant-private-quarantine-db`: passed against the rollback-only local database exercise.
- `git diff --check`: passed.

The database exercise covers private bucket configuration, direct authenticated Storage denial, cross-claimant and displaced-session issuance, path binding, stable/changed-input replay, digest-only capability persistence, media mismatch without consumption, one-use capability enforcement, scanner timeout followed by clean retry, prepared-versus-clean availability, retention expiry, legal hold, deletion planning versus confirmation, audit completeness, and authenticated-role RPC denial.

## Next bounded slice

Add a hard-disabled streaming upload/reconciliation processor that redeems the application capability, validates real synthetic bytes through an injected parser, writes only to quarantine through an injected Storage adapter, invokes the scanner adapter, and reconciles orphaned bytes or metadata after partial failure. Provider selection, hosted configuration, real claimant documents, and external activation remain separate gates.
