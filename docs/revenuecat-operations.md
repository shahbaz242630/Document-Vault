# RevenueCat Operations

The API exposes `POST /webhooks/revenuecat` as a Phase 1 payment-foundation endpoint.

Current Phase 1 behavior:

- Requires `REVENUECAT_WEBHOOK_SECRET` in the API environment.
- Validates the RevenueCat webhook payload shape.
- Acknowledges valid events with `entitlementSync: "deferred_phase_1"`.
- Does not write subscription state to Supabase.
- Does not gate Phase 1 vault functionality behind subscriptions.

Entitlement persistence is intentionally deferred until payment scope resumes. When that work starts, add an idempotent entitlement-sync store that handles RevenueCat retries and event ordering before using webhook events to affect product access.
