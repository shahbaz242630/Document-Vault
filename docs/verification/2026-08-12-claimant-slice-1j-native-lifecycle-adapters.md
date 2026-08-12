# Claimant Slice 1J — Native Lifecycle Adapter Composition

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 1J contract/composition increment is code-complete on `codex/claimant-native-lifecycle-adapters`. It remains hard-disabled and runtime-disconnected. No normal app route, native Swift production method, entitlement, Apple request, build, hosted migration, deployment, or external claimant behavior was added.

## Implemented boundary

- Strict injected App Attest and claimant-key-custody adapter interfaces use production-specific method names and output shapes. They cannot accept the disposable probe methods, `test_alias_only` results, or probe aliases.
- Custody accepts only `claimant-enrollment.v1.<UUID>` alias references, canonical P-256 public material/capability, exact opaque challenge bytes, and a possession proof bound to every immutable challenge field.
- App Attest accepts only the canonical Apple key identifier and the one expected bounded opaque object. Unexpected fields and native error detail fail closed behind a generic error.
- Request digests use canonical JSON and SHA-256 Base64URL. Undefined, fractional, cyclic, and non-plain request values are rejected rather than silently normalized.
- A runtime-disconnected composition root joins the Slice 1H coordinator/transport, Slice 1I encrypted store/reconciliation, strict native adapters, and canonical digest function.
- The composition permits only one active enrollment/recovery operation. It supports cancellation and a pre-session-teardown settlement operation.
- Session teardown aborts an in-flight request, waits for coordinator cleanup, then runs recovery. If final submission is ambiguous, reconciliation completes before custody deletion; only authoritative `not_committed` deletes the key.

## Immutable gates and isolation

- `CLAIMANT_NATIVE_LIFECYCLE_ADAPTERS_APPROVED = false`.
- `CLAIMANT_NATIVE_ENROLLMENT_RUNTIME_APPROVED = false`.
- Slice 1G, 1H, and 1I approvals remain `false`.
- Normal application source still cannot import claimant custody/enrollment features.
- The existing probe-only native module and aliases are unchanged. Static isolation rejects any promotion of its method names or markers into the production-shaped boundary.
- The native module remains injected as an unavailable interface. Implementing production Swift methods, production aliases/entitlements, direct module binding, and physical Apple evidence requires a separately reviewed native slice and explicit external-action authorization.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 896 passed; 3 environment-gated mobile tests skipped (the two added hostile cases also pass in the final focused rerun).
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- Focused claimant enrollment suite: 31 passed across 6 files.
- `npm run check:phase1`: passed.
- `npm run check:security`: passed.
- `npm run check:claim-custody-isolation`: passed.
- `npm run check:claimant-native-enrollment-reconciliation-db`: passed against the local rollback-only database exercise.
- `git diff --check`: passed.

Hostile coverage includes disabled-before-touch behavior, missing native module, unexpected/prohibited native fields, probe alias rejection, changed proof bindings, malformed opaque bytes, canonical digest stability, unsupported request values, concurrent enrollment rejection, pre-final cancellation, terminal encrypted-state cleanup, and ambiguous-final session teardown reconciliation.
