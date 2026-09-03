# Claimant Slice 2A — Intake And Checklist Foundation

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 2A persistence/service increment is code-complete on `codex/claimant-intake-foundation`. It remains hard-disabled and unmounted. No HTTP route, client UI, evidence upload, Storage bucket, document metadata, hosted migration, deployment, notification, or external claimant behavior was added.

## Implemented boundary

- Two forced-RLS, service-role-only tables persist a case-bound synthetic intake snapshot and a server-selected checklist. Composite database constraints bind the snapshot to the exact case, claimant, policy-pack ID, and policy-pack version.
- Intake accepts only the synthetic `death` trigger, a bounded synthetic jurisdiction key, and exactly six allowlisted boolean routing facts. Extra keys and non-boolean values fail closed.
- Checklist rows accept only the frozen 13-item catalog, `common` or `conditional` provenance, and bounded availability values. Initialization requires all seven common items and initializes every item as `pending`.
- `claimant_initialize_claim_intake` requires the current active claimant-portal session, an active claimant identity, an active current case key, an exact draft case/version/policy binding, and a unique idempotency decision.
- One transaction persists the snapshot and checklist, advances the case from `draft` to `identity_pending`, appends a value-free audit event, and stores the replay result. Invalid input and partial failure roll back together.
- A strict API transaction client maps only the bounded RPC contract and redacts database details behind a generic error code.
- The service selects one current synthetic policy pack and renders the checklist server-side. Missing, conflicting, or invalid packs fail closed before database access.

## Immutable gates and isolation

- `CLAIMANT_INTAKE_INITIALIZATION_APPROVED = false`.
- No route imports or mounts the intake service; static isolation asserts that the API entry point exposes no claimant-intake path.
- The migration exists only in the local worktree and was exercised inside a rolled-back transaction. Hosted Supabase is unchanged.
- Client database roles have no table or function privilege. Forced RLS and explicit deny-all client policies provide an additional boundary.
- The stored policy catalog is deliberately synthetic and its integrity is not a production policy-signing claim.
- A future HTTP boundary must independently enforce a verified fresh AAL2 claimant-portal session before calling this service. This slice cannot be treated as route-level assurance because no route exists.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 901 passed; 3 environment-gated mobile tests skipped.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- Focused intake API suite: 5 passed across 2 files.
- Intake/static security suite: 7 passed.
- `npm run check:phase1`: passed.
- `npm run check:security`: passed.
- `npm run check:claim-custody-isolation`: passed.
- `npm run check:claimant-intake-foundation-db`: passed against the local rollback-only database exercise.
- `git diff --check`: passed.

The database exercise covers invalid extra routing facts, cross-claimant binding, incomplete common checklist rollback, revoked case keys, displaced portal sessions, stable replay, changed-input replay, stale case version, client-role denial, exact checklist persistence, case transition, and value-free audit creation.

## Next bounded slice

Add checklist progress and evidence-metadata persistence with server-owned transitions and the same case/claimant isolation. Do not add binary upload until a separate private-quarantine Storage path, randomized case-bound object capability, file validation, malware-scanning adapter, retention/deletion behavior, and hostile Storage authorization tests are designed and reviewed.
