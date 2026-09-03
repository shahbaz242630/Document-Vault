# Claimant Slice 2H — Submission And Safe-Acknowledgement Transaction

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 2H server increment is code-complete on `codex/claimant-submission-transaction`. It adds an immutable-false service, strict service-role transaction client, append-only receipt, and one atomic server-owned submission transaction. The service is unmounted and `CLAIMANT_SUBMISSION_APPROVED = false`. No API route, hosted migration, notification delivery, real evidence, deployment, or external behavior was added.

## Implemented authority

- The transaction reasserts the active claimant portal session, locks the case, and verifies exact claimant identity, active current case key, `identity_pending` state, case version, policy pack, intake version/status, latest preparation version, bundle, and non-future submission time.
- Client-authored readiness is never trusted. Every checklist item must be non-pending and represented by the latest preparation revision. Every available manifest entry must bind exactly one consumed upload capability and one clean quarantine object; unavailable items must bind the latest explicit unavailable disposition.
- The strict synthetic envelope requires exact immutable-false runtime/release flags, one UUIDv4 case and idempotency key, bounded unique item/placeholder pairs, and all four declarations including `review_is_not_release`.
- One database transaction advances `identity_pending` to `submitted`, increments the case version, writes one append-only receipt, appends one value-free audit event, enqueues one value-free outbox event, and records replay authority.
- The acknowledgement exposes only the opaque acknowledgement reference, case/intake/preparation versions, `submitted`, received/already-received status, and immutable `review_started: false` / `release_authorized: false` values.
- Exact retries return `already_received`; changed-input reuse fails. Receipt, audit, outbox, state, and idempotency writes roll back together on any late failure.

## Storage and access boundary

- `claimant_submission_receipts` is forced-RLS, denies anon/authenticated access, grants service-role select/insert only, and structurally binds `(case_id, claimant_user_id)` through a composite foreign key. It has no update/delete grant.
- The RPC is `security invoker`, has an empty search path, is revoked from public/anon/authenticated, and is executable only by service role.
- The repository catalog security guard now requires the new table/function and their deny-by-default posture.
- No filenames, paths, content digests, document bodies, reviewer identity, owner response, fraud/risk signals, internal notes, or release authority are returned by the service.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 960 passed; 3 environment-gated mobile tests skipped.
- Focused API service/client suites: 6 passed across 2 files.
- Migration/security static regressions: 7 passed.
- `npm run check:claimant-submission-db`: passed in the rollback-only local Supabase database exercise.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- `npm run web:build`: production web build passed with 24 unchanged routes.
- `npm run check:api-vercel-bundle`: passed.
- Submission migration, catalog-security, and GitHub Actions regressions: 30 passed.
- `git diff --check`: passed.

The database exercise proves cross-claimant and revoked-key denial, non-clean/incomplete evidence rejection, authenticated role isolation, late outbox-collision rollback with no partial case/receipt/audit/idempotency state, one successful transition, one receipt/audit/outbox record, stable replay, and changed-input replay denial.

## Staging and production

Slice 2H is unmounted and was not deployed. The previously verified Slice 2E preview remains `dpl_C6PGm7FBQn4LTLhYXyJHe1vh8Kro`; production remains healthy on rollback deployment `dpl_H7NXnWujWdcLd6coKrraDHe1N5gr`. No migration, promotion, or production change occurred.

## Next bounded slice

Add a concealed, immutable-false submission/acknowledgement controller over this transaction. Require exact claimant origin and content type, verified bearer identity, fresh AAL2 without recovery authentication, active portal assertion, strict body/idempotency limits, server-derived authority, generic failures, bounded concurrency, and no notification delivery. Keep hosted migration, real evidence, external access, and capability activation separately gated.
