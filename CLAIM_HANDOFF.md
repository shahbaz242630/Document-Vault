# Sanduqkin Claimant Engineering Handoff

Last updated: 2026-08-18 (Asia/Dubai)

## Current Owner Decision

The claimant programme is now `GO` for engineering implementation and production-readiness work, but remains `NO-GO` for external access, real claimant data, production activation, or release.

Build, wire, integrate, and test the complete claimant journey before waiting for governance, compliance, staffing, or specialist launch approval. Engineering must use synthetic identities and documents, production-shaped local/test infrastructure, disabled-by-default capabilities, and independently operable kill switches. Governance and administrative closure are launch gates, not reasons to leave the product unbuilt.

Owner decision on 2026-08-04: hosted claimant Supabase MFA client work is parked while the project remains on the Free plan. Do not weaken or remove the existing fresh-AAL2 API/database enforcement. Continue later slices with synthetic verified AAL2 sessions and disabled runtime; Supabase plan approval plus hosted MFA enrollment/challenge/recovery and production-shaped verification are mandatory before external claimant access or final readiness sign-off.

This decision authorizes small, reviewed claimant code slices covering both intended routes:

1. Registered next of kin / registered recipient first.
2. The safe V2 offline-code route second.

It does not authorize the unsafe V1 code as a public claim locator. It also does not authorize provider accounts, DNS, hosting, production environment changes, deployment, TestFlight work, public App Store release, real notifications, real evidence, or real claimant data.

Interim reviewer decision on 2026-08-18: Shahbaz Malik is the accountable human test reviewer and Codex is the non-human technical review assistant/test actor for synthetic local/staging and separately authorized disabled production-shaped verification. Codex may simulate a second reviewer path for hostile testing but cannot satisfy a human approval, hold production credentials, review real evidence, authorize release, or count as independent assurance. Two qualified independent human reviewers remain mandatory before real claimant data or go-live. See `docs/verification/2026-08-18-interim-reviewer-test-roles.md`.

## Next Session Opener

1. Read `CLAIM_HANDOFF.md` first. Use `HANDOFF.md`, `SECURITY_HANDOFF.md`, and `MVP_HANDOFF.md` for wider product and launch context.
2. Resume from the completed Slice 4G branch on `codex/claimant-retrieval-completion`, based on Slice 4F `79a1d94`, Slice 4E `5122c6f`, Slice 4D `f0195fe`, Slice 4C `ef97a64`, Slice 4B `8d9d195`, and the earlier claimant checkpoints.
3. Preserve `.codex-runtime/` and `.playwright-cli/` exactly as unrelated untracked local state. Do not inspect for secrets unnecessarily, modify, delete, or stage them.
4. On 2026-08-12, the Vercel workspace-package failure was fixed with an explicit bundled `@vault/shared-types` runtime distribution plus a bundle/import guard. Preview `dpl_C6PGm7FBQn4LTLhYXyJHe1vh8Kro` passed repeated health, concealment, hostile-origin, authorization, unknown-route, and zero-exception log checks. Production remains deliberately on healthy rollback deployment `dpl_H7NXnWujWdcLd6coKrraDHe1N5gr`; no promotion was performed.
5. Phase 4 Slice 4G — verified retrieval completion — is complete locally. Its closing baseline is 1,076 passing workspace tests with 3 established mobile skips; 189 static/security tests, the cached-Postgres standalone rollback harness, typecheck, lint, build, bundle, and isolation checks passed. No hosted Supabase activity or production native method was required.
6. Keep Slice 1G server, Slice 1H mobile, Slice 1I persistence, Slice 1J adapter/runtime, Slice 2A through 2J, Slice 3A through 3G, and Slices 4A/4B/4C/4D/4E/4F/4G capability approvals immutable `false`; normal app requests remain concealed, unmounted, or runtime-disconnected.
7. Actual production Swift methods, aliases, entitlements, direct module binding, build, and physical Apple evidence require a separate reviewed native gate; do not reuse disposable probe aliases.
8. Begin Phase 4 Slice 4H: add an immutable-false, unmounted suspension/expiry foundation. Prevent future serving and retrieval authority after a current synthetic suspension or expiry, but never claim recall or deletion of already opened local plaintext; keep export and closure separate. Shahbaz Malik remains the accountable human test reviewer and Codex a non-human technical test actor only. Add no reviewer UI/evidence access, browser plaintext, server decryption, public/signed URL, production native binding, hosted migration, real data, deployment, export, closure, or external behavior.
9. Keep **Phase 2 Slice 1A** parked at the paid-plan gate. Its claimant-host, eligibility, and context-bound session foundation is complete; hosted Supabase sign-in/MFA/activation/restoration/sign-out is not.
10. Preserve the original and remediated review packages and the owner-accepted closure evidence. The review closes the design gate only; it is not launch approval.
11. Do not deploy, enable claimant capabilities, use real claimant identities/data/documents, change provider/DNS/Auth/Apple settings, or create another mobile build without exact authorization.
12. Keep handoff-only changes local and bundle them with the next separately authorized reviewed code change; do not publish a documentation-only commit.
13. The hourly claimant heartbeat was deleted at session close. Do not recreate monitoring unless the owner requests it.

### Phase 2 Slice 1A Exit Gate

