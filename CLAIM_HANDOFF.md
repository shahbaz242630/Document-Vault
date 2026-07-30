# Sanduqkin Claimant And Release Handoff

Last updated: 2026-07-28 (Asia/Dubai)

## Purpose And Status

This is the active playbook for claimant, trusted-recipient, emergency-code, review, and encrypted-release work. Read it before changing any claimant page, protocol, schema, RLS policy, Storage policy, API route, notification, or release control.

Claim applications and release are not active. The public `/claim` entry is informational, no claimant schema or evidence path is approved, and no server can decrypt owner vault content. The owner-vault and mobile release gates in `HANDOFF.md` and `SECURITY_HANDOFF.md` remain separate.

Slice 1 is complete and merged into `main` through PR #34 (`2c82c93`): the public entry exposes two tested informational route pages from one typed capability model, while authentication, intake, code entry, evidence, review, and release remain hard-disabled.

PR #38 merged the owner-approved, runtime-disconnected protocol-vector and custody-feasibility slices into `main` as merge commit `ed2a3d6`. They add closed shared contracts, canonicalization, strict validation, the proposed state-transition evaluator, deterministic synthetic generators, five fixture suites, a hard-disabled native custody module, and isolation guards. They do not add a claimant runtime path. The offline-code V2 Argon2id fixture profile is explicitly synthetic-only and `production_approved: false`; production parameters remain blocked on representative-device benchmarks and security approval.

## Non-Negotiable Boundaries

- Authentication, MFA, code possession, relationship, identity proofing, evidence review, and release authorization are separate controls.
- Possessing a code or being registered as a recipient never authorizes release.
- Never submit, log, email, place in a URL, or store a complete emergency secret.
- Never give a claimant a direct policy path to `vault_assets`, `vault_key_material`, another claim, or another claimant's evidence.
- Released information remains ciphertext plus claimant-addressed sealed key material and decrypts only in the claimant client.
- Every claim binds one route-specific release-material profile. Registered-recipient grants and V2 secret-wrapped MEKs are never interchangeable.
- Registered-recipient implementation cannot begin until an approved client custody design can retain or recover the claimant private key without violating the browser-persistence and server-recovery prohibitions.
- Claim-sensitive actions require a fresh authenticated session and enforced `aal2` in the UI, API, and database policies.
- Claim state transitions are API/database controlled. Client-supplied owner IDs, roles, assurance levels, states, decisions, deadlines, or release eligibility are untrusted.
- Evidence, if approved, is server-visible sensitive PII outside the normal vault zero-knowledge claim and must use an isolated private quarantine boundary.
- Non-response must not automatically release data in the MVP. It moves the case to hold or manual review.
- All development uses dedicated identities, synthetic records, and synthetic documents. No real claim or claimant data is authorized before the pilot gate.

## Target Surface And Trust Boundaries

| Surface | Purpose | Boundary |
| --- | --- | --- |
| `sanduqkin.com/claim` | Public explanation and route selection | Static; no forms, identity data, code entry, or persistence |
| `app.sanduqkin.com` | Future claimant authentication, dashboard, cases, and read-only viewer | Isolated claimant origin with host-only cookies |
| `vault.sanduqkin.com` | Owner recipient/grant management and claim cancellation | Isolated owner origin |
| `api.sanduqkin.com` | Canonical authorization, state transitions, notifications, and release packaging | Server-verified JWT; service credentials never reach clients |
| Supabase | Auth, durable workflow state, ciphertext, audit metadata, and private evidence metadata | Explicit grants, RLS, least privilege, backup and restore controls |

Production hostnames are recommendations until formally approved. Public hosts must not expose protected routes, and owner and claimant cookies must never share a parent-domain `Domain` attribute.

## Claimant Routes

### Registered recipient

1. The owner nominates a recipient without sharing vault content.
2. A value-free, single-use invitation lets the recipient create or link an account.
3. Acceptance is bound to the same verified, normalized recipient address; stored address matching uses a versioned keyed digest, not a bare hash.
4. The recipient enrolls MFA and generates a key pair locally; only the public key leaves the client.
5. Key generation remains blocked until an approved native, hardware-backed, or otherwise compliant custody design exists. The current browser policy does not permit persistent claimant private keys.
6. The unlocked owner client explicitly finalizes a recipient-addressed sealed grant.
7. Grant replacement and revocation are supported before any claim is allowed.
8. A later claim still requires the approved identity, evidence, cooldown, cancellation, and authorization workflow.

### V2 offline handover code

The current V1 sealed code has no safe public locator and cannot be used for claimant lookup. V2 must define:

- a random public locator that reveals no owner identity;
- a separate high-entropy client-only secret;
- a domain-separated possession proof that does not transmit the secret;
- constant-shape not-found responses, throttling, attempt limits, CAPTCHA/risk controls, expiry, revocation, and audit events;
- browser-worker KDF benchmarks on representative iOS, Android, desktop, low-memory, and GCC network conditions; and
- explicit V1 compatibility or owner-confirmed regeneration.

Do not scan grants, accept a full V1 code, silently lower KDF cost, or place either secret or proof material in URLs or logs.

## Recommended MVP Authority Model — Pending Approval

- Registered-recipient flow ships before V2 code initiation.
- Claim submission requires authenticated `aal2` and an accepted policy/consent record.
- The owner receives value-free notices and may cancel throughout the cooldown.
- Release requires completed identity/evidence review, expired cooldown, no owner cancellation, and two distinct authorized human approvals.
- An approver cannot review their own claim or supply both approvals.
- Owner non-response, witness non-response, delivery failure, ambiguity, dispute, account inconsistency, or processor error moves the case to hold/manual review.
- Release produces a time-limited claimant-specific ciphertext package containing exactly one validated release-material profile: a registered-recipient sealed grant or a V2 secret-wrapped MEK. It does not change owner-vault RLS to expose source rows.
- Released access is read-only, expires, and can be suspended for incident response without pretending already-decrypted information can be recalled.

Before stateful implementation, owner/security/legal review must approve release authority, reviewer qualifications, evidence policy, supported jurisdictions, cooldown length, appeal/dispute process, conflicts of interest, operator/data-controller identity, retention/deletion, and incident procedure.

## Proposed State Machine — Pending Approval

`draft -> identity_pending -> submitted -> owner_notified -> cooldown -> review_pending -> approved -> release_ready -> released -> closed`

Terminal or holding branches:

- `cancelled_by_owner`
- `withdrawn_by_claimant`
- `rejected`
- `expired`
- `on_hold`
- `manual_review`
- `release_suspended`

Every transition requires an allowlisted previous state, authorized actor, idempotency key, server time, reason code, append-only state event, and transactional notification/outbox work. No browser directly writes state, approval, deadline, or release columns.

## Proposed Data Model — No Migration Yet

- `claimant_profiles` — minimal claimant account state and policy acceptance.
- `recipient_invitations` — hashed single-use invitation material, expiry, and status.
- `recipient_public_keys` — versioned claimant public keys and replacement history.
- `recipient_grants` — owner-created claimant-addressed ciphertext grants and revocation state.
- `claim_locators` — V2 public locators and possession-proof verifier material.
- `claims` — current state and safe workflow metadata.
- `claim_state_events` — append-only transition history.
- `claim_evidence` — quarantine object references, classification, scan, retention, and review state; never public URLs.
- `claim_decisions` — independent reviewer decisions and conflict checks.
- `release_packages` — signed claimant-addressed ciphertext manifest, route discriminator, release-material and cancellation versions, expiry, and retrieval state.
- `release_sessions` — bounded read-only access sessions.
- `notification_outbox` — idempotent value-free notification jobs.
- `claim_security_events` — value-free abuse, rate-limit, and incident signals.

Prefer a private, non-exposed workflow schema with narrow API/database functions. Any client-exposed projection requires explicit grants, RLS, column review, and hostile cross-account tests. Service-role access remains inside protected processors.

## Evidence Quarantine — Blocked Pending Policy

- Separate private bucket and case-bound randomized object paths.
- Short-lived upload capabilities; no public bucket or predictable filename.
- Allowlisted type, signature verification, size/page/count limits, decompression limits, and malware scanning before review.
- Claimant/case binding in both Storage RLS and application authorization.
- No document body, filename, owner identity, or claimant PII in ordinary logs, notifications, analytics, or audit event metadata.
- Defined access roles, reviewer workstation controls, retention, legal hold, deletion, breach response, backup, and restore behavior.
- Storage backup is separate from database backup and must be tested independently.

## API And Processor Rules

- The Hono API remains the canonical privileged surface; Next.js pages do not contain release decisions.
- Verify JWT signature, issuer, audience, expiry, session, user, and `aal2` server-side for sensitive operations.
- Use transactions, compare-and-set state transitions, unique idempotency keys, bounded retries, and an outbox.
- Scheduled work may advance timers only into a reviewable state; it cannot automatically approve or release.
- Responses and timing must resist owner, locator, email, case, and invitation enumeration.
- Notifications are value-free and never include evidence, emergency secrets, vault fields, countdown details that create coercion risk, or direct release material.
- Release retrieval requires fresh `aal2`, authorization recheck, an unexpired release session, and claimant-local decryption.

## Threats That Must Have Tests

