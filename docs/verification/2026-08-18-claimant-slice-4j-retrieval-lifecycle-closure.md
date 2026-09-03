# Claimant Slice 4J — retrieval lifecycle closure foundation

Date: 2026-08-18 (Asia/Dubai)

Branch: `codex/claimant-retrieval-lifecycle-closure`

Starting checkpoint: `4297a64` (`Add claimant native local export contract`)

## Outcome

Slice 4J adds an immutable-false, unmounted retrieval-lifecycle closure foundation that records only an administrative closure fact.

- Three forced-RLS, service-only tables hold the immutable closure, one value-free event, and stable idempotency. Anonymous and authenticated roles have explicit deny-all policies and no table or function authority.
- One `security invoker` transaction acquires the existing retrieval-session then encrypted-delivery advisory locks, followed by delivery/session/case locks in the established order. It requires one exact released case and matching served, completed delivery/session/completion authority.
- The transaction accepts either no export fact or an all-or-none, separately verified export fact. The service verifies the exact value-free Slice 4I receipt shape, rejects substitutions and unsafe additions, and persists only receipt/proof digests plus the export timestamp.
- Closure is append-only. It does not update the case, finalization, delivery, retrieval session, completion, access-control, or local device state. The original Slice 4G completion therefore remains structurally `export_performed=false` and `closure_recorded=false` as the historical point-in-time completion fact.
- The closure result fixes `closure_recorded=true`, `historical_delivery_preserved=true`, and `historical_completion_preserved=true`, while `local_content_recalled=false` and `local_content_deleted=false` remain structural constraints.
- Stable replay requires the identical request digest. Changed input, stale case versions, incomplete authority, cross-object substitution, duplicate lifecycle closure, malformed export evidence, and client-role access fail closed.

The approval remains literal `false`, and neither the service nor transaction client is imported by the API composition root. No reviewer UI/evidence access, route, browser/server plaintext, server decryption, URL, production native binding, hosted migration, real data, deployment, or external behavior was added.

## Verification

- New API tests: 12 passed across the service and transaction client. They cover immutable-false behavior, no-export closure, exact Slice 4I export-fact verification and digesting, strict input/output parsing, unsafe/substituted facts, client projections, and generic failure reduction.
- New static contract/isolation checks: 6 passed. They prove forced RLS/default denial, historical immutability, all-or-none export evidence, lock ordering, service-only execution, stable replay, literal-false approval, no composition-root mount, and immutable-safe output fields.
- Two standalone PostgreSQL 16 rollback scenarios passed against the already-cached generic `postgres:16-alpine` image: administrative closure without export and closure with a separately verified export fact. Both construct the full synthetic served/opened state, reject a stale version, prove stable replay and exact row counts, preserve case/delivery/session/completion history, and confirm authenticated table/RPC denial.
- Workspace tests: 1,104 passed; 3 established environment-gated mobile tests skipped.
- Full static/security regressions: 209 passed serially.
- All workspace typechecks, zero-warning lint, the unchanged 24-page production web build, API bundle, claimant custody/closure isolation, repository/GitHub Actions security, and `git diff --check` passed.
- Each temporary PostgreSQL container was removed after its run. No Supabase image was downloaded or started, hosted Supabase was not contacted or changed, and all database test writes rolled back.

## Remaining gates

Slice 4J is not mounted or active. It does not implement or prove a real native export, claimant confirmation, local deletion, local recall, production native custody, hosted schema, or external closure behavior.

Served, opened, exported, access-ended, and administratively closed remain separate historical facts. A local copy cannot be remotely recalled or proven deleted.

The next bounded slice is Phase 5 Slice 5A: a hard-disabled, runtime-disconnected safe V2 offline-code protocol foundation. It must split the public locator from a high-entropy client-held secret, reject V1 and locator-only authorization, use only synthetic deterministic vectors, and add no lookup route, claimant discovery, server decryption, hosted migration, real data, deployment, or external behavior.