- A pre-provisioned eligible synthetic claimant can sign in, complete approved MFA, activate exactly one context-bound server-owned claimant-portal session, reload safely, and sign out without entering an invitation or creating cryptographic key material.
- Valid but ineligible, owner-only, arbitrary, and ambiguous dual-role identities fail closed before claimant-portal session activation; a Supabase identity or AAL2 claim alone grants no claimant role.
- AAL1, recovery-only, stale, expired, malformed, displaced, and revoked sessions fail closed with safe copy and no sensitive error detail.
- Owner-vault, owner claimant-administration, and claimant-portal modes share no repositories, decrypted state, key aliases, navigation authority, or implicit role inheritance; session displacement behavior is explicit per context.
- Protected claimant routes are available only on the claimant test hostname, return private/`no-store`/`noindex` responses, and fail closed on public and owner hosts. Public claimant information routes remain unchanged and cannot call protected claimant APIs.
- Browser storage/cache inspection finds no private key, MEK/plaintext, invitation secret, evidence content, or release material.
- A value-free Phase 1 baseline manifest identifies the working-tree fingerprint, migration order/history, exact commands/results, and successful clean replay in a disposable local stack without altering the verified container.
- Focused web/API/browser tests and the full Phase 1 regression baseline pass before Slice 1A is recorded complete.

## Current Verified State

