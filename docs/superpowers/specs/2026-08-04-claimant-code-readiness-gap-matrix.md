# Claimant Code-Readiness Gap Matrix

Date: 2026-08-04 (Asia/Dubai)

## Decision And Scope

The claimant programme is authorized for production-shaped engineering with synthetic data and disabled-by-default external capabilities. This audit distinguishes engineering readiness from launch authorization.

Audit baseline: current `main` at PR #59 merge commit `887abd0459197c5123b8972e1b8c5bed14ec5528`, plus the local Phase 0 runtime-control slice described below.

No deployment, production environment, provider account, DNS, real notification, real evidence, or real claimant data is in scope.

## Executive Result

The claimant system is not yet engineering production ready. The repository contains a substantial, well-tested synthetic domain model and read-only journey preview, but no complete claimant API, database schema, authentication integration, evidence pipeline, operational review runtime, or native release journey.

The first Phase 0 foundation is now implemented locally: the canonical API validates a disabled-by-default claimant capability graph at startup, supports independent kill switches with fail-closed dependency propagation, rejects malformed configuration, and rejects every attempted claimant activation in production. No claimant route is mounted.

## Gap Matrix

| Area | Current evidence | Status | Required engineering work | Target phase |
| --- | --- | --- | --- | --- |
| Domain contracts and deterministic vectors | `packages/shared-types/src/claim/**`, claimant vectors, state invariants, projections, audit and submission models | Strong synthetic baseline | Preserve contracts; version changes and bind them to runtime persistence and API inputs | All phases |
| Runtime capability control | New `services/api/src/claimant/runtime-config.ts`; startup validation in `services/api/src/index.ts` | Phase 0 slice complete | Reuse guards in every future claimant route/processor; add equivalent native/client presentation guards where needed | Phase 0 onward |
| Public claimant web | `/claim`, registered-recipient and emergency-code pages are informational; tests forbid forms, auth, network, and storage | Missing runtime | Add protected routes only on the claimant host context; fail closed on public/owner hosts and keep public information routes separate | Phases 2 and 5 |
| Claimant API | Phase 1 Slice 3 mounts disabled-by-default issue/accept endpoints over the service-only mutations with exact origin/content-type/CORS checks and server-derived actors | Initial protected boundary complete | Extend the same boundary to assurance, intake, evidence, dashboard, review, and release endpoints | Phases 1-5 |
| Claimant database | Phase 1 Slices 1-5 add the registered-recipient, session, case-key, ciphertext-grant, audit, outbox, and lifecycle mutation foundation | Phase 1 registered-recipient platform complete | Add evidence/reviewer/release schemas and server-owned transition processing | Phases 2-4 |
| RLS and tenant isolation | Eleven claimant tables have forced RLS, explicit deny-all policies, zero client grants, live catalog/function enforcement, and hostile REST/RPC tests | Foundation complete | Extend the same default-deny posture and hostile cross-owner/cross-claimant/cross-case/race tests to every later table and mutation | All later phases |
| Authentication and session assurance | Slice 4 supplies shared fresh-AAL2 enforcement; the first Slice 1A boundary sub-slice adds server-owned synthetic portal eligibility and claimant-portal-specific activation/assertion/revocation | Portal boundary complete; hosted MFA client owner-parked on Free plan | Preserve enforcement; complete paid-plan hosted MFA lifecycle and displacement testing before external access/final readiness | Pre-live gate |
| Registered-recipient route | Platform lifecycle APIs, strict iOS enrollment/possession/App-Attest contracts and vectors, signed probe evidence, and an owner-accepted adversarial review/remediation exist | Slice 1B/1C design review closed; live native/server proof/bootstrap missing | Implement native App Attest and server verification in disabled slices, then add transactional challenge/acceptance with delivery/privacy and hosted-MFA gates | Phase 2 / pre-live |
| V2 offline-code route | V2 contracts, validation, vectors, and synthetic KDF profile exist; V1 is unsafe for lookup | Partial protocol baseline | Implement locator/client-secret proof, throttling, attempt controls, expiry/revocation, case binding, benchmarks, and explicit V1 rejection | Phase 5 |
| Checklist and evidence preparation | Catalogue, selection, preparation, validation, fixtures, and read-only previews exist | Strong synthetic baseline | Bind to persisted case/policy versions and authenticated claimant state | Phase 2 |
| Evidence upload and quarantine | No claimant Storage policy, upload capability, malware adapter, or evidence persistence exists | Missing | Add randomized case-bound paths, bounded upload grants, file limits/signatures, scanning adapter, quarantine state, deletion, and tests | Phase 2 |
| Submission and acknowledgement | Synthetic assembly, validation, idempotent handoff, and safe acknowledgement exist | Strong synthetic baseline | Add same-transaction submission, case-version check, audit/outbox append, replay response, and persisted receipt | Phase 2 |
| Dashboard tracking | Safe public projections and read-only previews exist | Partial | Produce projections from canonical persisted case/audit state and enforce field allowlists at the API boundary | Phases 2-4 |
| Owner protection and notifications | Synthetic owner-protection/review tracking exists; no claimant notification runtime | Missing | Implement value-free outbox delivery adapters, cooldown, cancellation, dispute, hold, retry, reconciliation, and kill switches | Phase 3 |
| Reviewer operations | Synthetic review submission and tracking contracts exist | Missing runtime | Add assignment, conflict/recusal, access, two distinct approvals, escalation, appeal, and hostile authorization tests | Phase 3 |
| Release authorization | State contracts and decision-readiness projections exist | Missing runtime | Enforce current grant, policy, cooldown, no hold/cancellation, two approvals, fresh assurance, and bounded session | Phase 4 |
| Encrypted package and native retrieval | Release vectors and disabled custody feasibility module exist | Partial feasibility baseline | Add claimant-addressed package creation, native two-device enrollment, local opening/export, expiry/suspension, clearing, and physical tests | Phase 4 |
| Observability and operations | Owner processors have some logging/guards; no claimant runtime exists | Missing | Add value-free events, alerts, reconciliation, audit-pipeline failure detection, deletion verification, incident and kill-switch exercises | Phase 6 |
| End-to-end acceptance | Synthetic suite covers deterministic journey and previews | Synthetic only | Add authenticated production-shaped browser/API/database/native tests, outage/race/replay cases, backup/restore, and rollback | Phase 6 |