- Cross-owner/cross-claimant reads, writes, object access, approval, and release attempts.
- Forged or replayed invitations, locators, possession proofs, decisions, transitions, webhooks, and processor calls.
- Claim or account enumeration through status, timing, rate-limit, password-reset, and support responses.
- Reviewer self-approval, duplicate approval, stale approval, approval after owner cancellation, and race conditions at cooldown expiry.
- Malicious files, MIME confusion, oversized/decompression payloads, filename leakage, and unscanned evidence access.
- Stolen session, MFA downgrade, key replacement during an active claim, deleted claimant/owner, revoked grant, and expired release session.
- Notification failure, processor retry, partial transaction, backup restore, region outage, and audit/outbox divergence.
- XSS, browser persistence, worker/key cleanup, cache leakage, clickjacking, CSRF, open redirect, and hostile deep links.

## Slice Plan And Stop Gates

### Slice 1 — inactive claimant portal foundation — complete and merged

- Maintain the existing `Claim access` navigation entry and static `/claim` landing page.
- Define the two planned route cards and planned portal stages from one typed, hard-disabled capability model.
- Add inactive registered-recipient and emergency-code information pages with no forms, network client, storage, cookies, code input, or release action.
- Test navigation, content, `noindex`, hard-disabled intake/release flags, and the absence of data-collection elements/integrations.

Exit: UI foundation and tests pass; no claimant data path, schema, API, or release capability exists. Update this handoff and stop.

### Slice 2 — protocol, authority, and threat-model approval

- Resolve every pending authority, identity/evidence, jurisdiction, cooldown, review, privacy, retention, incident, V2 protocol, and origin decision.
- Produce protocol messages, route-specific cryptographic and release envelopes, claimant-key custody decision, state-transition matrix, role/capability matrix, abuse cases, test vectors, and rollback/kill-switch design.

Exit: written owner/security/legal approval and no unresolved critical threat. No live claim.

### Slice 3 — registered-recipient preparation, no release

- Only after claimant-key custody is independently approved: privacy-preserving verified-address invitation binding, mandatory MFA, claimant-local keypair, public-key registration/replacement, owner-local grant finalization, revocation, and value-free notifications.

Exit: hostile auth/RLS/crypto/E2E tests pass; recipient cannot read vault data or initiate release.

### Slice 4 — V2 initiation and synthetic evidence quarantine, no release

- Locator/proof protocol, enumeration resistance, rate limits, case creation, synthetic evidence upload/scan/review, retention, and deletion.

Exit: abuse, Storage RLS, malware, privacy, backup, and cleanup tests pass. No release.

### Slice 5 — controlled review state machine

- Owner cancellation, cooldown, independent review, dual approval, holds, disputes, outbox processors, and append-only state events.

Exit: transition/property/race/retry/notification/authorization tests pass. Release remains disabled.

### Slice 6 — encrypted release and read-only viewer

- Claimant-addressed ciphertext packages, bounded retrieval sessions, local key handling/decryption, read-only presentation, expiry, and incident suspension.

Exit: focused security review or penetration test, restore drill, synthetic E2E, and owner approval pass before an invitation-only pilot.

## Next Session Opener

Complete the replacement TestFlight release described in `HANDOFF.md` before opening a new claimant implementation slice. The claimant end-to-end delivery map is already recorded in `docs/superpowers/plans/2026-07-28-claimant-integration-delivery-map.md`; do not repeat that planning exercise.

The next claimant decision is the Android transaction-binding design and minimum platform baseline. Physical iOS and representative Android custody evidence, independent review, and the claimant key recovery/multi-device decision must also be completed.

If those gates are approved, the next bounded runtime slice is registered/verified-recipient setup only: single-use invitation binding, verified normalized-address matching, fresh `aal2`, claimant-local public-key registration/replacement, and owner-local grant finalization/revocation. It must keep claim submission, document intake, evidence review, state progression, and release disabled.

Authentication, persistence, migrations, API routes, invitations, evidence handling, notifications, workflow processors, and release behavior remain blocked until their applicable slice and approval gates are explicitly cleared.

## Protocol-Vector Slice Evidence