- PR #65, `Add hard-disabled claimant enrollment foundation`, merged Slices 1D-1H and the review closure/remediation at `dcd6fefee4c527a4e0eceff54fed59e1f240f746`. Its final protected matrix passed. No claimant deployment, hosted migration, TestFlight action, or production activation was performed.
- PR #65 also aligns Expo SDK dependencies, uses Expo's supported native-module export, upgrades remediable production dependencies, and applies a digest-verified `image-size` parser hardening patch. The temporary exception permits only `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`, fails closed for new advisories or patch drift, and expires after 2026-09-30; see `docs/dependency-security-exceptions.md`.
- PR #54 merged the closed synthetic claimant baseline at `aa84031be93b460c9addada6d2fb3b09286595de`.
- The original reviewed claimant implementation is `a21830487f38c1d6ee3771780be454da6f20b982`; its acceptance-record head is `8ce2b675cfe50d097049fb08d869d86a97da59ba`.
- Synthetic Slices 1-17 provide contracts, validation, deterministic vectors, projections, fixtures, read-only previews, audit modelling, scenario execution, and an end-to-end synthetic acceptance suite.
- All public `/claim` routes remain informational or deterministic engineering previews. Claimant authentication, persistence, uploads, notifications, review operations, release, retrieval, and decryption are not currently wired as a complete runtime journey.
- Claimant web capability flags and `CLAIMANT_CUSTODY_PROBE_ENABLED` remain false.
- Sanduqkin `1.0.0` Build 7 was produced from `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- On 2026-08-04, Shahbaz Malik reported successful Apple processing, approval of the App Store Connect export-compliance answer, and a complete passing value-free physical-iPhone regression. The controlled internal TestFlight mobile gate is `PASS`; public release remains separately gated.
- The existing owner-vault Hono API/processor is deployed at `https://sanduqkin-api.vercel.app` in Vercel `fra1`. It has no claimant runtime. Any claimant deployment or expanded external use remains separately gated and must be included in `EDGE-01`.
- The 2026-08-04 code-readiness audit is recorded in `docs/superpowers/specs/2026-08-04-claimant-code-readiness-gap-matrix.md`. Phase 0 Slice 1 adds a canonical API startup-validated claimant capability graph with a master shutdown, independent kill switches, fail-closed dependency propagation, strict flag parsing, and an absolute production activation lock. No claimant route is mounted.
- Phase 0 Slice 1 verification: 39 API tests passed, API typecheck passed, focused ESLint passed, claimant vector and custody isolation passed, and the repository security guard passed.
- Phase 1 Slice 1 adds the default-deny registered-recipient database foundation: claimant identities, expiring single-use invitations with address digests only, public device keys that reject private JWK material, and cases bound to the accepted invitation/owner/claimant/key tuple. Forced RLS, explicit deny-all client policies, zero client grants, catalog enforcement, live invariant tests, and hostile REST tests pass. No claimant endpoint is mounted and hosted Supabase is unchanged.
- Phase 1 Slice 2 adds service-only idempotency, append-only audit, value-free outbox, and transactional invitation issue/accept functions. Replay, changed-input, stale-version, digest mismatch, self-acceptance, private-key, and partial-failure paths are tested in rollback-only local transactions; anonymous and authenticated RPC access is blocked. No claimant endpoint is mounted and hosted Supabase is unchanged.
- Phase 1 Slice 3 mounts a disabled-by-default protected API boundary for those mutations. It verifies Supabase bearer sessions, derives owner/claimant actors server-side, enforces exact allowlisted origin/CORS/content-type/idempotency/body and strict request/response schemas, and redacts database failures. All 49 API tests pass; the endpoints remain concealed while disabled and no external runtime or hosted Supabase state changed.
- Phase 1 Slice 4 adds fresh AAL2 enforcement and server-owned session activation, displacement, assertion, and revocation. Nine claimant tables and five claimant/session RPCs remain client-inaccessible; recovery/AAL1/stale/expired/future/unknown assurance and displaced/revoked sessions fail closed. All 62 API and 61 static security tests pass; hosted Supabase and external runtime remain unchanged.
- Phase 1 Slice 5 completes the registered-recipient platform API: case-scoped second-device enrollment, replacement/revocation, pending-invitation revocation, two-key V2 ciphertext-grant finalization, and automatic invalidation/re-finalization after key change. Eleven tables remain default-deny; all 68 API and 64 static security tests pass. No client UI, hosted migration, or external runtime was activated.
- Phase 2 Slice 1A boundary sub-slice adds three more default-deny tables for synthetic portal eligibility, claimant-portal-specific session control, and append-only value-free portal session events. Three service-only functions enforce eligibility before context-bound activation/assertion/revocation. Protected `/claimant/**` routes are concealed unless a non-production web capability and exact claimant hostname are both approved; public `/claim/**` remains unchanged. The API has 73 passing tests, the static security set has 67, focused host/config/header/page tests pass, live catalog/RLS/portal database checks pass, and all workspace typechecks/lint pass. The full client sign-in/MFA flow and clean disposable-stack replay remain incomplete. Evidence: `docs/verification/2026-08-04-claimant-portal-session-boundary.md`.
- Phase 2 Slice 1B contract increment defines strict iOS Secure Enclave native enrollment capability, public-key challenge request, server challenge, and possession-proof bindings. Runtime validators reject Android/software custody, private material, raw/client-asserted address or identity/role/eligibility/acceptance fields, and altered cross-object bindings. Shared, mobile, web, and API consume one deterministic fixture with all runtime flags false; 113 shared, 409 mobile, 149 web, and 74 API tests pass. No live route, database, native production alias, or invitation acceptance was added. Evidence: `docs/verification/2026-08-04-native-enrollment-contract.md`.
- The second runtime-disconnected Slice 1B increment freezes the exact domain-separated P-256 ECDH/HKDF-SHA-256/HMAC-SHA-256 possession transcript and a reproducible synthetic vector. The challenge now binds server-derived claimant, invitation/version, eligibility/version, policy/version, origin, issue/expiry, nonce, KDF salt, device digest, key/version/fingerprint, and server ephemeral key. Hostile tests mutate every bound field. Invitation bootstrap uses server-side `email-ascii-v1` normalization and a keyed HMAC address index; the Phase 1 client-supplied digest is explicitly insufficient for live production. Full shared/mobile/web/API/shared-validation tests, all workspace typechecks, lint, and security/isolation checks pass. No runtime was added. Evidence: `docs/verification/2026-08-04-native-enrollment-possession-proof-review-pack.md`.
- The internal adversarial Slice 1B review corrected exact-case email handling, canonical encodings, UUIDv4 locator validation, safe versions, the exact 300-second TTL, stable-reference transport, and the AES-256-GCM server-ephemeral profile. It added server-only normalization/keyed-index conformance and RFC 5869/off-curve tests. Production still requires independently approved App Attest binding, point validation, key management, delivery-token expiry/retention, and native adapter evidence. Evidence: `docs/verification/2026-08-04-slice-1b-internal-adversarial-review.md`.
- Slice 1C supplies the strict reviewed App Attest registration/assertion contract, deterministic vectors, and hostile consumers. The owner-accepted design-review gate is closed, and PR #65 supplies the later hard-disabled native/server/persistence/controller/mobile boundaries. Apple-issued end-to-end fixtures, physical production-adapter evidence, hosted integration, and activation remain required. Evidence: `docs/verification/2026-08-04-app-attest-contract.md` and `docs/verification/2026-08-12-native-enrollment-review-closure.md`.
- Phase 2 Slice 1D has a code-complete hard-disabled iOS App Attest adapter behind an exact isolated bundle-ID gate, a dedicated iOS 27 development-entitled build profile, opaque-byte hashing, device-only key-ID persistence, strict output allowlists, safe errors, and a value-free evidence coordinator/UI. PR #65's iOS simulator compile/launch jobs pass. Apple-issued App Attest objects and the dedicated physical-iPhone App Attest matrix remain pending exact external-action authorization, so production-native evidence is still open. Evidence: `docs/verification/2026-08-12-claimant-slice-1d-native-app-attest-adapter.md`.
- Phase 2 Slice 1E now has a code-complete, unmounted server verifier and default-deny persistence boundary. It strictly parses CBOR/DER, validates registration/assertion cryptographic bindings through an offline caller-pinned Apple-root adapter, enforces the iOS 27 bundle/category extensions and monotonic counters, and persists verified public state through service-role-only idempotent transactions. Local hostile/API/database/security checks pass. Apple-issued fixture/Slice 1D integration and independent Apple-side review remain required before any route. Evidence: `docs/verification/2026-08-12-claimant-slice-1e-server-app-attest-verifier.md`.
- Phase 2 Slice 1F now has a code-complete, unmounted native-enrollment transaction boundary. It generates and persists exact single-use registration/native/App-Attest challenges, seals the server ephemeral scalar under context-bound AES-256-GCM custody, verifies native ECDH/HKDF/HMAC possession plus Slice 1E App Attest evidence, and atomically consumes both challenges while accepting the invitation, creating the exact pre-bound claimant key/case, advancing the assertion counter, and appending audit/outbox state. Hostile and rollback tests pass. No HTTP route or external runtime exists. Evidence: `docs/verification/2026-08-12-claimant-slice-1f-native-enrollment-transaction.md`.
- Phase 2 Slice 1G now mounts the four native-enrollment controller operations behind an immutable compile-time approval set to `false`. The enabled path derives confirmed-address, claimant/session, eligibility, invitation, App Attest key/device, policy, and app authority server-side; enforces exact origin/schema/size/idempotency/fresh-AAL2 boundaries; and applies forced-RLS per-account throttling. Disabled requests are concealed before configuration or CORS. All 114 API tests and the live controller database test pass. Apple-native, hosted MFA, edge abuse, hosted migration, and activation gates remain open. Evidence: `docs/verification/2026-08-12-claimant-slice-1g-native-enrollment-controller.md`.
- Phase 2 Slice 1H adds a hard-disabled, runtime-disconnected mobile HTTPS transport and enrollment coordinator. It validates canonical server transcripts and cross-bindings, sends no client authority, orchestrates registration/native proofs through injected adapters, cleans up keys before finalization failures, and preserves keys after ambiguous final commit for reconciliation. It does not import or promote the disposable probe aliases, and normal mobile runtime cannot import it. All 439 mobile tests pass with 3 environment-gated skips. Evidence: `docs/verification/2026-08-12-claimant-slice-1h-mobile-enrollment-coordinator.md`.
- Phase 2 Slice 1I adds a hard-disabled encrypted mobile attempt store and service-only reconciliation boundary. It records only bounded identifiers, request digests, phase/expiry, and a non-secret key alias; final recovery asks server authority before deletion, while the database serializes reconciliation against acceptance and invalidates terminal non-commits. Full hostile mobile/API/database coverage passes. Production adapters and all activation gates remain open. Evidence: `docs/verification/2026-08-12-claimant-slice-1i-enrollment-attempt-reconciliation.md`.
- Phase 2 Slice 1J adds hard-disabled production-shaped App Attest/custody adapter contracts, canonical request digests, and a runtime-disconnected lifecycle composition root. Probe APIs/aliases fail isolation, concurrent operations are rejected, and ambiguous final submission is reconciled before session-teardown key deletion. Actual Swift production methods, entitlements, direct binding, and Apple evidence remain open. Evidence: `docs/verification/2026-08-12-claimant-slice-1j-native-lifecycle-adapters.md`.
- Phase 2 Slice 2A adds a hard-disabled, unmounted claim-intake/checklist persistence boundary. Two forced-RLS service-only tables and one transactional RPC require the active claimant portal session, exact case/claimant/policy/version binding, active identity/key, six bounded synthetic routing facts, all seven common checklist items, idempotency, and a locked `draft` to `identity_pending` transition with value-free audit. No route, upload, document metadata, hosted migration, or external runtime exists. Evidence: `docs/verification/2026-08-12-claimant-slice-2a-intake-checklist-foundation.md`.
- Phase 2 Slice 2B adds hard-disabled, unmounted, append-only evidence-preparation metadata persistence. It stores synthetic placeholder reference, allowlisted media type, bounded size, claimed preparation time, or an unavailable declaration; exact claimant/case/checklist/policy/version binding, active session/identity/key checks, version locking, idempotency, and value-free audit fail closed. Prepared metadata remains `pending`, never `available`, and never advances the case or claims upload/scan/receipt. Evidence: `docs/verification/2026-08-12-claimant-slice-2b-evidence-preparation-metadata.md`.
- Phase 2 Slice 2C adds a hard-disabled, unmounted private-quarantine foundation: one private 25 MiB bucket with deny-all client object policies; deterministic server-keyed, five-minute, one-time case-bound capabilities stored only as digests; bounded signature/type/size/PDF-page/expanded-size/archive-count validation; injected fail-closed scanner and Storage adapters; and service-only quarantine, scan, retention/legal-hold, and two-phase deletion transactions. No upload HTTP route, byte streaming implementation, real provider, hosted migration, or real evidence exists. Evidence: `docs/verification/2026-08-12-claimant-slice-2c-private-quarantine-foundation.md`.
- Phase 2 Slice 2D adds a hard-disabled, unmounted streaming upload/reconciliation processor. It enforces 25 MiB total, 1 MiB chunk, 30-second abort, exact case/object/path/type/size binding, streaming SHA-256, post-write inspection, quarantine-before-scan, fail-closed scanner persistence, server-authoritative ambiguity checks, and atomic capability abandonment before orphan cleanup. A committed object is never deleted after a lost response. No HTTP route, real parser/provider adapter, hosted change, or external behavior exists. Evidence: `docs/verification/2026-08-12-claimant-slice-2d-upload-processor.md`.
- Phase 2 Slice 2E mounts capability issue, raw upload, and reconciliation paths behind an immutable-false controller gate. The enabled test-only path requires the exact HTTPS API origin and claimant portal origin, bearer-derived fresh AAL2, an active claimant portal session, exact per-operation CORS/headers/content types, UUIDv4 idempotency, mandatory bounded `Content-Length`, database-authoritative capability/path/type/size preflight, and claimant-case concurrency. Processor actor and sub-operation idempotency are server-derived. Deterministic synthetic adapters accept only exact predeclared bytes and remain disabled and disconnected from the API entrypoint. No real parser/provider, hosted configuration, migration, real file, distributed edge control, or external access exists. Evidence: `docs/verification/2026-08-12-claimant-slice-2e-upload-controller.md`.
- Phase 2 Slice 2F adds an immutable-false, runtime-disconnected web upload coordinator with injected transport only. It binds exact synthetic placeholder/version/body metadata, validates capability/object/path/terminal responses, enforces monotonic bounded progress and single-flight work, and reconciles conflict, unavailable, or malformed completion before success. Only a capability/object tuple can survive in memory for explicit retry; no evidence bytes or capability enter browser persistence. Static isolation prohibits normal runtime imports, direct network/file APIs, provider SDKs, and object-storage endpoints. Evidence: `docs/verification/2026-08-12-claimant-slice-2f-upload-client-coordinator.md`.
- Phase 2 Slice 2G adds an immutable-false, runtime-disconnected dashboard read-model coordinator with injected transport only. It accepts only an exact coherent triplet of safe journey, review-tracking, and decision-readiness projections bound to one case/version; rejects extra private fields, future/precise dates, stale rollback, same-version divergence, and cross-case substitution; clears old case state before switching; and retains only a recursively frozen memory snapshot. Evidence: `docs/verification/2026-08-12-claimant-slice-2g-dashboard-read-model-coordinator.md`.
- Phase 2 Slice 2H adds one hard-disabled server-owned submission transaction, directly unmounted at that checkpoint and now reachable only through Slice 2I's independently concealed controller. It locks and reasserts exact portal, claimant, current-key, case/version, policy, intake, latest preparation, checklist disposition, consumed-capability, and clean-object authority before atomically advancing to `submitted` and writing an append-only safe receipt, value-free audit/outbox events, and idempotency result. Replay is stable, changed input fails, and late failures fully roll back. The acknowledgement explicitly keeps review and release false. Evidence: `docs/verification/2026-08-12-claimant-slice-2h-submission-acknowledgement-transaction.md`.
- Phase 2 Slice 2I mounts that submission transaction behind an independent immutable-false controller. Disabled requests are concealed before configuration/CORS; the test-only enabled path requires exact HTTPS API and claimant origins, JSON and bounded body, UUIDv4 route/idempotency values bound into the strict envelope, bearer-derived fresh AAL2 without recovery, active portal authority, and bounded claimant-case concurrency. Responses expose only the safe acknowledgement, database failures are generic, and notification providers remain disconnected. Evidence: `docs/verification/2026-08-12-claimant-slice-2i-submission-controller.md`.
- Phase 2 Slice 2J adds an immutable-false, runtime-disconnected web submission coordinator with injected transport only. It validates the exact synthetic envelope and safe acknowledgement, owns one stable UUIDv4 attempt key, serializes work, retains ambiguous or aborted dispatch authority only in memory for exact retry, and retains no acknowledgement after success. Static isolation rejects normal runtime imports, direct networking, browser persistence, providers, notifications, and private/internal fields. Evidence: `docs/verification/2026-08-18-claimant-slice-2j-web-submission-coordinator.md`.
- Phase 3 Slice 3A adds immutable-false, unmounted service-only owner-protection transactions. Forced RLS and explicit grants protect value-free cycle/events/idempotency data; verified delivery alone activates cooldown, while failed/ambiguous delivery, owner cancellation, claimant dispute, material change, and conflicting authority fail closed without review/release authority. Hosted rollback-only verification passed and left production unchanged. Evidence: `docs/verification/2026-08-18-claimant-slice-3a-owner-protection-foundation.md`.
- Phase 3 Slice 3B adds an immutable-false, unmounted owner-notice delivery coordinator with injected queue/provider contracts. It dispatches only the first claimed attempt, uses stable-key provider lookup as the sole delivery authority, hashes exact value-free verified receipts, fails uncertainty closed, and replays ambiguous persistence without redispatch. Evidence: `docs/verification/2026-08-18-claimant-slice-3b-owner-notice-delivery-coordinator.md`.
- Phase 3 Slice 3C adds a forced-RLS service-only owner-notice delivery queue and strict Supabase transaction client. It persists stable delivery authority before contact, excludes active leases, reclaims expired leases without redispatch, and completes only against the exact current lease and committed Slice 3A result. Evidence: `docs/verification/2026-08-18-claimant-slice-3c-owner-notice-delivery-queue.md`.
- Phase 3 Slice 3D adds independently concealed owner-cancellation and claimant-dispute HTTP boundaries. Exact separate origins and role-specific session clients prevent cross-mode confusion; server-derived actors, fresh AAL2, active session assertions, fixed reasons, strict input limits, bounded concurrency, and generic failures protect the Slice 3A stop transaction. Evidence: `docs/verification/2026-08-18-claimant-slice-3d-owner-protection-controller.md`.
- Phase 3 Slice 3E adds an immutable-false, unmounted reviewer assignment/conflict/recusal foundation. Separate synthetic reviewer identities, two distinct active slots, exact case/cycle/cooldown binding, owner/claimant related-party denial, forced RLS, security-invoker service transactions, append-only value-free events, locking, idempotency, stale-version enforcement, and safe reassignment all pass hostile coverage. No decision, approval count, release predicate, reviewer UI, or evidence access exists. Evidence: `docs/verification/2026-08-18-claimant-slice-3e-reviewer-assignment-foundation.md`.
- Phase 3 Slice 3F adds an immutable-false, unmounted independent-review foundation. Append-only blind decisions bind current assignments and exact case/cycle/submission/intake/preparation/policy/checklist/clean-evidence authority. Distinct-slot constraints, prior-assignment revalidation, and aggregate-only responses enforce independence. Two allows satisfy review approval but never change the case or authorize release. Evidence: `docs/verification/2026-08-18-claimant-slice-3f-independent-review-foundation.md`.
- Phase 3 Slice 3G adds an immutable-false, unmounted escalation/appeal foundation. Separate synthetic resolution authorities cannot overlap the owner, claimant, or reviewer identities. Locked idempotent interventions persist immutable safe reasons/events, force the exact review round to `held`, clear any two-person approval, preserve case cooldown, and keep release false. Evidence: `docs/verification/2026-08-18-claimant-slice-3g-review-escalation-appeal-foundation.md`.
- Phase 4 Slice 4A adds an immutable-false, unmounted final release-authorization foundation. A distinct synthetic final authorizer revalidates the exact current case/cycle/review/policy/submission/finalization authority, absence of interventions, and at least two active claimant keys with matching current recipient grants. Only `cooldown` to `approved` is permitted; package creation and retrieval remain false. Evidence: `docs/verification/2026-08-18-claimant-slice-4a-release-authorization-foundation.md`.
- Phase 4 Slice 4B adds an immutable-false, unmounted encrypted-package preparation foundation. A locked service-only transaction copies only exact active owner vault ciphertext/nonce envelopes, binds every current claimant recipient grant/key version and the current final authorization, and stores an immutable unsigned 72-hour snapshot with a server-computed ordered digest. The case stays approved; manifest signing and retrieval remain false. Evidence: `docs/verification/2026-08-18-claimant-slice-4b-encrypted-package-foundation.md`.
- Phase 4 Slice 4C adds an immutable-false, unmounted signed-manifest/package-finalization foundation. The service validates the frozen canonical manifest contract and detached Ed25519 signature against a separately resolved synthetic public key. The locked transaction requires exactly one signed manifest per current package grant, rechecks the immutable 4B snapshot and all release authority, then advances only to `release_ready`; retrieval remains false. Evidence: `docs/verification/2026-08-18-claimant-slice-4c-signed-manifest-foundation.md`.
- Phase 4 Slice 4D adds an immutable-false, unmounted retrieval-session authorization foundation. Verified Supabase identity/session claims and fresh AAL2 derive the claimant and authentication timestamp server-side. A locked service-only transaction binds a maximum-15-minute `authorized_unserved` record to the exact active claimant portal context, current release-ready finalization, signed manifest, grant, and active recipient key version. The case stays `release_ready`; package serving and retrieval completion remain false. Evidence: `docs/verification/2026-08-18-claimant-slice-4d-retrieval-session-foundation.md`.
- Phase 4 Slice 4E adds an immutable-false, unmounted encrypted-package delivery transaction/coordinator. One exact live Slice 4D authorization is revalidated before exposing only the frozen ciphertext envelopes, claimant-addressed encrypted grant, and signed manifest under an exact digest/byte/lease binding. Lookup alone proves complete delivery and replay never redispatches. The first verified receipt records `package_served` and advances the case once to `released`; retrieval completion remains false. Evidence: `docs/verification/2026-08-18-claimant-slice-4e-encrypted-package-delivery.md`.
- Phase 4 Slice 4F adds an immutable-false, runtime-disconnected mobile native-package open coordinator and adapter contract. It cross-binds the exact served ciphertext payload, canonical signed manifest, trusted Ed25519 key, case/package/session, grant, recipient key/version, ordered ciphertext digests and expiry before delegating verification/decryption to one injected native-shaped operation. JavaScript receives only an opaque local-open reference and value-free counts; export and server retrieval completion stay false. Evidence: `docs/verification/2026-08-18-claimant-slice-4f-native-package-open.md`.
- Phase 4 Slice 4G adds an immutable-false, unmounted verified retrieval-completion foundation. One locked service-only transaction consumes the exact served delivery plus a separately verified claimant-device/App-Attest native-open proof, advances the App Attest counter, and atomically records only retrieval completion with stable replay. The case remains released; export and closure remain false. Evidence: `docs/verification/2026-08-18-claimant-slice-4g-retrieval-completion.md`.
- The iOS Secure Enclave probe harness now uses only `probe-only.v3`, passcode-set device-only Keychain accessibility, `.privateKeyUsage` plus `.userPresence`, canonical unpadded Base64URL, the frozen V1 fingerprint/HKDF/HMAC labels, secure random salt/nonce, and creation/exercise fingerprint continuity. Normal application runtime does not import it. Separate internal EAS Build 1 compiled successfully, and the owner-reported physical pass/cancel/retry/cleanup matrix passed. Evidence: `docs/verification/2026-08-04-ios-secure-enclave-probe-harness.md` and `docs/verification/2026-08-04-physical-iphone-custody-probe-build.md`.
- The physical-iPhone evidence coordinator freezes exact non-production/iOS/operator/passcode/value-free preconditions and emits only generic result classes, timestamps, continuity/pass booleans, and a run ID. It has no entry point in normal application runtime. The separate signed probe host compiled and the owner-reported authenticated pass, cancellation/cleanup, and retry matrix passed. Evidence: `docs/verification/2026-08-04-physical-iphone-evidence-runner.md` and `docs/verification/2026-08-04-physical-iphone-custody-probe-build.md`.

