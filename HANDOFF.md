# Sanduqkin Project Handoff

Last updated: 2026-09-03 (Asia/Dubai)

## Latest checkpoint — session close, 2026-09-03

This checkpoint and the current opener in `CLAIM_HANDOFF.md` supersede all older branch/PR snapshots and historical resume prompts below.

- Local Slice 5M branch: `codex/claimant-offline-code-v2-case-binding`, scaffold `af2fce3`, hardening `20b0d89`, verification/handoff checkpoint `f81516d`. 5M is implemented, literal-false, unmounted, and unpushed. Preserve these checkpoints; do not rebuild completed 5I-5M work.
- Previous 5M verification passed: hostile SQL/RLS, a genuine two-session race with one winner, 5L database acceptance, 1,265 workspace tests plus 3 established skips, all typechecks/lint/security/phase guards, and 78 serial script-test files. This is local evidence, not merged-baseline closeout.
- PR #68 is separate on `codex/claimant-offline-code-v2-controller` in `C:\Projects\GitHub\Sandoq Kin-pr68-watch`. Repair `88e88de` was pushed after `ff40766` and `6d47a23`. It fixes complete retrieval/delivery fixtures and the persistence test's obsolete RPC signatures, and adds CI fixture regressions; it changes no production grants, migrations, or flags.
- Last GitHub observation at session close (2026-09-03 around 11:05 Asia/Dubai): PR #68 OPEN, not merged, head `88e88de`. App security, CodeQL, ZAP, and GitGuardian passed; native and Supabase live gates were in progress. Refresh the latest head/checks before acting; this is not an all-green claim.
- PR repair verification passed on a clean PR-only local database: all nine downstream live DB gates, 236 serial script tests, standalone persistence, RLS attacks, catalog security, and security advisors. Source lint passed excluding only generated `supabase/.temp/**`; no lint config was weakened.
- IMPORTANT local state: `supabase_db_sanduqkin` was reset from the PR worktree for that repair. It currently has the PR-only schema, NOT the 5M migration. Docker availability must be rechecked; do not treat this database as the verified combined baseline.
- The existing ten-minute `watch-pr-68-checks` heartbeat remains ACTIVE and unchanged. It reports meaningful failures; after required checks pass and mergeability is confirmed, it merges, confirms the result, queues one baseline-first continuation in task `01a0623a-edeb-7c03-8ab0-0262693bcffd`, then deletes itself. Check for an already queued/running continuation; do not duplicate the watcher or work.
- Slice 5N (authenticated possession-to-case handoff) is conditionally authorized only AFTER PR #68 passes/merges AND safe integration plus clean 5L/5M acceptance/regressions pass. Bind possession to the exact authenticated claimant and active AAL2 session, short expiry, single use, safe retries, and server-derived authority. A public challenge ID alone is never authorization.
- Full closeout and copyable opener: `docs/handoff/2026-09-03-session-close.md`. Preserve `.codex-runtime/` and `.playwright-cli/` without inspection. No 5M/5N push/publication, hosted mutation, deployment, new native/EAS build, real claimant data, capability activation, or subagents are authorized.

## Current Decision

The controlled internal TestFlight mobile gate is `PASS` for Sanduqkin `1.0.0` Build 7. The claimant programme is now `GO` for full engineering implementation and production-readiness work using synthetic data and disabled-by-default capabilities. Build and test the complete registered-recipient journey first, then the safe V2 code journey, in small reviewed slices. External claimant access, real claimant data, deployment, production activation, public App Store release, and administrative/provider changes remain `NO-GO` until their launch gates pass.

## Repository Snapshot

