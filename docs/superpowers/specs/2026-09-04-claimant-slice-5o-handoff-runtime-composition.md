# Slice 5O — authenticated handoff runtime composition

Date: 2026-09-04 (Asia/Dubai)

Status: authorized for bounded local engineering with synthetic data. PR #71 merged on 2026-09-04 after clean staging smoke and runtime-log verification. Runtime activation, hosted mutation, deployment, native production signing, and real claimant data remain unauthorized.

## Outcome

Mount the Slice 5N authenticated handoff issue, completion, and preflight handlers through one production-shaped API composition root. The root composes only the existing verified claimant-portal session client, server-side Ed25519 handoff service, and service-role handoff RPC client.

The composition approval is independently literal `false`. Disabled requests return `404` before environment reads, Supabase client creation, authentication, or request parsing. Exact API and claimant origins are required before the lazy service factory can construct either Supabase client.

## Acceptance

- Both POST paths and their OPTIONS handlers are present in the canonical Hono app but remain concealed by default.
- Default-disabled and capability-disabled requests touch no configuration or client factories.
- Hostile API or claimant origins, cookies, malformed authorization, media types, idempotency keys, bodies, and preflights fail closed without constructing runtime clients.
- An injected synthetic enabled path proves the real controller and service bind a fresh active AAL2 claimant session to the existing handoff transaction contract.
- Environment configuration accepts only exact distinct HTTPS origins plus non-empty server-only Supabase configuration.
- Static isolation proves the new mount, literal-false composition approval, lazy dependency creation, prohibited-material absence, and unchanged false authority boundaries.
- Focused API tests, API typecheck, lint, Phase 1, security, GitHub Actions security, dependency, bundle, and handoff isolation checks pass.

## Non-goals

No capability flag changes, hosted migration, hosted Auth or Storage change, deployment, production promotion, native signer, mobile/web transport, real claimant data, identity decision, intake transition, review, notification, release, package retrieval, or external activation is added.