## Engineering Target

Deliver a production-ready-but-disabled claimant system that supports the complete user journey with synthetic data in a production-shaped environment:

- Registered-recipient invitation, account creation, verified binding, MFA, recovery, and claimant key enrollment.
- Safe V2 code initiation using a split public locator and client-only secret; never use V1 for public lookup.
- Claim creation, relationship and authority details, document checklist selection, resumable evidence preparation, upload, submission, and safe acknowledgement.
- Persisted claimant dashboard states that expose only approved public information.
- Owner notice, cooldown, cancellation, dispute, hold, and value-free notification processing.
- Reviewer assignment, conflict/recusal handling, two distinct approvals, escalation, and appeal modelling.
- Server-controlled case transitions, idempotency, audit/outbox processing, reconciliation, and rollback.
- Claimant-addressed encrypted release packages, bounded retrieval sessions, native local decryption, read-only presentation, optional local export, expiry, and suspension.
- Complete monitoring, alerting, backup/restore, deletion, incident, and kill-switch behavior required to operate the code safely.

## Definition Of Engineering Production Ready

The claimant code may be described as engineering production ready only when all of the following are evidenced against one immutable candidate commit:

- Both claimant routes complete end to end using synthetic data in a production-shaped environment.
- Every production capability defaults to disabled and can be stopped independently without a deployment.
- Authentication, fresh assurance, database/API/RLS/Storage authorization, and claimant/case binding fail closed.
- No claimant has a path to owner vault rows, owner key material, another claim, or another claimant's evidence.
- Uploads enforce randomized case-bound paths, bounded capabilities, signature/type/size/page/count/decompression rules, and a malware-scanning adapter with deterministic test behavior.
- Case transitions, audit append, outbox creation, and idempotency decisions are transactional or have tested reconciliation and rollback.
- Dashboard projections cannot reveal reviewer identity, owner-response detail, fraud signals, internal notes, exact sensitive timers, or release predicates.
- Release infrastructure serves ciphertext plus exactly one claimant-addressed material profile; browser/backend plaintext is impossible by design.
- Native claimant clients prove local key custody, local decryption, expiry/suspension handling, and deterministic plaintext/key clearing.
- Hostile cross-owner, cross-claimant, cross-case, replay, race, stale-version, duplicate-delivery, partial-failure, and restore tests pass.
- Production-shaped configuration validation, observability, privacy-safe logs, SBOM/dependency review, rollback, backup/restore, and disaster exercises pass.
- Known limitations and provisional policy values are configurable and documented rather than silently hard-coded.

