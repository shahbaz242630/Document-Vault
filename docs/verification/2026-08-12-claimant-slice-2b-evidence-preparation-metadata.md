# Claimant Slice 2B — Evidence Preparation Metadata

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 2B persistence/service increment is code-complete on `codex/claimant-evidence-metadata`. It remains hard-disabled and unmounted. No HTTP route, browser form, binary upload, Storage bucket or policy, malware provider, hosted migration, deployment, notification, case submission, or external claimant behavior was added.

## Implemented boundary

- `claimant_evidence_preparation_items` retains append-only preparation revisions under forced RLS with service-role-only `select` and `insert` privileges. No update or delete privilege is granted.
- Every row is bound to the exact case, claimant, selected checklist item, policy-pack ID/version, and intake preparation version through database keys and constraints.
- A prepared declaration contains only a synthetic placeholder reference, allowlisted media type, bounded byte count, and claimed preparation timestamp. An unavailable declaration contains none of those fields.
- Unsafe filenames, object paths, buckets, document bodies, identity numbers, file checksums, scan results, reviewer data, and release predicates are not accepted or stored.
- `claimant_record_evidence_preparation` requires the current active claimant-portal session, active identity, active current case key, `identity_pending` case/version, exact intake/policy/version binding, unique items/references, advisory locking, and idempotency.
- Each successful write creates a new immutable preparation version, updates only the current checklist projection, appends a value-free audit event, and stores the replay result atomically.
- Prepared metadata leaves checklist availability as `pending`. It cannot produce `available`, `ready_for_review`, `submitted`, `upload_received`, or any other assertion that bytes exist or passed validation.
- An unavailable declaration changes only the intake projection to `manual_review`; it does not advance the case. A later valid revision may reset that projection to `documents_needed` while retaining history.
- The strict API service rejects malformed protocols, non-synthetic markers, extra fields, unsafe labels, duplicate/overlapping items, duplicate placeholder references, unsupported media, invalid sizes, future timestamps, and empty bundles before database access.

## Immutable gates and isolation

- `CLAIMANT_EVIDENCE_PREPARATION_APPROVED = false`.
- No route imports or mounts the service; static isolation asserts that the API entry point exposes no evidence-preparation path.
- The migration exists only on the local branch and was exercised inside a rolled-back transaction. Hosted Supabase and Storage are unchanged.
- Anonymous and authenticated roles have no table or function privilege, with explicit deny-all policies in addition to forced RLS.
- A future HTTP boundary must independently enforce verified fresh AAL2 and active claimant-portal context before calling this service.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 908 passed; 3 environment-gated mobile tests skipped.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- Focused evidence-preparation API suite: 7 passed across 2 files.
- Evidence/static security suite: 7 passed.
- `npm run check:phase1`: passed.
- `npm run check:security`: passed.
- `npm run check:claim-custody-isolation`: passed.
- `npm run check:claimant-evidence-preparation-db`: passed against the rollback-only local database exercise.
- `git diff --check`: passed.

The database exercise covers direct cross-claimant insertion, direct future timestamps, unselected checklist items, rollback without partial state, revoked keys, cross-claimant calls, displaced sessions, prepared-versus-available separation, unavailable projection, stable replay, changed-input replay, stale intake versions, append-only revision history, case non-transition, and authenticated-role denial.

## Next bounded slice

Before accepting binary data, separately review and implement the private-quarantine upload boundary: randomized case-bound object paths and short-lived capabilities, Storage RLS, signature/MIME/size/page/count/decompression validation, malware-scanning and outage behavior, retention/deletion/legal hold, reconciliation, and hostile cross-account/cross-case tests. No provider or production configuration is approved by this slice.
