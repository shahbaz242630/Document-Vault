# Claimant Slice 2G — Hard-Disabled Dashboard Read-Model Coordinator

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 2G client increment is code-complete on `codex/claimant-dashboard-read-model`. It adds an injected-transport coordinator for a synthetic claimant dashboard while `CLAIMANT_DASHBOARD_READ_MODEL_COORDINATOR_APPROVED = false` and the claimant portal `dashboard` capability remains false. The module has no normal web runtime importer. No dashboard route, production transport, database projection, hosted configuration, deployment, or external behavior was added.

## Implemented boundary

- The response is bound to one canonical UUIDv4 case identifier and a positive case/projection version pair. Projection version must equal the server case version.
- Journey, owner-protection/review tracking, and decision/retrieval projections must form one exact coherent canonical triplet produced by the existing safe public projection contracts. Validating each card independently is insufficient.
- The top-level response has an exact field allowlist, `synthetic_only: true`, one fixed secure-support route, and a date-only last-meaningful-update value. Future dates and precise timestamps are rejected.
- Extra private fields, raw internal states, reviewer/owner detail, fraud/risk signals, evidence metadata, release-package identifiers, or inconsistent projection combinations fail closed.
- Refresh sends only case ID and the last trusted projection version. Lower versions are rejected as stale; changed content at the same version is rejected as divergent.
- Switching cases clears the prior snapshot before transport completes, preventing cross-case display. A teardown epoch prevents a late in-flight response from repopulating cleared state. Accepted snapshots are structured-cloned and recursively frozen in memory.
- Reads are single-flight and abort-aware. Public failures are generic and do not forward database/provider topology or claimant detail.

## Immutable gates and limitations

- `CLAIMANT_DASHBOARD_READ_MODEL_COORDINATOR_APPROVED = false`.
- Claimant portal `dashboard: false` remains unchanged from a runtime perspective and is now explicit.
- Static isolation rejects normal runtime imports, direct network clients, browser persistence, cookies, caches/service workers, provider SDKs, and prohibited private dashboard fields.
- The transport is an injected contract only. No API route, persisted server projection, reconciliation job, alerting, hosted database change, localization/copy approval, or external access exists.
- Existing claimant and Storage migrations remain undeployed. Production remains on its verified rollback deployment.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 954 passed; 3 environment-gated mobile tests skipped.
- Focused dashboard and claimant-portal suites: 13 passed across 2 files.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- `npm run web:build`: production web build passed with 24 routes and no new dashboard route.
- `npm run check:claimant-dashboard-client-isolation`: passed.
- Dashboard isolation plus GitHub Actions security regressions: 24 passed.
- `npm run check:api-vercel-bundle`: passed.
- `git diff --check`: passed.

Hostile coverage includes disabled-before-transport behavior, exact safe projection acceptance, immutability, extra private fields, incoherent projection combinations, future dates, case/projection version drift, cross-case response substitution, prior-case clearing, teardown/late-response races, observer failure, stale rollback, same-version divergence, cancellation, concurrent reads, malformed case identifiers, and transport-detail redaction.

## Staging and production

Slice 2G is runtime-disconnected and was not deployed. The previously verified Slice 2E preview remains `dpl_C6PGm7FBQn4LTLhYXyJHe1vh8Kro`; production remains healthy on rollback deployment `dpl_H7NXnWujWdcLd6coKrraDHe1N5gr`. No promotion or production change occurred.

## Next bounded slice

Implement the hard-disabled server-owned submission and safe-acknowledgement transaction using synthetic data: same-transaction case-version validation, evidence/preparation authority checks, idempotent replay, persisted receipt, value-free audit/outbox append, and no implication that review or release has started. Keep its API route, hosted migration, notifications, real evidence, and external access separately gated.
