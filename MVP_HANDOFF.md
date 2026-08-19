# Sanduqkin MVP Handoff

Last updated: 2026-08-18 (Asia/Dubai)

## Current Decision

The controlled internal TestFlight mobile gate is `PASS` for Sanduqkin `1.0.0` Build 7. The next product objective is to build, wire, integrate, and production-harden the complete claimant journey with synthetic data and disabled-by-default capabilities. Registered recipient comes first; the safe V2 code route follows. Governance, compliance, staffing, specialist assurance, edge activation, and provider administration remain go-live gates rather than blockers to engineering implementation.

Repository reference: Build 7 was dispatched from `main`/`origin/main` at `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` after PR #56. PR #54 supplied the synthetic claimant baseline only; the 2026-08-04 owner decision separately authorizes production-shaped engineering while external runtime and real claimant data remain blocked.

Session checkpoint: claimant Slice 5B is complete at branch HEAD on `codex/claimant-offline-code-v2-persistence`, based on Slice 5A `d6cb3d2` and Slice 4J `49ee8a8`. The safe V2 protocol now has default-deny local persistence, bounded challenges/attempts, replay, expiry and revocation behind an immutable-false, unmounted service boundary. No claimant deployment, hosted migration, real data, or external activation occurred.

Deployment safety checkpoint: the 2026-08-12 Vercel workspace-package tracing failure is fixed by compiling and bundling an explicit `@vault/shared-types` Node runtime entry while retaining source types/mobile resolution. The function-bundle guard imports the exact packaged entry. Preview `dpl_C6PGm7FBQn4LTLhYXyJHe1vh8Kro` passed repeated health and route/security probes with no exception logs. Production remains deliberately on healthy rollback `dpl_H7NXnWujWdcLd6coKrraDHe1N5gr`; the preview was not promoted.

## MVP Surfaces

| Surface | Intended host | Current state |
| --- | --- | --- |
| Mobile owner vault | Native app | Build 7 controlled internal TestFlight gate passed; no public App Store release or additional build is authorized by that result |
| Public website | `sanduqkin.com` | Protected static preview; legal publication blocked |
| Owner web vault | `vault.sanduqkin.com` | Implemented locally; not deployed |
| Claimant portal | `app.sanduqkin.com` | Currently informational/synthetic; full production-shaped engineering is authorized locally, while external runtime remains disabled |
| Canonical API | `api.sanduqkin.com` | Existing Hono owner-vault API/processor is deployed in `fra1` at its Vercel origin; the custom production host is not approved or attached, claimant runtime is absent, and the existing ingress must be included in `EDGE-01` |
| Identity/data | Supabase `eu-central-1` | Existing Free project plus local test stack |

Production hosts remain subject to final security/privacy approval. Use host-only cookies and exact origin/CORS/redirect allowlists; do not rely on path separation between owner and claimant contexts.

## MVP Scope By Delivery State

| Delivery state | Included scope |
| --- | --- |
| Implemented and internally verified | Mobile owner authentication and recovery continuity, encrypted 17-category CRUD, deletion lifecycle, local PDF export, Emergency Readiness, sealed emergency-code foundation, shared validation/envelopes, and the controlled Build 7 evidence |
| Implemented locally; launch-gated | Protected owner-web authentication and encrypted CRUD, plus static product/support/security/accessibility/legal/deletion pages |
| Completed synthetic baseline | Runtime-disconnected claimant contracts, vectors, previews, end-to-end modelling/acceptance, threat and decision documents, and the native custody feasibility probe |
| Authorized engineering; incomplete | Registered-recipient authentication/bootstrap, persistence, evidence, dashboard, owner protection, review, client-sealed encrypted release, native retrieval, then the safe V2 route and production-hardening acceptance |

This document uses “MVP” for the intended bounded launch scope, not to imply that every listed surface is implemented or launch-authorized. `CLAIM_HANDOFF.md` is authoritative for claimant slice boundaries and completion evidence.

## Explicitly Excluded

- Public legal publication before owner/counsel approval.
- External authenticated web users before Supabase, backup, session, origin, configuration, and smoke gates pass.
- External live claimant accounts, real invitations, real evidence, real notifications, production activation, and release before launch approval. These capabilities may now be implemented and tested locally with synthetic data and disabled external flags.
- V1 emergency-code lookup, server-side vault decryption, browser-readable release PDFs, automatic release for owner non-response, payments, or financial/legal/executor positioning.

## Current Mobile Finding