Engineering production readiness is not launch authorization. External access remains blocked until the launch gates below are complete.

## Implementation Order

### Phase 0 — Code-readiness audit and safe foundations

- Map every synthetic contract and preview to its required runtime producer and consumer.
- Add disabled-by-default feature/config flags, environment validation, and independent kill switches.
- Confirm owner, claimant, public, API, evidence, reviewer, and native-client trust boundaries.
- Establish production-shaped local/test environments and synthetic seed/reset tooling.

### Phase 1 — Shared claimant platform

- Claimant identity, invitation, public device-key, and registered-recipient case foundation: complete in Phase 1 Slice 1, default-deny and server-only.
- Transactional invitation issuance/acceptance, idempotency, audit, and value-free outbox records: complete in Phase 1 Slice 2, service-role-only.
- Authenticated, capability-guarded issue/accept API adapter with exact origin/content-type/CORS, server-derived actors, strict allowlists, and hostile tests: complete in Phase 1 Slice 3; mounted but concealed while disabled.
- Fresh timestamped AAL2, bounded recovery restrictions, server-owned session activation/displacement/revocation, and active-session enforcement on both mutations: complete in Phase 1 Slice 4.
- Case-scoped second-device enrollment, key replacement/revocation, invitation revocation, strict V2 ciphertext grants, invalidation, and owner finalization: complete in Phase 1 Slice 5.
- Phase 1 registered-recipient platform foundations are complete locally.
- Slice 1A hosted sign-in/MFA client wiring is parked at the paid-plan gate without weakening server enforcement. Slice 1B/1C, disposable custody-probe evidence, and the owner-accepted 2026-08-12 adversarial review/remediation are complete. Slice 1D-1H merged in PR #65; Slice 1I through Slice 2G have local checkpoints, Slice 2H is `0215f30`, Slice 2I `f8935c2`, Slice 2J `e9853fb`, Slice 3A `d752de1`, Slice 3B `2aebfa7`, Slice 3C `f8d6211`, Slice 3D `9089497`, Slice 3E `f5a9728`, Slice 3F `7bb6862`, Slice 3G `bc61110`, Slice 4A `f4dcdaf`, Slice 4B `8d9d195`, Slice 4C `ef97a64`, Slice 4D `f0195fe`, Slice 4E `5122c6f`, Slice 4F `79a1d94`, and Slice 4G is complete on the active branch. Slice 1G/1H/1I/1J/2A/2B/2C/2D/2E/2F/2G/2H/2I/2J/3A/3B/3C/3D/3E/3F/3G/4A/4B/4C/4D/4E/4F/4G capability approvals remain immutable false. Native Swift implementation/evidence, hosted MFA, provider selection, distributed edge abuse controls, and external activation remain gates.