## Phase 0 Slice 1 — Fail-Closed Runtime Control Plane

Implemented locally:

- Master claimant runtime shutdown, default `false`.
- Independent capability requests for authentication, registered recipient, V2 code, intake, evidence, dashboard, case processing, owner protection, notifications, review, release, and native retrieval.
- Dependency propagation so disabling an upstream capability disables downstream behavior even if downstream flags remain requested.
- Strict `true`/`false` parsing; ambiguous flag values fail startup.
- Absolute production activation rejection while `CLAIMANT_PRODUCTION_ACTIVATION_APPROVED` remains false.
- Startup validation in the canonical API.
- Typed guard for future route and processor wiring.
- Regression assertion that the API mounts no claimant route.

Non-goals:

- No claimant endpoint, web control, database migration, Storage policy, authentication flow, upload, notification, processor, release, or native behavior.
- No external configuration or environment variable change.
- No change to the existing informational claimant routes or hard-disabled native custody probe.

Verification:

- Focused runtime configuration and API startup: 10 tests passed.
- Complete API suite after final startup wiring: 39 tests passed.
- API typecheck and focused ESLint passed.
- Claim-vector isolation, claimant-custody isolation, and the repository security guard passed after the initial implementation.

## Prioritized Engineering Queue

1. Preserve the incomplete Slice 1A hosted MFA/client exit gate for the paid-plan pre-live work; do not weaken server AAL2 enforcement.
2. Slice 1B/1C contracts, probe evidence, owner-accepted adversarial review, and bounded remediation are complete. Continue with separate disabled native App Attest and server-verifier slices; keep live challenge/acceptance dependent on the recorded custody, privacy, delivery-retention, hosted-MFA, and transactional controls.
3. Add second-device enrollment, owner-client V2 ciphertext sealing, and server-authoritative validation/finalization without moving private keys or MEK plaintext through the web/API.
4. Continue through checklist, evidence, submission, and persisted dashboard tracking.
5. Continue through owner protection/review, release/native retrieval, and finally V2 as ordered in `CLAIM_HANDOFF.md`.

## Phase 1 Slice 1 — Default-Deny Registered-Recipient Schema

Implemented locally:

