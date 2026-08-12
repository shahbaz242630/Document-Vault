# Sanduqkin MVP Handoff

Last updated: 2026-08-12 (Asia/Dubai)

## Current Decision

The controlled internal TestFlight mobile gate is `PASS` for Sanduqkin `1.0.0` Build 7. The next product objective is to build, wire, integrate, and production-harden the complete claimant journey with synthetic data and disabled-by-default capabilities. Registered recipient comes first; the safe V2 code route follows. Governance, compliance, staffing, specialist assurance, edge activation, and provider administration remain go-live gates rather than blockers to engineering implementation.

Repository reference: Build 7 was dispatched from `main`/`origin/main` at `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` after PR #56. PR #54 supplied the synthetic claimant baseline only; the 2026-08-04 owner decision separately authorizes production-shaped engineering while external runtime and real claimant data remain blocked.

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

The code-backed readiness audit is `docs/superpowers/specs/2026-08-04-claimant-code-readiness-gap-matrix.md`. Phase 0 Slice 1 now provides a disabled-by-default, startup-validated canonical API control plane with independent kill switches and no mounted claimant route.

Phase 0 Slice 1 verification is green: 39 API tests, API typecheck, focused lint, claimant vector/custody isolation, and the repository security guard pass.

Phase 1 Slice 1 is also complete locally: four server-only claimant foundation tables use forced RLS, explicit deny-all client policies, zero client grants, single-use invitation and cross-record binding constraints, public-key-only custody, live database invariants, and hostile REST tests. No endpoint is mounted and hosted Supabase is unchanged.

Phase 1 Slice 2 is complete locally: service-only transactional invitation issue/acceptance now binds idempotency, append-only audit, value-free outbox, claimant identity, public device key, and draft case creation. Replay, stale/change/digest/self/private-key/partial-failure and hostile RPC paths pass. No endpoint is mounted and hosted Supabase is unchanged.

Phase 1 Slice 3 is complete locally: the issue/accept endpoints are mounted behind disabled-by-default capability concealment, verify Supabase bearer sessions, derive actors server-side, enforce exact origin/CORS/content-type/idempotency/body/schema boundaries, allowlist responses, and redact failures. All 49 API tests pass; external runtime and hosted Supabase remain unchanged.

Phase 1 Slice 4 is complete locally: fresh timestamped AAL2 and active server-owned sessions are required; activation displaces the previous session, explicit revocation blocks it, and recovery/AAL1/stale/expired/future/unknown assurance fails closed. All 62 API and 61 static security tests pass; hosted Supabase and external runtime remain unchanged.

Phase 1 Slice 5 completes the local registered-recipient platform API: case-scoped second-device enrollment, replacement/revocation, pending-invitation revocation, strict two-key V2 ciphertext-grant owner finalization, and automatic invalidation after key changes. All 68 API and 64 static security tests pass; no claimant/owner lifecycle client or external runtime is active.

Phase 2 Slice 1A must not infer claimant eligibility from Supabase authentication or AAL2 alone. It uses pre-provisioned synthetic claimant-bootstrap identities, a server-owned default-deny portal-eligibility decision, context-bound claimant session authority, and claimant-host enforcement. Owner-only, arbitrary, ineligible, and ambiguous dual-role identities fail closed. Production account creation, invitation binding, recovery, and enumeration controls are designed explicitly before Slice 1B rather than being implied by the sign-in shell.

The first Slice 1A boundary sub-slice now implements that server eligibility/context and claimant-host concealment foundation locally. It does not yet implement the client sign-in/MFA lifecycle and does not complete Slice 1A. Current evidence is recorded in `docs/verification/2026-08-04-claimant-portal-session-boundary.md`.

Owner decision: hosted claimant Supabase MFA client work is parked while the project remains on the Free plan. Fresh-AAL2 server enforcement stays mandatory. The paid-plan upgrade and hosted MFA enrollment/challenge/recovery/session verification are pre-live and final-readiness gates. Runtime-disconnected Slices 1B/1C and their 2026-08-12 review/remediation are complete; live invitation acceptance remains a separate disabled engineering slice.