### Phase 2 — Registered-recipient journey

- Wire invitation acceptance, account/key enrollment, claim initiation, checklist, evidence preparation, upload, submission, acknowledgement, and persisted dashboard tracking.
- Add server-owned intake/submission transition functions and hostile RLS/API/Storage isolation tests as their Phase 2 schemas and routes are introduced.
- Keep evidence synthetic and notifications captured by test adapters.

### Phase 3 — Review and owner-protection journey

- Wire owner notice, provisional cooldown, cancellation, dispute, hold, reviewer assignment, conflict/recusal, two-person approval, escalation, and appeal.
- Enforce server/database authority and value-free public projections.

### Phase 4 — Encrypted release and native retrieval

- Wire package preparation, claimant-addressed encryption, bounded sessions, native local opening, read-only presentation, optional local export, expiry, suspension, and closure.
- Prove that delivery does not claim local open or plaintext receipt.

### Phase 5 — Safe V2 offline-code journey

- Implement the split locator/client-secret protocol, domain-separated proof, enumeration resistance, throttling, attempt controls, expiry, revocation, and explicit V1 rejection.
- Add representative-device KDF benchmarks and reproducible protocol vectors.
- Reuse the common intake, evidence, dashboard, review, and release platform after safe case binding.

### Phase 6 — Production-hardening acceptance