- `claimant_identities`: auth-linked claimant identity lifecycle with versioning.
- `claimant_invitations`: expiring, single-use owner invitations containing a normalized-address digest only; self-acceptance is prohibited.
- `claimant_device_keys`: claimant-bound P-256 public JWKs; private `d` material is rejected and no recovery key exists.
- `claimant_cases`: registered-recipient cases bound by composite foreign keys to the accepted invitation, owner, claimant, and current claimant device key.
- Forced RLS and explicit deny-all policies for `anon` and `authenticated` on every foundation table.
- Explicit revocation of all client privileges and service-role-only table grants.
- Catalog guard expectations that require zero client privileges and retain the deny-all policies.
- Static migration assertions, live transactional invariant tests, and hostile anonymous/authenticated REST coverage.
- Security CI runs both the static migration suite and the live claimant database invariant test.

Enforced invariants include:

- An invitation can create at most one case.
- An owner cannot accept their own invitation.
- A case claimant and owner must differ.
- A case must match the accepted invitation's owner and claimant.
- A case key must belong to the same claimant.
- Public key material must be P-256 and cannot contain a private JWK component.
- Address values are represented only by a versioned 64-character digest.

Non-goals:

- No API route, client repository, web form, authentication integration, invitation delivery, upload, notification, reviewer operation, release, or native claimant behavior.
- No audit/outbox mutation pipeline existed in this slice; Phase 1 Slice 2 adds it.
- No hosted Supabase migration or other external state change.

Verification:

- 54 Security CI regression tests passed.
- Static claimant migration suite: 3 passed.
- Supabase catalog security check passed against the local stack.
- Claimant database invariant test passed in a rollback-only transaction.
- Hostile Supabase RLS/REST attack test passed for anonymous and authenticated users.
- Complete API suite: 39 passed.
- All workspace typechecks and full repository lint passed.
- Claimant vector isolation, claimant custody isolation, repository security guard, GitHub Actions security guard, and `git diff --check` passed.

## Phase 1 Slice 2 — Transactional Registered-Recipient Mutations

Implemented locally:

- Default-deny, service-only idempotency, append-only audit, and value-free outbox tables.
- Security-invoker, service-role-only invitation issuance and acceptance functions.
- Transactional invitation acceptance that binds the address digest, claimant identity, P-256 public device key, accepted invitation, and draft case.
- Advisory locking, request-digest replay protection, changed-input rejection, and stale invitation-version rejection.
- Audit and outbox writes in the same transaction as each successful mutation; failed key enrollment leaves no partial identity, key, case, audit, outbox, or idempotency state.
- Catalog enforcement for claimant function execution privileges and explicit removal of client execution from the pre-existing active-record trigger function.
- Static migration checks, rollback-only mutation journey tests, and hostile anonymous/authenticated PostgREST RPC probes in Security CI.

Non-goals:

- No HTTP API adapter or mounted claimant route, authentication/MFA/recovery flow, delivery adapter, web form, upload, notification, reviewer operation, release, or native claimant behavior.
- Outbox payloads are deliberately value-free records only; no external message is delivered.
- No hosted Supabase migration or other external state change.

Verification:

- 58 Security CI regression tests passed, including 4 mutation-migration assertions.
- Local Supabase catalog security check passed for all seven claimant tables and both mutation functions.
- Both rollback-only database suites and the hostile anonymous/authenticated RLS/REST/RPC attack test passed.
- Complete API suite: 39 passed.
- All workspace typechecks, full repository lint, claimant vector/custody isolation, repository security guard, and GitHub Actions security guard passed.

## Phase 1 Slice 3 — Protected Registered-Recipient API Boundary

Implemented locally:

- Mounted invitation-issue and invitation-acceptance POST endpoints backed only by the service-role mutation adapter; the runtime capability graph conceals them with `404` while disabled.
- Supabase bearer verification with owner/claimant actor IDs derived exclusively from the verified session; strict bodies reject actor-spoofing fields.
- Exact allowlisted origins, explicit non-wildcard CORS preflight, exact `application/json`, UUID idempotency headers, declared and actual body-size limits, and `no-store` responses.
- Strict digest, version, policy-pack, public-only P-256 JWK, URL-parameter, and response allowlist validation.
- Stable conflict/not-found/unavailable responses that do not expose Supabase or PostgreSQL error messages.
- Focused adapter and hostile route tests for disabled capabilities, origins/preflight, content type, authentication, idempotency, oversized/malformed input, spoofing, private keys, replay, response mapping, and error redaction.