- `@vault/shared-types` exports closed registered-recipient V1, offline-code V2, claimant-state V1, and release-package V1 contracts, canonical JSON, strict validators, and an allowlisted transition evaluator.
- `scripts/generate-claim-test-vectors.mjs` reproducibly generates five explicitly synthetic fixtures; check-only mode fails on drift.
- Registered-recipient evidence covers deterministic X25519 test keys, a libsodium-compatible sealed box, canonical bindings, successful open, wrong-key/truncation failures, and unknown-version rejection.
- Offline-code evidence covers the split locator/secret format, Argon2id root derivation, domain-separated subkeys, Ed25519 challenge proof, keyed locator digest, XChaCha20-Poly1305 MEK wrapping, binding/tamper failures, and an explicit non-production KDF flag.
- State evidence covers every previous/requested-state pair plus AAL and independent release-control denials. Non-response has no approval transition.
- Release evidence covers both route profiles, canonical signed manifests, cancellation/version bindings, ordered ciphertext digests, cross-route rejection, and signature failure after mutation.
- Mobile, web, API, and shared reference tests consume the same fixtures offline.
- The isolation guard verifies that claimant capabilities remain hard-disabled and that contracts contain no Supabase, network, browser-persistence, notification, evidence, or release-table integration.
- Verification passed repository typecheck/lint; mobile 383 tests with 3 protected skips; web 83 tests; shared types 19 tests; shared validation 40 tests; API 30 tests; web build; mobile coverage; Expo Doctor 21/21; Phase 1/security/GitHub Actions/mobile-secret/vector/custody guards; Docker-backed database/RLS checks; and a production audit with zero vulnerabilities.
- The Docker-backed Supabase database catalog check and hostile RLS attack suite passed after the checked-in local stack was started. This slice contains no migration, schema, database, RLS, Storage, or runtime API change.
- The owner-approved custody feasibility slice adds a hard-disabled local Expo module, a deterministic registered-recipient V2 P-256 reference vector, cross-consumer tests, and a custody-isolation guard. The native module and integrated Android app Kotlin compilation passed without raising the app's minimum SDK above 24.
- Android remains fail-closed: the current Android 36 target does not provide transaction-bound `BiometricPrompt.CryptoObject(KeyAgreement)`. No physical custody probe ran. The merged iOS module passed simulator compilation, while physical iOS and representative Android custody verification remain outstanding.

## Session Close Evidence — 2026-07-28

- PR #38 merged the claimant protocol/vector and hard-disabled custody feasibility work into `main`.
- The final matrix passed Android native compile and emulator smoke, iOS simulator smoke, application/security gates, local/hosted Supabase gates, CodeQL, OWASP ZAP, GitGuardian, and protected previews.
- Product understanding was confirmed: registered recipients and V2 code holders use different route assertions but converge on the same controlled claim application, document/evidence, review, cooldown, approval, and encrypted read-only retrieval journey.
- Registration, MFA, or code possession establishes context only and never authorizes data release.
- Claimant authentication, invitation delivery, persistence, migrations, APIs, evidence, review processors, notifications, package creation, decryption, and release remain disabled.

## Slice 1 Evidence

- `apps/web/lib/claimant-portal.ts` is the single typed source for both planned routes, five portal stages, and six hard-disabled capabilities; it has no environment override.
- `/claim/registered-recipient` and `/claim/emergency-code` are static, `noindex`, information-only pages.
- Focused tests cover declared routes, content, disabled capabilities, and absence of forms, action links, Supabase, network calls, cookies, environment toggles, and browser persistence APIs.
- Headed browser checks passed on desktop and a 390 × 844 viewport for both route links, return navigation, mobile navigation, accessible structure, and zero console errors or warnings after the smooth-scroll document marker was added.
- No claimant schema, migration, RLS policy, Storage bucket, API route, authentication flow, evidence intake, claim state, notification, or release capability was introduced.

## Slice 2 Placeholder Evidence

- Both informational routes now render one typed future evidence checklist, seven-stage claimant-visible progress model, and three explicit data-visibility boundaries.
- The registered-recipient route shows future account login, fresh MFA, grant/key recheck, and application creation as disconnected placeholders.
- The V2 route shows future local locator/secret processing and possession proof; it does not accept or transmit a code.
- Admin email is described only as a value-free work notice. Identity/authority documents remain assigned to a future private quarantine and are never described as email attachments.
- Reviewers are explicitly separated from vault data: they may later see only approved claimant-submitted evidence, while released vault details remain claimant-addressed ciphertext for local read-only decryption.
- All claimant capabilities remain hard-disabled with no environment override. `npm test --workspace @vault/web -- app/content.test.tsx app/claim/claimant-portal.test.tsx` passed 13/13; web typecheck and lint passed.
- Headed checks passed on desktop and a 390 × 844 viewport for both route structures with no horizontal overflow, forms, inputs, main action buttons, console errors, or warnings.
- No authentication, upload, email, database, reviewer, state-transition, or release integration was added.

## Standard Verification

Run the repository checks from `HANDOFF.md` plus slice-specific web, API, database, RLS, Storage, crypto, abuse, accessibility, and browser tests. Every migration requires database catalog and hostile RLS tests before and after the change. Every slice records value-free evidence, cleans all synthetic data, updates this document, and stops for owner review before the next slice.