Build 6 was submitted and subsequently tested on a physical iPhone. Its Settings biometric card/status was a plain `View`; only the conditional enable/disable buttons were pressable, so physical Face ID setup and the protected-key `Lock` -> `Unlock` path did not pass.

PR #53 merged a discoverable and accessible Settings action with focused coverage. Build 7 contains the repair and was uploaded successfully.

Protected TestFlight workflow run `30830865138` produced Sanduqkin `1.0.0` Build 7 from `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build ID `0d8fce13-9ec8-46c9-a4de-6c9224523856`. On 2026-08-04, Shahbaz Malik reported successful Apple processing and approval of the App Store Connect export-compliance answer. The exact legal classification/value is not inferred or reproduced.

Code review confirms the underlying enablement, authenticated key retrieval, session validation, and password fallback paths are present. Android emulator evidence passed. Shahbaz Malik reported that the complete requested value-free physical-iPhone regression passed on Build 7, including Face ID enablement, lock/unlock, background lock, cancel/error and fallback behavior, returning-user recovery, and the owner-flow navigation/readiness checks.

Marriage/divorce certificate options are present in the encrypted Document Locations registry and automated tests. Shahbaz Malik reported that corrected divorce-certificate encrypted create/edit/reload/delete persistence and cleanup passed on the Build 7 physical-iPhone regression.

## Owner Web Contract

- Mobile and web share one Supabase identity and one encrypted vault; do not create a parallel vault.
- Passwords, KEKs, MEKs, and plaintext records remain client-side and are not persisted in browser storage.
- Browser cryptography and the active MEK remain inside the Web Worker.
- Owner-web deployment contract: protected pages must remain private, `no-store`, and `noindex`; lock, sign-out, timeout, displacement, and fatal failures must clear decrypted/key state. Manual lock exists, but automatic inactivity/background lock, session-displacement lock, complete sign-out, and browser-data clearing remain P0 evidence gaps under `OWEB-03`.
- The Hono API remains the canonical privileged surface; durable state belongs in Postgres, not page components or process memory.

## Claimant Product Direction

Status: synthetic prototype complete; full engineering implementation `GO`; external runtime and real claimant data `NO-GO` until launch approval.

Interim test staffing: Shahbaz Malik is the accountable human test reviewer; Codex is a non-human technical review assistant/test actor for synthetic staging and separately authorized disabled production-shaped checks. This does not satisfy the two-independent-human-reviewer release control. Codex cannot hold production credentials, decide a real claim, or authorize release; qualified independent humans remain required before go-live.

The code-backed readiness audit is `docs/superpowers/specs/2026-08-04-claimant-code-readiness-gap-matrix.md`. Phase 0 Slice 1 now provides a disabled-by-default, startup-validated canonical API control plane with independent kill switches and no mounted claimant route.

Phase 0 Slice 1 verification is green: 39 API tests, API typecheck, focused lint, claimant vector/custody isolation, and the repository security guard pass.

Phase 1 Slice 1 is also complete locally: four server-only claimant foundation tables use forced RLS, explicit deny-all client policies, zero client grants, single-use invitation and cross-record binding constraints, public-key-only custody, live database invariants, and hostile REST tests. No endpoint is mounted and hosted Supabase is unchanged.

Phase 1 Slice 2 is complete locally: service-only transactional invitation issue/acceptance now binds idempotency, append-only audit, value-free outbox, claimant identity, public device key, and draft case creation. Replay, stale/change/digest/self/private-key/partial-failure and hostile RPC paths pass. No endpoint is mounted and hosted Supabase is unchanged.

Phase 1 Slice 3 is complete locally: the issue/accept endpoints are mounted behind disabled-by-default capability concealment, verify Supabase bearer sessions, derive actors server-side, enforce exact origin/CORS/content-type/idempotency/body/schema boundaries, allowlist responses, and redact failures. All 49 API tests pass; external runtime and hosted Supabase remain unchanged.

Phase 1 Slice 4 is complete locally: fresh timestamped AAL2 and active server-owned sessions are required; activation displaces the previous session, explicit revocation blocks it, and recovery/AAL1/stale/expired/future/unknown assurance fails closed. All 62 API and 61 static security tests pass; hosted Supabase and external runtime remain unchanged.

Phase 1 Slice 5 completes the local registered-recipient platform API: case-scoped second-device enrollment, replacement/revocation, pending-invitation revocation, strict two-key V2 ciphertext-grant owner finalization, and automatic invalidation after key changes. All 68 API and 64 static security tests pass; no claimant/owner lifecycle client or external runtime is active.

Phase 2 Slice 1A must not infer claimant eligibility from Supabase authentication or AAL2 alone. It uses pre-provisioned synthetic claimant-bootstrap identities, a server-owned default-deny portal-eligibility decision, context-bound claimant session authority, and claimant-host enforcement. Owner-only, arbitrary, ineligible, and ambiguous dual-role identities fail closed. Production account creation, invitation binding, recovery, and enumeration controls are designed explicitly before Slice 1B rather than being implied by the sign-in shell.

The first Slice 1A boundary sub-slice now implements that server eligibility/context and claimant-host concealment foundation locally. It does not yet implement the client sign-in/MFA lifecycle and does not complete Slice 1A. Current evidence is recorded in `docs/verification/2026-08-04-claimant-portal-session-boundary.md`.

Owner decision: hosted claimant Supabase MFA client work is parked while the project remains on the Free plan. Fresh-AAL2 server enforcement stays mandatory. The paid-plan upgrade and hosted MFA enrollment/challenge/recovery/session verification are pre-live and final-readiness gates. Reviewed Slices 1B/1C and their 2026-08-12 remediation are complete; PR #65 supplies the later hard-disabled transaction/controller/mobile boundaries without authorizing live invitation acceptance.

The Slice 1B contract, possession-proof pack, and internal adversarial review are complete: strict canonical validation, exact domain-separated P-256/HKDF/HMAC transcript, deterministic and RFC 5869 vectors, hostile field/point cases, exact-case server-derived invitation indexing, separate delivery-token rules, and an exact AES-256-GCM ephemeral-wrapping profile. The dedicated disposable probe compile and owner-reported physical pass/cancel/retry/cleanup gates passed. PR #65 adds the later hard-disabled server challenge, verifier, transaction, controller, and mobile coordination slices; production adapters and activation evidence remain open.

Slice 1C is complete as the reviewed contract: App Attest registration and assertion client data bind the app key digest, App ID/environment/bundle/category, claimant/session, immutable native challenge, claimant key/fingerprint, invitation/version, API audience, timestamps, and nonce. PR #65 implements the hard-disabled native/server/persistence/controller boundaries while keeping every activation flag false. Apple-issued end-to-end fixtures, physical production-adapter evidence, and independent production review remain mandatory.

Slice 1D native App Attest adapter code is complete behind a hard-disabled TypeScript flag, exact isolated bundle gate, iOS 27 build profile, and development-only entitlement. PR #65's iOS simulator compile/launch checks pass; no dedicated physical App Attest run, Apple-issued end-to-end fixture, or production activation was authorized. Slice 1D production-native evidence remains open.

Slice 1E server App Attest verification and persistence code is also complete locally and unmounted. Strict CBOR/DER, caller-pinned Apple-root chain/nonce trust, registration/assertion bindings, mandatory iOS 27 bundle/category extensions, signature/counter enforcement, forced-RLS storage, and advisory-locked idempotent counter advancement pass local hostile and database checks. Apple-issued fixture/native integration and independent Apple-side review remain open; no route, hosted migration, or external behavior was added.

Slice 1F native-enrollment challenge and acceptance transactions are complete locally and unmounted. Server-generated canonical five-minute transcripts, context-bound encrypted ephemeral-key custody, native ECDH/HKDF/HMAC possession verification, stored-transcript orchestration, single-use challenge state, and atomic invitation/key/case/App-Attest-counter/audit/outbox mutation pass hostile and rollback tests. No HTTP route, hosted migration, provider change, or external behavior was added.

Slice 1G native-enrollment controller code is complete locally and mounted but concealed by an immutable compile-time approval set to `false`. Its enabled path derives identity, confirmed-address, eligibility, invitation, App Attest, device, policy, and configuration authority server-side; enforces fresh AAL2, strict HTTP boundaries, and forced-RLS per-account throttling; and calls only the Slice 1E/1F services. Disabled requests return `404` before configuration or CORS. All 114 API tests pass; no hosted migration, Apple request, provider change, or external behavior was added.

Slice 1H mobile enrollment transport/coordinator code is complete locally, immutable-false, and absent from normal app imports. It strictly validates server transcripts and pairings, sends no client authority, orchestrates injected native adapters, deletes new keys on pre-finalization failure, and preserves a key after ambiguous final acceptance for reconciliation. The disposable probe aliases remain isolated and are not promoted. All 439 mobile tests pass with 3 environment-gated skips; no app route, build, Apple request, or external behavior was added.

Slice 1I encrypted enrollment-attempt persistence and server-authoritative reconciliation are code-complete locally. A strict bounded XChaCha20-Poly1305 mobile record retains only identifiers, request digests, phase/expiry, and a non-secret key alias. Recovery never deletes a finalization key before a serialized service-only server decision. Hostile tamper, cross-account, cancellation, expiry, replay, race, and database-role tests pass; approval remains immutable false and no hosted migration or runtime activation occurred.

Slice 1J production-shaped native adapter contracts and lifecycle composition are code-complete locally and runtime-disconnected. Probe methods/aliases cannot satisfy the contract; App Attest/custody results and canonical request digests fail closed; concurrent operations are rejected; and session teardown reconciles ambiguous final submission before custody deletion. Actual Swift production methods, entitlements, direct binding, build, and physical Apple evidence remain open.

Slice 2A claim-intake/checklist persistence is code-complete locally, hard-disabled, and unmounted. It uses service-only forced-RLS tables plus one idempotent transaction to bind the active claimant portal session, identity, key, case/version, claimant, and synthetic policy version; persist bounded routing facts and the server-selected checklist; append value-free audit; and advance `draft` to `identity_pending`. No route, upload, document metadata, hosted migration, or external behavior exists.

Slice 2B evidence-preparation metadata is code-complete locally, hard-disabled, and unmounted. One append-only forced-RLS table plus an idempotent transaction retain versioned synthetic placeholder metadata or unavailable declarations under exact claimant/case/checklist/policy binding. Prepared metadata remains pending and does not claim upload, receipt, scanning, review readiness, or a case transition.

Slice 2C private evidence quarantine is code-complete locally, hard-disabled, and unmounted. A private bounded bucket denies all direct client object access; server-keyed five-minute capabilities are replay-stable and stored only as digests; validation/scanner/Storage contracts fail closed; and service-only lifecycle state covers quarantine, scanning, retention/legal hold, and two-phase deletion. No upload route, real provider, hosted migration, or real evidence exists.

Slice 2D streaming upload/reconciliation is code-complete locally, hard-disabled, and unmounted. It bounds streaming bytes/chunks/time, hashes during transfer, validates stored synthetic evidence, quarantines before scanning, records scanner failures fail closed, reconciles ambiguous commits, and revokes uncommitted capability authority before orphan cleanup. No HTTP route, real provider adapter, hosted migration, or real file exists.

Slice 2E claimant upload control is code-complete locally and immutable-false. Concealed capability, raw-stream upload, and reconciliation paths require exact HTTPS origins, fresh bearer-derived AAL2, active claimant portal context, strict schemas/headers/content length, server-derived idempotency/processor authority, database preflight, and claimant-case concurrency. Synthetic local adapters are exact-fixture-only, disabled by default, and absent from the API composition root. No real file/provider, hosted configuration, distributed edge throttling, deployment, or external access exists.

Slice 2F claimant upload client coordination is code-complete locally, immutable-false, and absent from normal web runtime imports. It uses injected transport only, binds synthetic preparation metadata through capability/upload/reconciliation, validates progress and terminal authority, reconciles ambiguous completion, and retains at most memory-only reconciliation state. No browser persistence, file picker, provider SDK, deployment, or external behavior exists.

Slice 2G claimant dashboard read-model coordination is code-complete locally, immutable-false, and absent from normal web runtime imports. It accepts only coherent canonical safe-projection triplets bound to one case/version, rejects private fields and stale/divergent/cross-case responses, clears prior case state when switching, and retains only a frozen memory snapshot. No API route, database projection, browser persistence, deployment, or external behavior exists.

Slice 2H claimant submission and safe acknowledgement are code-complete locally and immutable-false. The service-only transaction was directly unmounted at that checkpoint and is now reachable only through Slice 2I's independently concealed controller. It reasserts portal/current-key/case/intake/latest-preparation/clean-object authority, advances only to `submitted`, and atomically writes an append-only safe receipt, value-free audit/outbox events, and idempotency state. Replay is stable; late failures fully roll back; review and release remain explicitly false. No hosted migration, notification delivery, deployment, or external behavior exists.

Slice 2I claimant submission control is code-complete locally and immutable-false. The mounted route is concealed before configuration/CORS while disabled; its test-only enabled path enforces exact API/claimant origins, JSON/body/idempotency bounds, route/header-to-envelope binding, bearer-derived fresh AAL2 without recovery, active portal authority, bounded claimant-case concurrency, safe acknowledgement output, and generic failures. No notification provider, hosted migration, deployment, or external behavior was added.

Slice 2J claimant web submission coordination is code-complete locally, immutable-false, and absent from normal web runtime imports. It strictly binds the synthetic envelope, case and versions to one coordinator-owned UUIDv4 key, serializes submission/retry, keeps ambiguous or aborted dispatch authority only in memory for exact retry, and returns only a frozen safe acknowledgement without retaining it. Static isolation prohibits direct networking, browser persistence, providers, notifications, private material, and internal review/owner/risk fields. No deployment or external behavior was added.

Slice 3A owner protection is code-complete locally, immutable-false, and unmounted. Service-only forced-RLS transactions record value-free notice intent, start cooldown only after verified delivery, and fail cancellation, dispute, material change, conflicting authority, or uncertain delivery closed without review/release authority. The hosted rollback-only exercise passed and left production unchanged.

Slice 3B owner-notice delivery coordination is code-complete locally, immutable-false, and unmounted. It uses injected queue/provider contracts, dispatches only once with an opaque reference and stable key, treats lookup as the sole delivery authority, and replays ambiguous persistence without redispatch. No provider, network, migration, deployment, or external behavior was added.

Slice 3C owner-notice queue persistence is code-complete locally, forced-RLS, service-only, and unmounted. It persists stable keys before contact, reclaims expired leases without redispatch authority, and completes only against the exact Slice 3A case/cycle outcome. The hosted rollback-only exercise passed and left production unchanged.

Slice 3D owner cancellation and claimant dispute controllers are code-complete locally and independently concealed. They use distinct exact origins and session authorities, derive actors from verified claims, require fresh AAL2, supply fixed reasons server-side, and preserve false review/release authority. No provider, UI activation, hosted change, or deployment occurred.

The returned review reproduced both original aggregates and every manifested file. On 2026-08-12 the owner explicitly accepted it as closing the Slice 1B/1C review gate and authorized bounded remediation and later disabled implementation slices. This does not authorize production activation or real claimant data.

The hard-disabled iOS probe harness is implemented with a disposable `probe-only.v3` alias and the exact frozen transcript. Signed internal EAS Build 1 compiled successfully as a separate bundle/router, and the full requested value-free physical-iPhone matrix passed.

A value-free physical evidence coordinator and separate internal probe app are also complete. Normal Sanduqkin builds have no probe entry point. The probe accepts only exact non-production physical-iOS preconditions and strips device/key/fingerprint/proof/native-error detail. Owner-reported authenticated pass, cancellation/cleanup, and retry execution passed.

- Registered-recipient route first; death-only invitation pilot.
- Claimant authentication/MFA, relationship, documents, or code possession do not authorize release.
- Verified owner notice, provisional 30-day cooldown, owner cancellation, no automatic release for non-response, and two independent reviewers.
- At least two independently enrolled device-bound claimant keys; no server recovery.
- Implement and test the iOS claimant journey, key custody, and native retrieval in the engineering environment while Android remains fail-closed for external enrollment until its hardware-security baseline passes.
- Future evidence uses private quarantine storage; future delivery remains ciphertext-only with native local decrypt/read-only presentation and optional local PDF export.
- Package served, opened, exported, claimant-confirmed, expired, and closed are separate auditable events; none should be represented as confirmed plaintext receipt without evidence.
- Provisional package availability is 72 hours and retrieval sessions 15 minutes, subject to security/operations approval.
- A safe claimant journey dashboard and append-only internal audit ledger are required.
- Architecture is nationality-neutral, but claims proceed only under an approved, signed/versioned document-specific jurisdiction policy pack.

Detailed decisions and gates live in `CLAIM_HANDOFF.md` and the 2026-07-31 claimant Slice 2 documents.

The engineering target, readiness definition, and phased implementation order are recorded in `CLAIM_HANDOFF.md`. PR #54 did not build that integration; the 2026-08-04 owner decision now authorizes it in small reviewed code slices while keeping deployment and real data blocked.

## Next Actions

1. Stop for owner review of the completed Slice 5B. Do not begin a further offline-code controller, lookup, or route slice without separate authorization.
2. Keep Slice 1G/1H/1I/1J/2A-2J/3A-3G/4A-4J and 5A/5B approvals immutable false and do not deploy local claimant/Storage migrations.
3. Preserve all parked hosted-MFA criteria and immutable-false claimant approvals; production native adapters, physical App Attest evidence, hosted migrations, edge abuse controls, and external activation remain prohibited.
4. Keep any separately authorized next slice default-deny. Preserve the generic unavailable response and add no discovery/enumeration leak, UI/evidence access, production KDF/native binding, hosted migration, real files/providers, notifications, deployment, or external access.
5. Replace or re-review the temporary `image-size` exception before its 2026-09-30 expiry; the audit must continue to fail closed for every unapproved high/critical advisory.
6. Treat Build 7 as closed and passed; public App Store release and another build remain separately gated.
7. The hourly claimant heartbeat was deleted at session close; no monitoring remains active.

## Verification

### Claimant Slice 3C closing baseline on 2026-08-18

- All workspaces: 994 tests passed; 3 established environment-gated mobile tests skipped.
- Hosted rollback-only queue, focused API/static tests, typechecks, zero-warning lint, unchanged web build, API bundle, and security/isolation checks passed.
- Production Supabase, Docker, deployment, provider, and external state remained unchanged.

### Claimant Slice 3B closing baseline on 2026-08-18

- All workspaces: 990 tests passed; 3 established environment-gated mobile tests skipped.
- Focused coordinator/static tests, typechecks, zero-warning lint, unchanged web build, API bundle, and security/isolation checks passed.
- No hosted database, Docker, deployment, provider, or external state changed.

### Claimant Slice 3A closing baseline on 2026-08-18

- All workspaces: 982 tests passed; 3 established environment-gated mobile tests skipped.
- Workspace typechecks, zero-warning lint, unchanged 24-page web build, API bundle, hosted rollback-only database exercise, security/isolation guards, and `git diff --check` passed.
- Slice 3A was not deployed; hosted production and migration history remained unchanged, and no local Supabase images remain.

### Claimant Slice 2J closing baseline on 2026-08-18

- All workspaces: 976 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks, zero-warning root lint, the unchanged 24-page production web build, and the API Vercel bundle guard passed.
- Submission client/controller, dashboard client, upload client, repository security, GitHub Actions security, claimant-custody isolation, the focused static regression, and `git diff --check` passed.
- Slice 2J was not deployed; no hosted or production state changed.

### Claimant Slice 2I closing baseline on 2026-08-12

- All workspaces: 969 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks, zero-warning root lint, the 24-route production web build, and the API Vercel bundle guard passed.
- The rollback-only submission database exercise, controller isolation, repository security, GitHub Actions security, claimant-custody isolation, and 31 combined static regressions passed.
- Slice 2I was not deployed. Preview `dpl_C6PGm7FBQn4LTLhYXyJHe1vh8Kro` and production rollback `dpl_H7NXnWujWdcLd6coKrraDHe1N5gr` remain unchanged.

### Build 7 owner-reported gate closure on 2026-08-04

- Apple processing completed successfully and the App Store Connect export-compliance answer was approved; no legal classification is inferred in this handoff.
- The complete requested value-free physical-iPhone regression passed, including the corrected divorce-certificate encrypted persistence and cleanup path.
- Result: controlled internal TestFlight mobile gate `PASS`. Public release and every other workstream remain separately gated.

### Owner-vault candidate on 2026-08-03

- Exact-main Security CI run `30828358898` passed the full protected matrix, including live Supabase/RLS, hosted integration, Android emulator, and iOS simulator jobs.
- Protected TestFlight workflow run `30830865138` passed release SBOM, EAS production build, App Store Connect upload, and transient credential cleanup.
- Candidate: Sanduqkin `1.0.0` Build 7; source `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- Submission success alone did not satisfy the physical-device release gate; the gate was subsequently closed by the separate 2026-08-04 owner evidence above.

### Claimant prototype acceptance on 2026-08-02

- Full web suite: 141 passed; shared claimant: 110 passed; shared validation: 42 passed.
- Formal-review remediation now enforces complete audit-input idempotency and case binding, validates canonical snapshot projections and evidence-preparation metadata, binds audit event types to transitions, and keeps synthetic review routes out of public navigation and the sitemap.
- All workspace typechecks, root lint, production web build, Phase 1, security, secret, and claimant isolation guards passed.
- At prototype acceptance, all claimant runtime capabilities remained disabled and the synthetic merge supplied no runtime authorization. The later 2026-08-04 owner decision authorizes engineering implementation only; external runtime and real claimant data remain blocked.

### Baseline on 2026-08-01

- Focused mobile tests: 27 passed.
- Shared validation tests: 42 passed.
- Inactive claimant web tests: 6 passed.
- Claim vector, vector-isolation, and custody-isolation guards passed.
