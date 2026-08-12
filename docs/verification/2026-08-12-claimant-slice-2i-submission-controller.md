# Claimant Slice 2I — Concealed Submission Controller

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 2I server increment is code-complete on `codex/claimant-submission-controller`. It mounts the Slice 2H submission and safe-acknowledgement transaction behind an independent compile-time approval fixed to `false`. Normal requests receive a concealed `404` before configuration, CORS, authentication, or transaction construction. No hosted migration, notification delivery, real evidence, deployment, production promotion, or external behavior was added.

## Implemented boundary

- `POST /claimant/cases/:caseId/submissions` and its exact `OPTIONS` preflight are mounted in the canonical API composition root.
- The enabled test-only path requires the exact configured HTTPS API origin and claimant portal `Origin`, exact `application/json`, a UUIDv4 route case, a UUIDv4 `Idempotency-Key`, and no more than 16 KiB of actual UTF-8 body bytes.
- The strict top-level body permits only the submission envelope, expected intake version, and expected preparation version. The service additionally requires the envelope case and idempotency values to equal the route and header values.
- Bearer identity is derived through the portal session client. Submission requires fresh AAL2, rejects recovery authentication, and reasserts the active claimant-portal session before transaction authority is constructed.
- A bounded in-process guard permits at most one active submission per claimant/case by default and rejects contention with a generic `429` and a one-second retry hint. The guard constructor cannot exceed two.
- The controller constructs the service with server time and server-derived claimant, portal-session, route-case, and header-idempotency authority. It returns only the allowlisted safe acknowledgement fields.
- Database conflicts and unexpected failures are mapped to bounded generic errors. No filename, path, digest, evidence content, reviewer identity, owner response, internal signal, note, or provider error can enter the response.
- Static isolation requires both immutable-false approvals, verifies the mounted controller-only composition boundary, and rejects notification-provider tokens.

## Hostile verification

The focused tests prove disabled-before-config behavior; hostile claimant/API origin concealment; fresh-AAL2 and active-portal sequencing; stale and recovery denial; route/header-to-envelope binding; exact media, UUID, body-size, and preflight rules; bounded contention; generic database failures; and guard bounds.

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 969 passed; 3 established environment-gated mobile tests skipped.
- Focused controller, service, and transaction-client suites: 15 passed across 3 files.
- Controller-isolation and migration regressions: 5 passed.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- `npm run web:build`: production web build passed with 24 unchanged routes.
- `npm run check:api-vercel-bundle`: passed.
- `npm run check:claimant-submission-db`: rollback-only local database exercise passed.
- `npm run check:claimant-submission-controller-isolation`: passed.
- Repository security, GitHub Actions security, and claimant-custody isolation guards passed.
- `git diff --check`: passed.

## Staging and production

Slice 2I was not deployed. The previously verified Slice 2E preview remains `dpl_C6PGm7FBQn4LTLhYXyJHe1vh8Kro`; production remains healthy on rollback deployment `dpl_H7NXnWujWdcLd6coKrraDHe1N5gr`. No migration, promotion, configuration change, or production action occurred.

## Next bounded slice

Add a hard-disabled, runtime-disconnected web submission coordinator using injected transport only. It should validate the exact request and safe acknowledgement, use one stable UUIDv4 idempotency key per attempt, serialize submissions, define abort and ambiguous-response retry behavior, retain no submission or acknowledgement in browser persistence, and remain absent from normal runtime imports. Keep hosted migration, notifications, real evidence, external access, and capability activation separately gated.
