# Claimant Slice 2J — Web Submission Coordinator

Date: 2026-08-18 (Asia/Dubai)

## Decision

The bounded local Slice 2J web increment is code-complete in the working tree on `codex/claimant-submission-controller`. It adds a hard-disabled, runtime-disconnected submission coordinator using injected transport only. No normal web runtime imports it. No hosted migration, notification delivery, real evidence, deployment, production promotion, capability activation, or external behavior was added.

## Implemented boundary

- `CLAIMANT_SUBMISSION_COORDINATOR_APPROVED` is an immutable compile-time `false`; the disabled path rejects before the idempotency-key factory or transport can be touched.
- The coordinator accepts only an exact synthetic submission envelope and exact case, intake-version, and preparation-version bindings. Extra fields, duplicate declarations or evidence references, malformed identifiers, private material, and cross-case substitution fail before transport.
- One coordinator-generated UUIDv4 idempotency key is bound into the envelope, transport header authority, and in-memory attempt. The caller's source envelope is not mutated.
- Only one submission or retry may run at a time. A pending ambiguous attempt blocks a new submission until the exact attempt is retried.
- Aborted-after-dispatch, unavailable, rate-limited, conflict, malformed-response, and unexpected transport outcomes remain ambiguous. The exact frozen request and stable key survive only in coordinator memory for explicit retry.
- Definitive authentication or invalid-request transport rejection clears the pending attempt and returns a generic failure.
- The response validator permits only the safe acknowledgement object and requires exact case/version/intake/preparation bindings, `submitted`, coherent replay/status semantics, and `review_started: false` plus `release_authorized: false`.
- A successful acknowledgement is deeply frozen and returned without being retained by the coordinator. No request or acknowledgement is written to browser persistence.
- Static isolation rejects normal runtime imports, direct browser networking, browser persistence/cache APIs, provider SDKs/tokens, notification wiring, private keys, and internal review/owner/risk fields.

## Hostile verification

All commands passed locally on 2026-08-18:

- `npm test --workspaces --if-present`: 976 passed; 3 established environment-gated mobile tests skipped.
- Focused web coordinator suite: 7 passed.
- `node --test scripts/claimant-submission-client-isolation-check.test.cjs`: 1 passed.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- `npm run web:build`: production web build passed with 24 unchanged generated pages/routes.
- `npm run check:api-vercel-bundle`: passed.
- Submission client/controller, dashboard client, upload client, repository security, GitHub Actions security, and claimant-custody isolation guards passed.
- `git diff --check`: passed.

## Staging and production

Slice 2J was not deployed. Production remains deliberately unchanged. The local claimant and Storage migrations remain undeployed, all claimant approvals remain immutable false, and the existing production/preview posture recorded in the preceding handoff remains authoritative.

## Next bounded slice

Begin Phase 3 with a hard-disabled, unmounted owner-protection persistence/transaction foundation. Model a value-free owner-notice intent and provider-agnostic delivery lifecycle, start the provisional cooldown only from server-verified delivery, invalidate or restart it after material case/key/evidence change, and route failed or ambiguous delivery, cancellation, dispute, or conflicting authority to hold without any release predicate. Keep HTTP routes, real notification providers, hosted migrations, owner UI, real identities/data, and external activation separately gated.