Non-goals:

- No claimant MFA, recovery, fresh-session assurance, second-device completion, invitation delivery, protected web form, evidence upload, notification, review, release, or native behavior.
- No production flag activation, external endpoint availability, real identity/data, hosted Supabase migration, or deployment.

Verification:

- Complete API suite: 49 tests across 15 files passed.
- 58 static security regression tests, both rollback-only claimant database suites, live catalog enforcement, and hostile anonymous/authenticated RLS/REST/RPC tests passed.
- All workspace typechecks, full repository lint, claimant vector/custody isolation, repository security guard, and GitHub Actions security guard passed.

## Phase 1 Slice 4 — Fresh MFA And Server-Owned Session Control

Implemented locally:

- Verified Supabase `getUser` plus signed session claims with strict `sub`, `session_id`, `aal`, `exp`, `iat`, and timestamped `amr` parsing.
- Fail-closed fresh-assurance checks requiring an unexpired AAL2 session and a recent TOTP/phone/WebAuthn MFA timestamp; AAL1, missing timestamps, unknown string-only methods, recovery-marked, expired, stale, or future-dated assurance is rejected.
- Configurable fresh-assurance policy from 60–600 seconds, with an independent ten-minute database ceiling.
- Default-deny `claimant_session_controls` and append-only, value-free `claimant_session_events` tables.
- Service-role-only session activation, active-session assertion, and revocation functions with advisory locks and idempotent activation/revocation.
- A newly activated session displaces the prior session; displaced and explicitly revoked sessions fail every invitation issue/acceptance request.
- Disabled-by-default session activation/revocation API endpoints that derive the user and session exclusively from verified claims and accept no actor/session identifier in the body.

Non-goals:

- No protected claimant web sign-in or Supabase MFA enrollment/challenge UI yet; Slice 4 provides and tests the server enforcement boundary that client flow must satisfy.
- No second-device completion, key replacement/revocation, invitation delivery/revocation UI, evidence, notification, review, release, native behavior, hosted migration, or external activation.

Verification:

- Complete API suite: 62 tests across 16 files passed.
- 61 static security regression tests passed, including 3 session-migration assertions.
- All three rollback-only claimant database suites, live catalog enforcement, and hostile anonymous/authenticated RLS/REST/RPC tests passed.
- All workspace typechecks, full repository lint, claimant vector/custody isolation, repository security guard, and GitHub Actions security guard passed.

## Phase 1 Slice 5 — Registered-Recipient Key And Grant Lifecycle

Implemented locally:

- Case-scoped device-key bindings with a one-case-per-key invariant, including automatic binding of the first acceptance key.
- Transactional second-device enrollment, key replacement, key revocation, pending-invitation revocation, and owner finalization under verified fresh AAL2 active sessions.
- Last-active-key protection and strict claimant/case/key ownership checks.
- Replacement or revocation atomically revokes current ciphertext grants, clears owner finalization, advances binding/case versions, and emits a value-free invalidation event.
- Owner finalization requires at least two independent active case keys and exactly one strict registered-recipient V2 ciphertext envelope for every active key.
- Ciphertext-grant persistence contains only the V2 algorithm/profile bindings, public ephemeral key, nonce, ciphertext, identifiers, versions, and timestamps; private keys and MEK plaintext are rejected by API allowlists and absent from the schema.
- Strict disabled-by-default API adapters and explicit CORS preflight for all lifecycle operations, with actors derived only from verified sessions.

Non-goals:

- No claimant or owner client UI yet, no native hardware key generation/attestation, and no server-side grant encryption. Owner finalization accepts ciphertext already sealed by an authorized owner client.
- No evidence, dashboard, notification delivery, review, release, hosted migration, real claimant data, or external activation.

Verification:

- Complete API suite: 68 tests across 17 files passed.
- 64 static security regression tests passed, including 3 lifecycle-migration assertions.
- All four rollback-only claimant database suites, live catalog enforcement, and hostile anonymous/authenticated RLS/REST/RPC tests passed.
- All workspace typechecks, full repository lint, claimant vector/custody isolation, repository security guard, and GitHub Actions security guard passed.

## Launch Boundary

Engineering completion will produce an immutable, production-ready-but-disabled candidate. Governance, compliance, staffing, provider administration, independent assurance, deployment approval, and controlled activation remain separate launch work. No real claimant data may be collected before those gates close.
