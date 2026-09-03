# Claimant Slice 3B — Owner-Notice Delivery Coordinator

Date: 2026-08-18 (Asia/Dubai)

## Decision

The bounded Slice 3B increment is code-complete locally on `codex/claimant-owner-notice-delivery`. It adds a hard-disabled, unmounted owner-notice delivery coordinator using injected queue, provider, and Slice 3A transaction contracts only. No provider SDK, network implementation, route, database migration, deployment, notification, real identity, or external behavior was added.

## Implemented boundary

- `CLAIMANT_OWNER_NOTICE_DELIVERY_APPROVED` is an immutable compile-time `false`; disabled execution rejects before claiming work or touching a provider.
- Claimed work must be an exact value-free `owner_notice_requested` envelope. Case, aggregate, outbox, cycle, version, cycle number, notice request, dispatch key, and persisted delivery idempotency key are cross-bound before dispatch.
- A first claimed attempt may call the injected provider once with only an opaque synthetic notice reference, stable dispatch key, and bounded abort signal. Retried attempts never dispatch again.
- Provider acknowledgement is never delivery authority. The coordinator always performs a separate lookup using the stable dispatch key; only an exact verified lookup yields a canonical SHA-256 evidence digest and `verified` transaction outcome.
- Definitive failed lookup records `failed`; unknown, timed-out, malformed, cross-dispatch, or unavailable lookup records `ambiguous`. Slice 3A moves both outcomes to hold without activating cooldown.
- A provider exception is reconciled through lookup. An ambiguous database response leaves queue completion untouched so the same persisted transaction key can replay safely without redispatch.
- Queue completion is bound to the exact outbox, cycle, case, resulting case version, delivery key, outcome, and expected delivered/failed terminal status. Completion ambiguity requires reconciliation.
- One coordinator instance serializes execution. Errors remain generic and omit provider/database detail.
- Static isolation rejects normal API mounting, Supabase client construction, direct networking/environment access, provider brands, owner contact fields, private material, reviewer/release fields, and runtime activation.

## Verification

All commands passed locally on 2026-08-18:

- All workspaces: 990 tests passed; 3 established environment-gated mobile tests skipped.
- Focused delivery coordinator: 8 passed.
- Static delivery isolation regression: 1 passed.
- All workspace typechecks and zero-warning root lint passed.
- The unchanged 24-page production web build and API bundle guard passed.
- Owner-protection, submission-controller, claimant-custody, repository security, GitHub Actions security, Security CI registration, and `git diff --check` passed.

Supabase guidance influenced the boundary by keeping elevated access backend-only and by retaining the Slice 3A service-only `SECURITY INVOKER` transaction contract with explicit execution privileges. Slice 3B contains no schema change and therefore required no hosted SQL exercise. Production Supabase and local Docker were untouched.

## Next bounded slice

Add a hard-disabled, service-only outbox lease/claim/completion/reconciliation persistence boundary. It must atomically persist the stable dispatch and delivery-idempotency keys before provider contact, reclaim expired leases without duplicate dispatch, bind completion to the owner-protection result, and expose no client policy, provider implementation, route, or external activation.