- Run complete end-to-end, hostile authorization, race/replay, outage, reconciliation, backup/restore, deletion, observability, and rollback suites.
- Freeze one immutable engineering candidate and produce a value-free readiness report and residual-risk register.
- Keep runtime flags disabled and stop for launch governance.

Each phase must be delivered in small reviewable code changes with exact scope, non-goals, tests, rollback, and updated handoffs. Passing one phase does not authorize deployment or activation.

## Non-Negotiable Technical Boundaries

- Authentication, MFA, code possession, relationship, identity proofing, evidence review, release authority, and cryptographic possession are separate controls.
- No individual control—and no owner non-response—authorizes release.
- Never submit, log, email, place in a URL, or store a complete emergency secret.
- Claimants never receive a policy path to owner vault rows, key material, another claim, or another claimant's evidence.
- Infrastructure stores and serves ciphertext plus approved metadata only for owner vault material.
- Claimant evidence is separate server-visible sensitive PII and must remain in an isolated private quarantine.
- Browser-readable release PDFs, server-side decryption, system-known PDF passwords, and server-recoverable claimant private keys are prohibited.
- Claim-sensitive actions require fresh authenticated sessions and enforced `aal2` in UI, API, and database policy.
- Case state, authority, approvals, deadlines, and release eligibility are server/database controlled; client values are untrusted.
- Owner clients seal claimant-addressed ciphertext locally; servers never perform that encryption but remain authoritative for validation, authorization, persistence, case transitions, and finalization.
- Package prepared, served, opened, exported, claimant-confirmed, expired, suspended, and closed are distinct events.
- Suspension can block future retrieval but cannot recall information already decrypted locally.
- Development and engineering acceptance use dedicated synthetic identities, records, documents, notifications, and release material only.

