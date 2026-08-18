# Sanduqkin Project Handoff

Last updated: 2026-08-18 (Asia/Dubai)

## Current Decision

The controlled internal TestFlight mobile gate is `PASS` for Sanduqkin `1.0.0` Build 7. The claimant programme is now `GO` for full engineering implementation and production-readiness work using synthetic data and disabled-by-default capabilities. Build and test the complete registered-recipient journey first, then the safe V2 code journey, in small reviewed slices. External claimant access, real claimant data, deployment, production activation, public App Store release, and administrative/provider changes remain `NO-GO` until their launch gates pass.

## Repository Snapshot

- Active branch: `codex/claimant-submission-controller`; Slice 2I is checkpointed at local head `f8935c2`, and Slice 2J is code-complete in the uncommitted local working tree. The branch is based on Slice 2H checkpoint `0215f30` after Slice 2G checkpoint `4e4d5c5`, Slice 2F checkpoint `9b59916`, and PR #65 merge `dcd6fefee4c527a4e0eceff54fed59e1f240f746`.
- PR #65 merged the owner-accepted native-enrollment review closure/remediation, hard-disabled Slices 1D-1H, Expo/dependency alignment, the bounded `image-size` security patch/exception, and Android smoke stabilization. It made no claimant deployment, hosted migration, TestFlight action, or production activation.
- Closed review branch: `codex/claimant-synthetic-journey`; PR #54 merged after final protected CI passed.
- Build 7 source at candidate dispatch: `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` (PR #56). Local `main` remains at PR #59 merge `887abd0459197c5123b8972e1b8c5bed14ec5528`; local-tracking `origin/main` is PR #65 merge `dcd6fefee4c527a4e0eceff54fed59e1f240f746`. The active claimant branch contains the later local Slice 1I-2I checkpoints and has not been pushed in this session.
- PR #52 merged the claimant Slice 2 review package and divorce-certificate correction; PR #53 merged the biometric Settings repair.
- Preserve unrelated local-only items such as `.codex-runtime/`.

## Verified Product State

### Mobile owner vault

- App version is `1.0.0`; Build 7 was built and uploaded to App Store Connect from `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` by protected workflow run `30830865138` on 2026-08-03. EAS build ID: `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- Build 6 did not complete the iOS release gate because its `Biometric unlock` status/card was non-interactive. PR #53 merged the discoverable, accessible enable/disable action; Build 7 contains the repair.
- On 2026-08-04, Shahbaz Malik reported that Apple processing completed and the App Store Connect export-compliance answer was approved. The exact legal classification/value is not inferred or reproduced.
- The underlying flow is implemented: enablement authenticates before caching the MEK, lock-screen restoration uses one authenticated SecureStore read, stale remote restoration requires a live Supabase session, and password fallback remains available.
- Android emulator evidence passed. Shahbaz Malik reported that the complete requested value-free Build 7 physical-iPhone regression passed, including Face ID enablement, `Lock` -> `Unlock`, background lock, cancel/error handling, password and expired-session fallbacks, returning-user recovery, and the owner-flow navigation/readiness checks.
- Marriage and divorce certificate values exist in the encrypted Document Locations registry and automated tests. Shahbaz Malik reported that corrected divorce-certificate encrypted create/edit/reload/delete persistence and cleanup passed during the Build 7 regression.

### Owner web vault and public site

- Mobile and web share the same Supabase identity, `vault_key_material`, `vault_assets`, envelope format, and 17-category validation registry.
- The protected owner web vault is implemented locally but not deployed.
- The hosted web preview is static and protected; it has no production domain or Supabase environment variables.
- The existing owner-vault Hono API/processor is deployed in Vercel `fra1` at `https://sanduqkin-api.vercel.app`; no claimant runtime is present and the intended `api.sanduqkin.com` host is not approved or attached. Inventory this existing public ingress under `EDGE-01` before any custom-domain attachment, expanded external use, or claim-related use.
- Public legal content remains a draft. Do not publish until `apps/web/LEGAL_CONTENT_REVIEW.md` is resolved and owner/counsel approval is recorded.

### Claimant work

- `/claim` is currently informational only. Authentication, intake, evidence, review, notifications, release, and claimant decryption are not yet wired as a complete runtime journey.
- Synthetic Slices 1-17 and the end-to-end acceptance suite are complete locally. All seven synthetic preview surfaces remain read-only, non-indexed, runtime-disconnected, and based only on deterministic fixtures.
- Product-owner direction now authorizes production-shaped claimant engineering with synthetic data, hard-disabled external capabilities, and no deployment. Legal/privacy, security, operations, native custody, and independent approvals remain launch gates.
- Shahbaz Malik is the provisionally designated operator/data controller candidate. Incorporation, legal confirmation, controller contact details, and the processor map remain incomplete, so no real claimant data may be collected.
- `CLAIM_HANDOFF.md` is authoritative for claimant engineering scope, implementation order, production-readiness definition, and launch stop gates.
- PR #54 did not build the production integration. The new owner decision authorizes that engineering backlog in small reviewed code slices; it does not authorize external activation.
- The current code-readiness audit is `docs/superpowers/specs/2026-08-04-claimant-code-readiness-gap-matrix.md`. Phase 0 Slice 1 implements the canonical API's disabled-by-default runtime control plane and startup validation; it mounts no claimant route and changes no external state.
- Phase 1 Slice 1 implements the local default-deny registered-recipient schema and hostile database/RLS coverage. Four server-only tables enforce single-use invitations, claimant-bound public keys, and composite case binding. No API route is mounted and hosted Supabase is unchanged.
- Phase 1 Slice 2 implements the local service-only mutation boundary: transactional invitation issue/acceptance, idempotency, append-only audit, and value-free outbox records. Replay, stale-version, changed-input, digest, self-acceptance, private-key, partial-failure, catalog privilege, and hostile RPC checks pass. No API route is mounted and hosted Supabase is unchanged.
- Phase 1 Slice 3 mounts the local protected issue/accept API boundary behind disabled-by-default capabilities. Supabase bearer verification derives actors server-side; exact origin/CORS/content-type/idempotency/body limits, strict request/response allowlists, replay propagation, and error redaction have hostile coverage. The endpoints return `404` while disabled; hosted Supabase and external runtime are unchanged.
- Phase 1 Slice 4 adds strict Supabase session-claim verification, fresh timestamped AAL2 enforcement, bounded recovery restrictions, and service-only activation/displacement/assertion/revocation persistence. Issue/accept requires the verified active session; 62 API and 61 static security tests pass. All endpoints remain concealed while disabled and hosted Supabase is unchanged.
- Phase 1 Slice 5 completes the local registered-recipient lifecycle API: case-scoped second-device enrollment, replacement/revocation, pending-invitation revocation, strict two-key V2 ciphertext-grant owner finalization, and automatic grant/finalization invalidation after key change. All 68 API and 64 static security tests pass; clients, hosted Supabase, and external runtime remain unchanged.
- Phase 2 Slice 1A must add an explicit server-owned claimant-portal eligibility decision and context-bound session authority. Supabase authentication/AAL2 alone is not a claimant role, and the existing user-keyed session control shared by owner and claimant mutations is not proof of cross-mode isolation.
- The first Slice 1A boundary sub-slice now implements that eligibility/context split, three default-deny portal tables, three service-only portal-session functions, exact claimant-host concealment, protected response headers, and hostile role/origin/session tests. Client sign-in/MFA/session lifecycle wiring and disposable-stack replay remain incomplete; see `docs/verification/2026-08-04-claimant-portal-session-boundary.md`.
- Hosted claimant Supabase MFA client work is owner-parked while the project remains on the Free plan. Existing AAL2 enforcement remains intact; paid-plan hosted MFA and production-shaped session verification block external access and final readiness. Runtime-disconnected Slices 1B/1C and their owner-accepted 2026-08-12 adversarial review are complete.
- The first Slice 1B contract increment is complete and runtime-disconnected. Strict shared validation covers the iOS Secure Enclave capability, challenge request/response, possession proof, server-derived identity/address boundary, prohibited private material, and cross-object bindings. No live route, database state, native production alias, or invitation acceptance was added; see `docs/verification/2026-08-04-native-enrollment-contract.md`.
- The second runtime-disconnected Slice 1B increment freezes the exact P-256 ECDH/HKDF/HMAC transcript, deterministic vector and hostile binding mutations, plus server-derived invitation normalization/keyed-index and server-ephemeral rules. Full shared/mobile/web/API/shared-validation tests, all typechecks, lint, and security/isolation checks pass. No runtime was added; see `docs/verification/2026-08-04-native-enrollment-possession-proof-review-pack.md`.
- The 2026-08-12 adversarial review reproduced both frozen aggregates and all 25 files, added 15 findings, and was explicitly accepted by the owner as closing the Slice 1B/1C review gate. The remediation uses opaque challenge bytes, server-side fingerprint/point validation, separated address-key custody, iOS 27+ Apple extensions, lifecycle notifications/cool-off, and stricter protocol validation. Runtime slices still require their own implementation evidence.
- Runtime-disconnected Slice 1C defines the strict App Attest bindings and passed the owner-accepted review gate. Separate native/server runtime evidence remains required; see `docs/verification/2026-08-04-app-attest-contract.md` and the 2026-08-12 review closure.
- Slice 1D native App Attest adapter code is complete locally and remains hard-disabled. Only its dedicated iOS 27 probe profile receives a development entitlement; all native operations also require its exact bundle ID. Opaque challenge bytes are hashed without reserialization, output is allowlisted/value-free, and no server/runtime route exists. Native compile and physical-iPhone evidence remain pending separate Apple/EAS authorization; see `docs/verification/2026-08-12-claimant-slice-1d-native-app-attest-adapter.md`.
- Slice 1E server App Attest verifier/persistence code is complete locally, unmounted, and default-deny. It implements strict CBOR/DER, offline caller-pinned Apple-root chain/nonce trust, mandatory iOS 27 extension validation, assertion signatures/counters, forced-RLS storage, and locked idempotent mutations. Local hostile/database/security checks pass; Apple-issued fixture/native integration and independent Apple review remain pending. See `docs/verification/2026-08-12-claimant-slice-1e-server-app-attest-verifier.md`.
- Slice 1F native-enrollment challenge/acceptance code is complete locally, unmounted, and default-deny. It adds canonical single-use challenge state, encrypted context-bound server ephemeral-key custody, native ECDH/HKDF/HMAC verification, exact stored-transcript orchestration, and one atomic invitation/key/case/App-Attest-counter/audit/outbox transaction with hostile rollback/replay tests. No HTTP route or hosted change exists. See `docs/verification/2026-08-12-claimant-slice-1f-native-enrollment-transaction.md`.
- Slice 1G native-enrollment controller code is complete locally and mounted but concealed by an immutable compile-time approval set to `false`. Its enabled path derives all identity/address/eligibility/invitation/App-Attest/device/policy/configuration authority server-side, requires fresh AAL2 and strict HTTP boundaries, applies forced-RLS per-account throttling, and calls only Slice 1E/1F. Disabled requests return `404` before configuration/CORS. No hosted or external change exists. See `docs/verification/2026-08-12-claimant-slice-1g-native-enrollment-controller.md`.
- Slice 1H mobile transport/coordinator code is complete locally, immutable-false, and runtime-disconnected. It validates canonical server transcripts/cross-bindings, sends no client authority, orchestrates only injected production-shaped adapters, cleans up keys before finalization failure, and preserves keys for reconciliation after ambiguous final commit. Disposable probe aliases remain isolated. See `docs/verification/2026-08-12-claimant-slice-1h-mobile-enrollment-coordinator.md`.
- Slice 1I encrypted enrollment-attempt persistence and server-authoritative reconciliation are code-complete locally and remain immutable-false/runtime-disconnected. The bounded XChaCha20-Poly1305 record retains only exact identifiers/digests and a key alias; final recovery serializes against acceptance before any key deletion. Tamper, cross-account, expiry, cancellation, replay, race, and role-denial coverage pass. See `docs/verification/2026-08-12-claimant-slice-1i-enrollment-attempt-reconciliation.md`.
- Slice 1J adds a hard-disabled, runtime-disconnected production-shaped native adapter contract and lifecycle composition root. It keeps probe APIs/aliases isolated, validates exact App Attest/custody output, computes canonical request digests, prevents concurrent enrollment, and reconciles ambiguous finalization before session teardown can delete custody. Actual production Swift methods, entitlements, direct native binding, and Apple evidence remain separate gates. See `docs/verification/2026-08-12-claimant-slice-1j-native-lifecycle-adapters.md`.
- Slice 2A adds an unmounted, immutable-false claim-intake/checklist service with forced-RLS service-only persistence and an atomic idempotent `draft` to `identity_pending` transition. It binds the active claimant portal session, identity, case key, case version, claimant, and synthetic policy version, and stores only bounded routing facts plus server-selected checklist rows. No route, binary upload, document metadata, hosted migration, or external behavior exists. See `docs/verification/2026-08-12-claimant-slice-2a-intake-checklist-foundation.md`.
- Slice 2B adds an unmounted, immutable-false evidence-preparation boundary. Append-only metadata revisions are bound to the active claimant portal session, identity, key, case/checklist, policy, and intake version. Only synthetic placeholder references, media type, size, claimed preparation time, or unavailable declarations persist; prepared metadata leaves checklist availability `pending`, does not transition the case, and cannot claim upload, receipt, scanning, or review readiness. See `docs/verification/2026-08-12-claimant-slice-2b-evidence-preparation-metadata.md`.
- Slice 2C adds an unmounted, immutable-false private evidence-quarantine foundation. It defines a private bounded bucket with deny-all client Storage policies, server-keyed replay-stable five-minute upload capabilities, strict inspection/scanner contracts, service-only lifecycle persistence, legal-hold-aware retention, and storage-before-confirmation deletion. It does not mount an upload route, stream bytes, select a provider, or deploy Storage/migrations. See `docs/verification/2026-08-12-claimant-slice-2c-private-quarantine-foundation.md`.
- Slice 2D adds an unmounted, immutable-false streaming upload/reconciliation processor. It bounds chunks/total bytes/time, hashes while streaming, requires exact inspection, persists quarantine before scanning, records scanner outages fail closed, preserves committed objects after ambiguous responses, and atomically revokes unconsumed capabilities before orphan deletion. Storage, inspector, and scanner remain injected interfaces. See `docs/verification/2026-08-12-claimant-slice-2d-upload-processor.md`.
- Slice 2E mounts three upload-control paths behind an immutable-false concealment gate. The enabled test path enforces exact API/portal origins, fresh AAL2, active portal context, strict operation-specific CORS and headers, mandatory bounded content length, server-derived processor/idempotency authority, database preflight, bounded claimant-case concurrency, and generic failures. Exact-fixture synthetic adapters are disabled and never wired by the API entrypoint. See `docs/verification/2026-08-12-claimant-slice-2e-upload-controller.md`.
- Slice 2F adds an immutable-false, runtime-disconnected web upload coordinator using injected transport and synthetic prepared bytes only. It binds exact metadata, validates capabilities/progress/results, reconciles ambiguous completion, retains only memory-scoped pending authority, and is statically isolated from network, persistence, file, provider, and normal runtime wiring. See `docs/verification/2026-08-12-claimant-slice-2f-upload-client-coordinator.md`.
- Slice 2G adds an immutable-false, runtime-disconnected dashboard read-model coordinator. Injected responses must be exact coherent safe-projection triplets bound to one case/version; private fields, future/precise dates, stale rollback, same-version divergence, and cross-case substitution fail closed. Accepted state is memory-only and deeply frozen. See `docs/verification/2026-08-12-claimant-slice-2g-dashboard-read-model-coordinator.md`.
- Slice 2H adds a hard-disabled, unmounted submission/safe-acknowledgement transaction. It reasserts server-owned portal, current-key, case/intake/latest-preparation, checklist, consumed capability, and clean evidence-object authority before atomically advancing only to `submitted` and writing an append-only safe receipt, value-free audit/outbox records, and idempotency result. Review and release remain false. See `docs/verification/2026-08-12-claimant-slice-2h-submission-acknowledgement-transaction.md`.
- Slice 2I mounts that transaction behind an independent immutable-false controller. It conceals disabled requests before configuration/CORS and, in test-only enabled operation, requires exact HTTPS API/claimant origins, JSON and bounded body, UUIDv4 route/idempotency binding, bearer-derived fresh AAL2 without recovery, an active claimant portal session, and bounded claimant-case concurrency. Only the safe acknowledgement is returned; failures remain generic and notifications stay disconnected. See `docs/verification/2026-08-12-claimant-slice-2i-submission-controller.md`.
- Slice 2J adds an immutable-false, runtime-disconnected web submission coordinator. It strictly validates the synthetic request and safe acknowledgement, owns one stable UUIDv4 attempt key, serializes work, keeps ambiguous or aborted dispatches only in memory for exact-key retry, retains no successful acknowledgement, and is statically isolated from normal runtime, direct networking, browser persistence, providers, notifications, and private/internal fields. See `docs/verification/2026-08-18-claimant-slice-2j-web-submission-coordinator.md`.
- The 2026-08-12 Vercel workspace-package failure is resolved. `@vault/shared-types` now emits a bundled Node runtime entry during install, keeps source type/React Native resolution, and has a Vercel function guard that verifies the manifest, runtime file, and actual import. Preview `dpl_C6PGm7FBQn4LTLhYXyJHe1vh8Kro` passed repeated `/health`, claimant concealment, hostile-origin, existing authorization, unknown-route, and zero-exception log checks. Production remains intentionally on healthy rollback `dpl_H7NXnWujWdcLd6coKrraDHe1N5gr`; no promotion occurred.
- The original review packet/ZIP remain preserved as historical evidence. The authenticated review and owner closure are recorded in `docs/verification/2026-08-12-native-enrollment-adversarial-pre-review.md` and `docs/verification/2026-08-12-native-enrollment-review-closure.md`; the remediated snapshot has a refreshed manifest/package.
- The hard-disabled iOS probe now compiles against the frozen transcript through a `probe-only.v3` Secure Enclave harness, strict public output validation, cleanup/fingerprint-continuity tests, and a separately isolated internal probe app. EAS Build 1 compiled successfully, and Shahbaz Malik reported the complete physical-iPhone authenticated pass, cancellation/cleanup, and retry matrix passed. Normal application runtime still has no probe import; see `docs/verification/2026-08-04-physical-iphone-custody-probe-build.md`.
- A separate value-free physical evidence coordinator is complete with exact non-production iOS/operator/passcode/capture preconditions, generic-only reports, native-error redaction, and no application entry point. It does not itself run on an iPhone; see `docs/verification/2026-08-04-physical-iphone-evidence-runner.md`.

## Non-Negotiable Boundaries

- Vault encryption and decryption remain client-side. Infrastructure stores ciphertext and approved metadata only.
- Never log or transmit plaintext vault fields, passwords, recovery phrases, raw MEKs, private keys, or complete emergency secrets.
- Claimant authentication, relationship, evidence, MFA, or code possession never authorizes release by itself.
- Claimants never receive a policy path to owner vault tables or another claimant's data.
- Public, owner, claimant, and API origins require explicit isolation before deployment.
- Claimant engineering may add production-shaped code, migrations, policies, adapters, and tests locally, but do not deploy the protected vault, attach production domains, change Supabase Auth globally, publish draft legal content, enable external claimant runtime, or use real claimant data without the recorded launch gates.
- Do not create a documentation-only or administrative-only commit, push, or pull request. Keep handoff/administrative updates local and bundle them only with the next separately authorized code change; this publishing rule does not authorize that code change or any external action.

## Next Actions

1. Review the local Slice 2J web submission coordinator and its evidence; checkpoint or publish only with explicit owner authorization.
2. Keep Slice 1G/1H/1I/1J/2A/2B/2C/2D/2E/2F/2G/2H/2I/2J hard-disabled and concealed, unmounted, or disconnected from normal app requests. Do not deploy the local claimant/Storage migrations or enable a claimant capability.
3. Treat production Swift App Attest/custody methods, production alias/entitlement configuration, direct native binding, compile, and physical Apple evidence as a separate reviewed native gate.
4. Begin Phase 3 with a hard-disabled, unmounted owner-protection persistence/transaction foundation for value-free owner-notice intent, provider-agnostic verified delivery, cooldown authority, invalidation/restart, and fail-to-hold cancellation/dispute/delivery behavior. Add no HTTP route, real notification provider, hosted migration, owner UI, real data, release predicate, or external behavior.
5. Continue afterward through checklist/evidence/dashboard, owner protection/review, encrypted release/native retrieval, and only then the offline-code V2 route.
6. The temporary `image-size` exception must be replaced by a compatible upstream fix or re-reviewed before it expires after 2026-09-30; it may not be broadened silently.
7. Keep Build 7 closed and passed; do not deploy, create another build, or initiate public App Store release without separate authorization.

## Current Launch Blockers

These items do not block local production-readiness engineering with synthetic data. They block external access, production activation, or collection of real data:

- Supabase Pro, backup/restore drill, single-session policy, JWT lifetime, and displacement testing before external protected-web use.
- Production owner/claimant origin decision and deployment review.
- Public legal approval.
- Transactional-email provider, operational ownership, second qualified security reviewer, and durable SBOM/license ownership.
- Legal confirmation of Shahbaz Malik as operator/data controller, contracting-entity and processor mapping, jurisdiction policy packs, evidence/retention rules, reviewer staffing, native custody proof, audit integrity, and independent assurance.

## Verification

### Claimant Slice 2J closing baseline on 2026-08-18

- All workspaces: 976 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks, zero-warning root lint, the unchanged 24-page production web build, and API bundle guard passed.
- Submission client/controller, dashboard client, upload client, repository security, GitHub Actions security, claimant-custody isolation, the focused static regression, and `git diff --check` passed.
- No deployment, hosted migration, configuration change, production promotion, notification, real file, or external claimant action occurred.

### Claimant Slice 2I closing baseline on 2026-08-12

- All workspaces: 969 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks, zero-warning root lint, the 24-route production web build, API bundle guard, and rollback-only submission database exercise passed.
- Controller isolation, repository security, GitHub Actions security, claimant-custody isolation, 31 combined static regressions, and `git diff --check` passed.
- No deployment, hosted migration, configuration change, production promotion, notification, real file, or external claimant action occurred.

### Build 7 owner-reported gate closure on 2026-08-04

- Apple processing completed successfully and the App Store Connect export-compliance answer was approved; no legal classification is inferred in this handoff.
- The complete requested value-free physical-iPhone regression passed, including the corrected divorce-certificate encrypted persistence and cleanup path.
- Result: controlled internal TestFlight mobile gate `PASS`. Public release and every other workstream remain separately gated.

### Owner-vault candidate on 2026-08-03

- Exact-main Security CI run `30828358898` passed the application security, CodeQL, ZAP, Android native compile, live Supabase/RLS, Android emulator, hosted Supabase integration, and iOS simulator jobs.
- Protected TestFlight workflow run `30830865138` passed, including release SBOM generation, EAS iOS production build, App Store Connect upload, and transient credential removal.
- Candidate evidence: Sanduqkin `1.0.0` Build 7; source `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- At the time, this was build/submission evidence only; the Apple processing/export-compliance and physical-iPhone items were subsequently closed by the 2026-08-04 owner evidence above.

### Claimant prototype acceptance on 2026-08-02

- Full web suite: 141 passed; shared claimant: 110 passed; shared validation: 42 passed.
- Formal-review remediation now enforces complete audit-input idempotency and case binding, validates canonical snapshot projections and evidence-preparation metadata, binds audit event types to transitions, and keeps synthetic review routes out of public navigation and the sitemap.
- All workspace typechecks, root lint, production web build, Phase 1, GitHub Actions security, static security/migration, mobile secret, and claimant isolation guards passed.
- The recursive contract isolation guard covers nested claimant modules. Live database attack/restore, physical native, TestFlight, and deployment gates were not run for the runtime-disconnected synthetic slice.

### Baseline recorded on 2026-08-01

- Focused mobile security/settings/certificate/custody tests: 27 passed.
- Shared validation tests: 42 passed.
- Inactive claimant web tests: 6 passed.
- Claim vectors, claimant-vector isolation, and claimant-custody isolation guards passed.
- Code inspection confirmed the Build 6 biometric interaction defect and the merged PR #53 repair; claimant capabilities and the custody probe remain hard-disabled.

For a release candidate, also run the repository verification matrix and the protected `iOS TestFlight release` workflow from `main`; record only value-free device/build/pass-fail evidence.