The Slice 1B contract, possession-proof pack, and internal adversarial review are complete: strict canonical validation, exact domain-separated P-256/HKDF/HMAC transcript, deterministic and RFC 5869 vectors, hostile field/point cases, exact-case server-derived invitation indexing, separate delivery-token rules, and an exact AES-256-GCM ephemeral-wrapping profile. No live route, native production key, challenge database state, or invitation acceptance exists. The dedicated probe compile and owner-reported physical pass/cancel/retry/cleanup gates passed; runtime challenge work remains stopped pending independent cryptographic, native/App-Attest, and invitation/privacy review.

Slice 1C is also complete as a runtime-disconnected contract: App Attest registration and assertion client data bind the app key digest, App ID/environment/bundle/category, claimant/session, immutable native challenge, claimant key/fingerprint, invitation/version, API audience, timestamps, and nonce. Deterministic vectors and hostile shared/mobile/API tests pass while the runtime flag remains false. No entitlement, DeviceCheck call, Apple request, endpoint, persistence, or acceptance exists; independent review and separate native/server implementation remain mandatory.

Slice 1D native App Attest adapter code is now complete locally behind a hard-disabled TypeScript flag, exact native probe-bundle gate, isolated iOS 27 build profile, and development-only entitlement. Local verification passes, but no Apple/EAS build or physical-device run was authorized or performed. Slice 1D remains evidence-pending and no live/server claimant behavior was added.

Slice 1E server App Attest verification and persistence code is also complete locally and unmounted. Strict CBOR/DER, caller-pinned Apple-root chain/nonce trust, registration/assertion bindings, mandatory iOS 27 bundle/category extensions, signature/counter enforcement, forced-RLS storage, and advisory-locked idempotent counter advancement pass local hostile and database checks. Apple-issued fixture/native integration and independent Apple-side review remain open; no route, hosted migration, or external behavior was added.

Slice 1F native-enrollment challenge and acceptance transactions are complete locally and unmounted. Server-generated canonical five-minute transcripts, context-bound encrypted ephemeral-key custody, native ECDH/HKDF/HMAC possession verification, stored-transcript orchestration, single-use challenge state, and atomic invitation/key/case/App-Attest-counter/audit/outbox mutation pass hostile and rollback tests. No HTTP route, hosted migration, provider change, or external behavior was added.

Slice 1G native-enrollment controller code is complete locally and mounted but concealed by an immutable compile-time approval set to `false`. Its enabled path derives identity, confirmed-address, eligibility, invitation, App Attest, device, policy, and configuration authority server-side; enforces fresh AAL2, strict HTTP boundaries, and forced-RLS per-account throttling; and calls only the Slice 1E/1F services. Disabled requests return `404` before configuration or CORS. All 114 API tests pass; no hosted migration, Apple request, provider change, or external behavior was added.

Slice 1H mobile enrollment transport/coordinator code is complete locally, immutable-false, and absent from normal app imports. It strictly validates server transcripts and pairings, sends no client authority, orchestrates injected native adapters, deletes new keys on pre-finalization failure, and preserves a key after ambiguous final acceptance for reconciliation. The disposable probe aliases remain isolated and are not promoted. All 439 mobile tests pass with 3 environment-gated skips; no app route, build, Apple request, or external behavior was added.

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

1. Treat the claimant code-readiness audit and Phase 0 Slice 1 / Phase 1 Slices 1-5 as complete.
2. Preserve the parked hosted Slice 1A MFA exit criteria and all server enforcement. Treat Slices 1B/1C, the disposable probe matrix, and the owner-accepted review remediation as complete. Treat local Slice 1D-1H code as complete while closing the recorded Apple-native integration evidence. The next bounded local work is encrypted attempt persistence/reconciliation; activation remains prohibited pending production native adapters, Apple, MFA, edge-abuse, configuration/custody, and independent review evidence.
3. Wire and test the complete registered-recipient journey, then the review/release journey, then the safe V2 code route.
4. Run production-shaped end-to-end and hostile acceptance until one immutable engineering candidate meets the `CLAIM_HANDOFF.md` readiness definition.
5. After the immutable engineering candidate is ready, complete edge, legal, privacy, operations, staffing, and independent assurance as launch preparation; do not activate external runtime or real data before closure.
6. Treat Build 7 as closed and passed; public App Store release and another build remain separately gated.

## Verification

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