- Active branch: `codex/claimant-offline-code-v2-database-acceptance`; Slice 5L is complete at `03570ca` on top of scaffold `4b32214`, refactor `2be9d71`, Slice 5K `1bc43c4`, and the earlier local claimant checkpoints. PR #68 remains separate at `18c6df6`, with fresh checks running under the merge watcher.
- PR #65 merged the owner-accepted native-enrollment review closure/remediation, hard-disabled Slices 1D-1H, Expo/dependency alignment, the bounded `image-size` security patch/exception, and Android smoke stabilization. It made no claimant deployment, hosted migration, TestFlight action, or production activation.
- Closed review branch: `codex/claimant-synthetic-journey`; PR #54 merged after final protected CI passed.
- Build 7 source at candidate dispatch: `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` (PR #56). Local `main` remains at PR #59 merge `887abd0459197c5123b8972e1b8c5bed14ec5528`; local-tracking `origin/main` is PR #65 merge `dcd6fefee4c527a4e0eceff54fed59e1f240f746`. The active claimant branch contains the later local Slice 1I-4J checkpoints through `49ee8a8` and has not been pushed in this session.
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
- For interim synthetic engineering, Shahbaz Malik is the accountable human test reviewer and Codex is a non-human technical review assistant/test actor. Codex may simulate distinct reviewer paths but cannot hold production credentials, approve a real claim, count as a human/independent reviewer, or authorize release. At least two qualified independent human reviewers remain a pre-live gate; see `docs/verification/2026-08-18-interim-reviewer-test-roles.md`.
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
- Slice 3A adds an immutable-false, unmounted owner-protection persistence/transaction foundation. Verified delivery alone starts a configurable cooldown; delivery uncertainty, dispute, material change, conflicting authority, and owner cancellation stop progress without review or release authority. The service-only functions use forced RLS, value-free events, strict idempotency, and exact case/cycle/version binding. Hosted verification passed inside a rollback-only transaction and left production unchanged. See `docs/verification/2026-08-18-claimant-slice-3a-owner-protection-foundation.md`.
- Slice 3B adds an immutable-false, unmounted owner-notice delivery coordinator with injected queue/provider contracts. First attempts dispatch only an opaque reference and stable key; retries use lookup only. Verified lookup alone creates delivery evidence, while failed/unknown/malformed lookup fails closed through Slice 3A. Persistence ambiguity replays the same key without redispatch. See `docs/verification/2026-08-18-claimant-slice-3b-owner-notice-delivery-coordinator.md`.
- Slice 3C adds a forced-RLS, service-only owner-notice delivery queue. It atomically persists stable keys before contact, leases one eligible outbox row, reclaims only expired leases without redispatch authority, and completes only after independently matching the exact Slice 3A protection result. Hosted rollback verification passed and left production unchanged. See `docs/verification/2026-08-18-claimant-slice-3c-owner-notice-delivery-queue.md`.
- Slice 3D mounts independently concealed owner-cancellation and claimant-dispute controllers. Each route constructs only its own session authority, derives the actor from verified claims, requires fresh AAL2 and active role context, supplies a fixed server-side reason, and returns only immutable non-review/non-release state. All approvals remain false; hosted Supabase and external runtime are unchanged. See `docs/verification/2026-08-18-claimant-slice-3d-owner-protection-controller.md`.
- Slice 3E adds an immutable-false, unmounted reviewer assignment/conflict/recusal foundation. Four forced-RLS tables and three service-only security-invoker transactions enforce separate synthetic reviewer identities, exact case/cycle/cooldown binding, two distinct active slots, owner/claimant related-party denial, append-only value-free events, locking, idempotency, stale-version checks, and safe reassignment. It adds no decision, approval count, release predicate, UI, or evidence access. See `docs/verification/2026-08-18-claimant-slice-3e-reviewer-assignment-foundation.md`.
- Slice 3F adds an immutable-false, unmounted independent-review foundation. Two append-only decisions must come from distinct current assignments and bind exact case/cycle/submission/intake/preparation/policy/checklist/clean-evidence versions. The second decision revalidates the first assignment and reviewer identity before producing only a blind aggregate. Two allows satisfy review approval but never update the case or authorize release. See `docs/verification/2026-08-18-claimant-slice-3f-independent-review-foundation.md`.
- Slice 3G adds an immutable-false, unmounted escalation/appeal foundation. Separate synthetic resolution authorities cannot overlap the owner, claimant, or reviewer identities. A locked, idempotent intervention atomically forces the review round to `held`, invalidates any two-person approval, preserves case cooldown, and keeps release false; appeal is limited to rejected or held rounds. See `docs/verification/2026-08-18-claimant-slice-3g-review-escalation-appeal-foundation.md`.
- Slice 4A adds an immutable-false, unmounted final release-authorization foundation. A distinct synthetic authorizer must revalidate current owner finalization, expired cooldown, exact two-allow review authority, no intervention, current policy/submission versions, and at least two active claimant keys with exactly matching recipient grants. The transaction advances only `cooldown` to `approved`; package creation and retrieval remain false. See `docs/verification/2026-08-18-claimant-slice-4a-release-authorization-foundation.md`.
- Slice 4B adds an immutable-false, unmounted encrypted-package preparation foundation. One locked service-only transaction revalidates the exact approved case, current final authorization, expired protection cycle, two-person round, synthetic authority, no intervention, every current claimant recipient grant/key version, and each selected active owner vault envelope. It persists an immutable unsigned 72-hour snapshot containing only existing ciphertext/nonce envelopes plus digests and authority bindings; the server never encrypts or decrypts. The case remains `approved`, while manifest signing and retrieval remain false. See `docs/verification/2026-08-18-claimant-slice-4b-encrypted-package-foundation.md`.
- Slice 4C adds an immutable-false, unmounted signed-manifest/package-finalization foundation. A separate synthetic non-live signing authority and versioned Ed25519 public key verify one frozen canonical `release-package:v1` manifest per current package grant. A locked service-only transaction rechecks the exact immutable 4B snapshot, authorization, package expiry, ordered ciphertext digests, all current grants/keys, signing authority/key, and absence of intervention before advancing only `approved` to `release_ready`. Retrieval remains false. See `docs/verification/2026-08-18-claimant-slice-4c-signed-manifest-foundation.md`.
- Slice 4D adds an immutable-false, unmounted retrieval-session authorization foundation. Verified Supabase identity/session claims and the existing fresh-AAL2 policy derive the claimant and authentication timestamp server-side. A locked service-only transaction requires the exact active claimant portal context and binds a maximum-15-minute `authorized_unserved` record to the current release-ready finalization, signed manifest, grant, and active key version. The case remains `release_ready`; package serving and retrieval completion remain false. See `docs/verification/2026-08-18-claimant-slice-4d-retrieval-session-foundation.md`.
- Slice 4E adds an immutable-false, unmounted encrypted-package delivery transaction/coordinator. Preparation consumes and revalidates one exact live Slice 4D authorization and returns only the frozen ciphertext envelopes, claimant-addressed encrypted grant, and signed manifest under an exact digest/byte/lease binding. Lookup is the sole complete-delivery authority and replay never redispatches. Only the first verified receipt records `package_served` and advances `release_ready` to `released`; retrieval completion stays false. See `docs/verification/2026-08-18-claimant-slice-4e-encrypted-package-delivery.md`.
- Slice 4F adds an immutable-false, runtime-disconnected mobile native-package open coordinator and adapter contract. It cross-binds the exact served ciphertext payload, canonical signed manifest, trusted Ed25519 key, case/package/session, grant, recipient key/version, ordered ciphertext digests and expiry before delegating verification/decryption to one injected native-shaped operation. JavaScript receives only an opaque local-open reference and value-free counts; export and server retrieval completion stay false. See `docs/verification/2026-08-18-claimant-slice-4f-native-package-open.md`.
- Slice 4G adds an immutable-false, unmounted verified retrieval-completion foundation. One locked service-only transaction consumes the exact served delivery plus a separately verified claimant-device/App-Attest native-open proof, advances the App Attest counter, and atomically records only retrieval completion with stable replay. The case remains released; export and closure remain false. See `docs/verification/2026-08-18-claimant-slice-4g-retrieval-completion.md`.
- Slice 4H adds an immutable-false, unmounted retrieval suspension/expiry foundation. One locked service-only transaction serializes against authorization, delivery and completion, then ends every future serving/retrieval authority while preserving whether a package was already served or opened. Served/completed states are explicitly unrecalled; local deletion, export and closure are never claimed. See `docs/verification/2026-08-18-claimant-slice-4h-retrieval-suspension-expiry.md`.
- Slice 4I adds a hard-disabled, runtime-disconnected native local-export coordinator and adapter contract. It requires exact active completed-open authority, explicit claimant intent, fresh native device-owner presence and confirmation, strict expiry/timing/cross-object bindings, and returns only an opaque value-free local-copy receipt. JavaScript/server plaintext, upload and closure remain false. See `docs/verification/2026-08-18-claimant-slice-4i-native-local-export.md`.
- Slice 4J adds an immutable-false, unmounted retrieval-lifecycle closure foundation. One service-only locked transaction requires exact served/opened completion authority and optional all-or-none separately verified export evidence, then appends administrative closure without rewriting case, delivery, session, completion, access-control, or local state. Historical facts remain preserved; local recall and deletion remain false. See `docs/verification/2026-08-18-claimant-slice-4j-retrieval-lifecycle-closure.md`.
- Slice 5A adds a hard-disabled, runtime-disconnected safe V2 offline-code shared protocol. It splits a non-secret checksummed locator from a 192-bit client-held secret, pins a synthetic-only KDF profile, domain-separates and binds proof/wrap derivations, fixes possession-only authority, rejects V1/malformed/weak/substituted inputs, and adds reproducible hostile vectors plus CI runtime-isolation enforcement. See `docs/verification/2026-08-19-claimant-slice-5a-offline-code-v2-protocol-foundation.md`.
- Slice 5B adds default-deny, service-only V2 locator/challenge persistence with keyed indexing, exact five-minute challenges, append-only proof facts, five-failure/fifteen-minute lockout, stable replay, expiry/revocation, and value-free events. It stores no complete emergency secret or private/decryption material; proof establishes route possession only. The boundary remains literal-false and unmounted. See `docs/verification/2026-08-19-claimant-slice-5b-offline-code-v2-persistence.md`.
- Slice 5C adds a literal-false enumeration-resistant challenge coordinator. It derives keyed boundary digests, consumes global/network/device/locator budgets before lookup, returns identical challenge/KDF schemas and replay semantics for active and unavailable records, and persists only real active-record challenges. It is reachable only through the immutable-false Slice 5E controller. See `docs/verification/2026-08-19-claimant-slice-5c-offline-code-v2-challenge-coordinator.md`.
- Slice 5D adds a literal-false proof-verification/attempt coordinator. It verifies the exact frozen Ed25519 transcript, cross-binds every proof field to canonical challenge bytes, records only bounded public proof facts through Slice 5B, returns one rejection for invalid real and unavailable synthetic challenges, and asserts possession-only authority on success. It is reachable only through the immutable-false Slice 5E controller. See `docs/verification/2026-08-30-claimant-slice-5d-offline-code-v2-proof-attempt-coordinator.md`.
- Slice 5E mounts strict challenge/proof HTTP paths behind a separate literal-false concealment gate. The enabled synthetic path requires exact origins/CORS/media/idempotency/body/path bindings, rejects Auth/Cookie identity input, derives domain-separated HMAC boundary digests only from an injected trusted-edge adapter, and fails before persistence when that adapter is absent. See `docs/verification/2026-08-30-claimant-slice-5e-offline-code-v2-controller.md`.
- Slice 5F adds a literal-false, runtime-disconnected mobile proof producer and bounded KDF benchmark harness. It reproduces the frozen Argon2id/HKDF/Ed25519 proof, rejects locator/record/origin/expiry/proof-key substitutions, wipes derived buffers, and cannot mark a KDF profile production-approved. The desktop reference is not representative physical-device evidence. See `docs/verification/2026-08-30-claimant-slice-5f-offline-code-v2-client-proof.md`.
- Slice 5G adds a literal-false physical KDF evidence runner with exact non-production physical-device, thermal, power, operator, synthetic-material, and value-free preconditions. It treats benchmark output as untrusted, emits only measured/invalid/runner-error evidence, and cannot approve production parameters. No device run occurred. See `docs/verification/2026-08-30-claimant-slice-5g-offline-code-v2-kdf-evidence.md`.
- Slice 5H adds an isolated internal-preview iOS/Android KDF probe router/profile with separate app identities. It executes the frozen five-sample synthetic benchmark through Slice 5G and displays aggregate value-free evidence only; normal app builds cannot import it. No EAS build or device run occurred. See `docs/verification/2026-08-30-claimant-slice-5h-offline-code-v2-kdf-probe-host.md`.
- Slice 5I is code-complete locally on `codex/claimant-offline-code-v2-mobile-coordinator`, based on Slice 5H `f8dce80`. The injected transport and mobile coordinator remain independently literal-false and runtime-disconnected; they validate the frozen synthetic KDF/challenge/proof bindings, support bounded identical public-proof retries, and return possession-only authority. No normal runtime, native binding, hosted state, build, deployment, or external activation changed. See `docs/verification/2026-08-31-claimant-slice-5i-offline-code-v2-mobile-coordinator.md`.
- Slice 5J is code-complete locally on `codex/claimant-offline-code-v2-mobile-lifecycle`, based on Slice 5I `60a8601`. Its independently literal-false lifecycle root composes the injected proof flow, cancels and clears retry state on background/inactive events, closes permanently on lock/session-end/kill-switch, rejects stale completions, and provides awaitable disposal with value-free snapshots. No normal runtime or native binding is added. See `docs/verification/2026-08-31-claimant-slice-5j-offline-code-v2-mobile-lifecycle.md`.
- Slice 5K is complete at local commit `1bc43c4` (`Add offline-code V2 mobile API acceptance`) on `codex/claimant-offline-code-v2-integration-acceptance`, based on Slice 5J `5b0fcdb`. Thirty synthetic in-process acceptance scenarios connect the actual mobile proof flow to the actual Hono controllers, server verifier, and transaction decoder, replacing only the database RPC. Lost-response retries, lifecycle cancellation after server acceptance, hostile bindings, and fail-closed output are covered. All existing runtime approvals remain literal false; no production implementation or native binding changed. This does not establish SQL/RLS, hosted, or physical-device correctness. See `docs/verification/2026-08-31-claimant-slice-5k-offline-code-v2-integration-acceptance.md`.
- Slice 5L is complete at `03570ca` on `codex/claimant-offline-code-v2-database-acceptance`. It replaces the final database double with disposable local Supabase/PostgREST/RPC acceptance and passes registration, possession, retry, concurrency, expiry, limiter, RLS-denial, and possession-only-output scenarios. Verification: 1,258 workspace tests with 3 established skips, 236 static/security tests, 30 focused integration scenarios, and all typecheck/lint/phase/security checks. See `docs/verification/2026-09-02-claimant-slice-5l-offline-code-v2-database-acceptance.md`.
- Hosted Supabase project `pxwtexjjttpgtairpepz` now contains the full 44-migration repository chain through Slice 5C. Hosted catalog and rollback tests prove forced RLS and zero client authority across 77 claimant tables and 54 claimant functions. One missing composite-key prerequisite was repaired, migration history was reconciled exactly, and direct execution of `rls_auto_enable()` was revoked. See `docs/verification/2026-08-19-hosted-claimant-migration-through-slice-5c.md`.
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

Use the current opener in `CLAIM_HANDOFF.md` and `docs/handoff/2026-09-03-session-close.md`. Resume implemented local 5M, preserve its checkpoints, and check whether the watcher already continued the task. 5N is conditionally authorized only after PR #68 passes/merges and the integrated 5L/5M baseline is reverified.

1. Follow the current PR #68 gate: pending means wait; red means diagnose only the failed gate and keep 5N paused; confirmed green/merged means safely integrate main and rerun clean local 5L/5M acceptance, concurrency, regressions, and security checks before 5N. The current disposable database is PR-only and lacks 5M. Do not duplicate repairs or completed work.
2. Keep Slice 1G/1H/1I/1J/2A-2J/3A-3G/4A-4J and 5A/5B/5C/5D/5E/5F/5G/5H/5I/5J hard-disabled and concealed, unmounted, or disconnected from normal app requests. Hosted schema presence, preview deployment, and mounted `404` routes grant no claimant capability.
3. Treat production Swift App Attest/custody methods, production alias/entitlement configuration, direct native binding, compile, and physical Apple evidence as a separate reviewed native gate.
4. For any separately authorized next slice, treat Shahbaz Malik as the accountable human test reviewer and Codex only as a non-human technical test actor. Preserve the generic unavailable response and add no discovery/enumeration leak, UI/evidence access, production KDF/native binding, hosted migration, real data, deployment, or external behavior.
5. Continue afterward through the safe V2 offline-code route without reintroducing V1 locator-only authority.
6. The temporary `image-size` exception must be replaced by a compatible upstream fix or re-reviewed before it expires after 2026-09-30; it may not be broadened silently.
7. Keep Build 7 closed and passed; do not deploy, create another build, or initiate public App Store release without separate authorization.
8. The PR #68 watcher reports meaningful red or merges when all required checks are green and the PR is mergeable. It grants no production-promotion, Supabase-mutation, scanner-suppression, or claimant-activation authority.

## Current Launch Blockers

These items do not block local production-readiness engineering with synthetic data. They block external access, production activation, or collection of real data:

- Supabase Pro, backup/restore drill, single-session policy, JWT lifetime, and displacement testing before external protected-web use.
- Production owner/claimant origin decision and deployment review.
- Public legal approval.
- Transactional-email provider, operational ownership, second qualified security reviewer, and durable SBOM/license ownership.
- Legal confirmation of Shahbaz Malik as operator/data controller, contracting-entity and processor mapping, jurisdiction policy packs, evidence/retention rules, reviewer staffing, native custody proof, audit integrity, and independent assurance.

## Verification

### Claimant Slice 5K closing baseline on 2026-08-31

- Slice 5K is complete at local commit `1bc43c4` (`Add offline-code V2 mobile API acceptance`) on `codex/claimant-offline-code-v2-integration-acceptance`, based on Slice 5J `5b0fcdb`. Thirty synthetic in-process acceptance scenarios connect the actual mobile proof flow to the actual Hono controllers, server verifier, and transaction decoder, replacing only the database RPC. Lost-response retries, lifecycle cancellation after server acceptance, hostile bindings, and fail-closed output are covered. All existing runtime approvals remain literal false; no production implementation or native binding changed. This does not establish SQL/RLS, hosted, or physical-device correctness.
- Workspace tests: 1,258 passed, with 3 established mobile skips. Static/security tests: 234 passed. All typechecks, zero-warning lint, web build (24 static pages), API bundle, vectors/custody, and isolation checks passed. Evidence: `docs/verification/2026-08-31-claimant-slice-5k-offline-code-v2-integration-acceptance.md`.
- PR #68 remains open at `47a3322`; both Supabase live-security checks and GitGuardian still fail. The watcher file remains absent and monitoring is unconfirmed; no watcher change or fresh preview smoke is claimed.

### Claimant Slice 5J closing baseline on 2026-08-31

- Slice 5J is code-complete locally on `codex/claimant-offline-code-v2-mobile-lifecycle`, based on Slice 5I `60a8601`. Its independently literal-false lifecycle root composes the injected proof flow, cancels and clears retry state on background/inactive events, closes permanently on lock/session-end/kill-switch, rejects stale completions, and provides awaitable disposal with value-free snapshots. No normal runtime or native binding is added.
- Workspace tests: 1,228 passed with 3 established environment-gated mobile skips. Static/security suite: 234 passed. All typechecks, zero-warning lint, unchanged 24-page web build, API bundle, deterministic vectors/custody, and isolation guards passed. Evidence: `docs/verification/2026-08-31-claimant-slice-5j-offline-code-v2-mobile-lifecycle.md`.
- Latest read-only PR #68 refresh during Slice 5J: head remains `47a3322`; both Supabase live-security checks and GitGuardian still fail, while native, push emulator/hosted-integration, App Security, CodeQL, ZAP, and Vercel checks pass. The watcher automation file is now absent; active monitoring cannot be confirmed. The owner was informed, and no watcher was recreated or modified. No fresh preview smoke result is claimed.

### Claimant Slice 5I closing baseline on 2026-08-31

- Slice 5I is code-complete locally on `codex/claimant-offline-code-v2-mobile-coordinator`, based on Slice 5H `f8dce80`. The injected transport and mobile coordinator remain independently literal-false and runtime-disconnected; they validate the frozen synthetic KDF/challenge/proof bindings, support bounded identical public-proof retries, and return possession-only authority. No normal runtime, native binding, hosted state, build, deployment, or external activation changed.
- All workspaces: 1,195 tests passed; 3 established environment-gated mobile tests skipped. Static/security suite: 231 passed. All typechecks, zero-warning lint, unchanged 24-page web build, API bundle, deterministic vectors/custody, and isolation guards passed.
- Read-only PR #68 refresh on 2026-08-31: head remains `47a3322`; native compile/simulator checks and push emulator/hosted integration now pass, while both Supabase live-security checks and GitGuardian remain failed. The watcher is ACTIVE and its latest inspected turn was interrupted/idle. Direct staging health returned a deployment-protection 302, so no fresh health or concealment pass is claimed.
- Evidence: `docs/verification/2026-08-31-claimant-slice-5i-offline-code-v2-mobile-coordinator.md`.

### PR #68 watcher checkpoint on 2026-08-30

- Watcher remediation commits on the PR branch are `a05896c` (portable native-enrollment fetch-mock typing), `2277950` (Expo SDK-compatible patch alignment), and `47a3322` (npm 11.4.2-compatible lock synchronization). These commits were made in an isolated worktree and did not disturb local Slice 5H.
- At handoff capture, both App Security jobs, CodeQL, the OWASP ZAP retry, and both Vercel preview deployments passed. The explicit staging deployment remained Ready; `/health` returned healthy and both offline-code V2 challenge/proof POST paths returned concealed `404` responses without trusted-edge injection.
- Android/iOS jobs were still running and both Supabase live-security jobs had failed for watcher investigation. GitGuardian remained blocked on two deterministic synthetic-vector findings that require an owner dashboard false-positive decision; no repository scanner exclusion or weakened gate was added.

### Claimant Slice 5H closing baseline on 2026-08-30

- All workspaces: 1,143 tests passed; 3 established environment-gated mobile tests skipped.
- All typechecks, zero-warning lint, unchanged 24-page web build, API bundle, security, deterministic vectors/custody, and Slice 5H isolation checks passed.
- No EAS build, physical-device run, or production KDF approval occurred.

### Claimant Slice 5G closing baseline on 2026-08-30

- All workspaces: 1,140 tests passed; 3 established environment-gated mobile tests skipped.
- All typechecks, zero-warning lint, unchanged 24-page web build, API bundle, security, deterministic vectors/custody, and Slice 5G isolation checks passed.
- No physical-device run or production KDF approval occurred.

### Claimant Slice 5F closing baseline on 2026-08-30

- All workspaces: 1,135 tests passed; 3 established environment-gated mobile tests skipped.
- All typechecks, zero-warning lint, unchanged 24-page web build, API bundle, repository/GitHub Actions security, deterministic vectors/custody, and Slice 5F isolation checks passed.
- Desktop reference Argon2id samples had median 86.27 ms and p95 116.38 ms; they do not constitute representative-device or production KDF approval.
- PR #68 and staging preview `dpl_C7hkpzPvTsatfXWtZJeqjNCFwdV1` are monitored by owner-requested watcher `watch-claimant-integration-delivery`; no production promotion or claimant activation occurred.

### Claimant Slice 5E closing baseline on 2026-08-30

- All workspaces: 1,131 tests passed; 3 established environment-gated mobile tests skipped.
- All typechecks, zero-warning lint, unchanged 24-page web build, API bundle, repository/GitHub Actions security, claim-vector/custody, and Slice 5A-5E isolation checks passed.
- Both HTTP paths are mounted but return `404` before configuration or dependencies because controller approval is literal false. No migration, hosted database/Auth/Storage/provider change, trusted-edge adapter, deployment, real data, or external behavior occurred.

### Claimant Slice 5D closing baseline on 2026-08-30

- All workspaces: 1,123 tests passed; 3 established environment-gated mobile tests skipped.
- All typechecks, zero-warning lint, unchanged 24-page web build, API bundle, repository/GitHub Actions security, claim-vector/custody, and Slice 5A-5D isolation checks passed.
- No migration, hosted database/Auth/Storage/provider change, route, deployment, real data, or external behavior occurred. Optional local Slice 5B/5C database replay was unavailable because Docker Desktop was not running; Slice 5D changes no SQL or database contract.

### Claimant Slice 5A closing baseline on 2026-08-19

- All workspaces: 1,108 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 210 passed serially; all typechecks, zero-warning lint, unchanged 24-page web build, shared/API bundles, vector/custody/offline-code isolation, GitHub Actions security, and `git diff --check` passed.
- No database, container, hosted migration, provider/configuration change, deployment, real data, or external behavior was involved.

### Claimant Slice 5C closing baseline on 2026-08-19

- All workspaces: 1,118 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 217 passed serially after hosted remediation; all typechecks, zero-warning lint, unchanged 24-page web build, shared/API bundles, vector/custody/protocol/persistence/challenge isolation, GitHub Actions security, fresh PostgreSQL 16 and hosted PostgreSQL 17 behavior/role denial, and `git diff --check` passed.
- The disposable local database container was removed. No hosted migration, provider/configuration change, deployment, real data, or external behavior occurred.

### Claimant Slice 4F closing baseline on 2026-08-18

- All workspaces: 1,065 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 176 passed serially; all typechecks, zero-warning lint, API bundle, custody/native-open isolation checks, GitHub Actions workflow guards, and `git diff --check` passed.
- No database migration or container was required. Both native-open approvals remain false, the feature is unmounted, and no production native package-opening method or plaintext/export path exists.

### Claimant Slice 4E closing baseline on 2026-08-18

- All workspaces: 1,051 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 170 passed serially; all typechecks, zero-warning lint, API bundle, custody/encrypted-delivery isolation checks, GitHub Actions workflow guards, and `git diff --check` passed.
- Standalone rollback-only hostile encrypted-delivery exercise passed against the already-cached generic PostgreSQL image. The exact temporary container was removed; no Supabase images were downloaded, hosted Supabase was unchanged, and retrieval completion stayed false.

### Claimant Slice 4D closing baseline on 2026-08-18

- All workspaces: 1,043 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 170 passed serially; all typechecks, zero-warning lint, unchanged 24-page web build, API bundle, custody/retrieval-session isolation checks, GitHub Actions workflow guards, and `git diff --check` passed.
- Standalone rollback-only hostile retrieval-session exercise passed against the already-cached generic PostgreSQL image. The exact temporary container was removed; no Supabase images were downloaded, hosted Supabase was unchanged, and package serving/retrieval completion stayed false.

### Claimant Slice 4C closing baseline on 2026-08-18

- All workspaces: 1,038 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 163 passed serially; all typechecks, zero-warning lint, unchanged 24-page web build, API bundle, custody/signed-manifest isolation checks, GitHub Actions workflow guards, and `git diff --check` passed.
- Standalone rollback-only hostile signed-finalization exercise passed against the already-cached generic PostgreSQL image. The exact temporary container was removed; no Supabase images were downloaded, hosted Supabase was unchanged, and package retrieval stayed false.

### Claimant Slice 4B closing baseline on 2026-08-18

- All workspaces: 1,033 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 155 passed serially; all typechecks, zero-warning lint, unchanged 24-page web build, API bundle, custody/encrypted-package isolation checks, GitHub Actions workflow guards, and `git diff --check` passed.
- Standalone rollback-only hostile package-preparation exercise passed against the already-cached generic PostgreSQL image. The exact temporary container was removed; no Supabase images were downloaded, hosted Supabase was unchanged, and manifest signing/retrieval stayed false.

### Claimant Slice 4A closing baseline on 2026-08-18

- All workspaces: 1,027 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 148 passed serially; all typechecks, zero-warning lint, unchanged 24-page web build, API bundle, custody/release-authorization isolation checks, and `git diff --check` passed.
- Standalone rollback-only hostile final-authorization exercise passed against the already-cached generic PostgreSQL image. The exact temporary container was removed; no Supabase images were downloaded, hosted Supabase was unchanged, and package creation/retrieval stayed false.

### Claimant Slice 3G closing baseline on 2026-08-18

- All workspaces: 1,021 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 141 passed serially; all typechecks, zero-warning lint, unchanged 24-page web build, API bundle, custody/intervention isolation checks, and `git diff --check` passed.
- Standalone rollback-only hostile intervention exercise passed against the already-cached generic PostgreSQL image. The exact temporary container was removed; no Supabase images were downloaded, hosted Supabase was unchanged, and no external behavior was added.

### Claimant Slice 3F closing baseline on 2026-08-18

- All workspaces: 1,015 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 135 passed serially; all typechecks, zero-warning lint, unchanged 24-page web build, API bundle, custody/isolation checks, and `git diff --check` passed.
- Standalone rollback-only PostgreSQL hostile review exercise passed without Supabase image downloads. Direct linked hosted discovery returned access-control 403; no hosted SQL or state change occurred.

### Claimant Slice 3E closing baseline on 2026-08-18

- All workspaces: 1,009 tests passed; 3 established environment-gated mobile tests skipped.
- Full static/security set: 129 passed serially; all typechecks, zero-warning lint, the unchanged 24-page web build, API bundle, custody/isolation checks, and `git diff --check` passed.
- Full disposable migration replay and rollback-only hostile reviewer exercise passed. The local stack and downloaded Supabase images were removed afterward; hosted Supabase, deployment state, and external behavior were unchanged.

### Claimant Slice 3C closing baseline on 2026-08-18

- All workspaces: 994 tests passed; 3 established environment-gated mobile tests skipped.
- Hosted rollback-only queue exercise, 12 focused API tests, 5 combined static regressions, all typechecks, zero-warning lint, unchanged web build, API bundle, security/isolation gates, and `git diff --check` passed.
- Post-test checks confirmed no claimant schema or queue remained and the owner vault was unchanged. No local Supabase images, deployment, provider call, notification, or external behavior occurred.

### Claimant Slice 3B closing baseline on 2026-08-18

- All workspaces: 990 tests passed; 3 established environment-gated mobile tests skipped.
- Eight focused API tests, one static regression, all typechecks, zero-warning lint, unchanged 24-page web build, API bundle, security/isolation gates, Security CI registration, and `git diff --check` passed.
- Slice 3B contains no migration or provider/network implementation. Hosted Supabase, Docker, deployment state, and external behavior remained unchanged.

### Claimant Slice 3A closing baseline on 2026-08-18

- All workspaces: 982 tests passed; 3 established environment-gated mobile tests skipped.
- All workspace typechecks, zero-warning root lint, the unchanged 24-page production web build, and API bundle guard passed.
- The hosted rollback-only database exercise, 6 focused API tests, 5 static regressions, repository/GitHub Actions security, existing claimant isolation gates, Security CI registration, and `git diff --check` passed.
- Hosted Supabase was unchanged after rollback; no local Supabase images remain; no deployment, migration-history entry, provider call, notification, real file, or external claimant action occurred.

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