## Governance And Launch Gates

These items do not block the engineering programme, but every applicable item blocks external access or production activation:

- Confirm the operating/contracting entity, controller details, processor map, governing law, and supported jurisdiction policy packs.
- Approve evidence authority, sufficiency, translation, minimization, legal basis, retention/deletion, rights, legal hold, breach, dispute, appeal, and cross-border rules.
- Name and train operational reviewers; approve qualifications, separation, conflicts, access, escalation, staffing, and incident procedures.
- Treat the Shahbaz Malik/Codex interim test assignment as synthetic engineering coverage only; replace it with at least two qualified independent human reviewers and disable all synthetic reviewer identities before external access, real claimant data, package creation, or release.
- Complete independent legal/privacy, security, native/cryptographic, operational, and application assurance against the immutable engineering candidate.
- Approve production providers, plans, DPAs/subprocessors, origin architecture, WAF/DDoS controls, monitoring, support, backup/restore, and incident response.
- Complete `EDGE-01` through `EDGE-03`, the owner-web P0 controls in `SECURITY_HANDOFF.md`, production configuration evidence, and controlled launch approval.

No real claimant data may be collected and no external claimant capability may be enabled until these launch gates are recorded as complete or an explicit documented exception is approved by the actual accountable owner and required specialists.

## Authoritative Design Set

- `docs/superpowers/specs/2026-07-31-claimant-slice-2-decision-register.md`
- `docs/superpowers/specs/2026-07-31-claimant-threat-control-matrix.md`
- `docs/superpowers/specs/2026-07-31-claimant-slice-2-approval-checklist.md`
- `docs/superpowers/specs/2026-07-31-claimant-slice-2-specialist-review-pack.md`
- `docs/superpowers/specs/2026-07-31-claimant-document-checklist-catalog.md`
- `docs/superpowers/specs/2026-07-31-claimant-mvp-manual-review-retrieval-flow.md`
- `docs/superpowers/specs/2026-07-28-claimant-key-custody-client-boundary.md`
- `docs/superpowers/specs/2026-07-28-claimant-custody-probe-evidence.md`

Use these as current design inputs, not as proof of implemented runtime or launch approval. Update superseded assumptions alongside the code slice that changes them.

## Historical Evidence Retained

- PR #54 passed protected CI and was internally accepted for bounded synthetic-prototype circulation. External specialist approvals remained outstanding.
- Prototype acceptance recorded 141 web tests, 110 shared claimant tests, and 42 shared validation tests passing, plus workspace typechecks, lint, production web build, security guards, vector isolation, and custody isolation.
- The synthetic acceptance suite proved deterministic modelling and safe projections only; it did not prove production authentication, persistence, uploads, operations, native release, or deployment.
- PR #58 merged the owner-web security baseline and `brace-expansion` production-path remediation at `c0a14e1`.
- PR #59 merged documented edge/WAF/DDoS gates at `887abd0459197c5123b8972e1b8c5bed14ec5528`; it made no provider, DNS, hosting, or runtime change.

## Repository Publishing Rule

Do not publish documentation or administrative changes alone. Keep them local and include them with the next authorized, reviewed code change. This rule does not authorize a code change, deployment, external configuration, or any other administrative action by itself.
