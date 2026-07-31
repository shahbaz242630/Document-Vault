# Sanduqkin Website, Owner Web Vault, And Claimant MVP Handoff

Last updated: 2026-07-31 (Asia/Dubai)

## Current Decision

Complete physical-iOS regression of the repaired owner controls, then begin the bounded claimant Slice 2 decision work; public website publication and live claimant/release behavior remain gated.

- API region alignment and the web workspace scaffold are merged on `main`.
- Static landing/legal content is implemented and protected-preview-verified, but publication is parked pending owner/design/legal approval.
- The protected owner web vault and shared mobile/web 17-category engine are merged on `main` but are not deployed.
- The repeatable local browser/mobile-repository smoke, TestFlight build 3 native-UI confirmation, synthetic-data cleanup, and branch PR-readiness review passed.
- PR #38 merged the verified mobile MVP navigation/dashboard redesign, web sign-in cleanup, claimant vectors, and hard-disabled custody feasibility work.
- PR #48 merged the lockfile-based SBOM repair. Protected run `30520301290` then produced TestFlight build 4.
- Build-4 physical QA findings were repaired by PR #49 and verified on an authenticated Pixel emulator. PR #49 merged as `306c18f`, and the complete post-merge native/security/Supabase matrix passed.
- Protected run `30570280096` produced and submitted app `1.0.0` (5). App Store compliance and `GCC Internal Testers` assignment completed, and build 5 is installed for controlled physical QA.
- Build-5 physical QA passed the fixed footer, Emergency Readiness heading, friendly invalid-data handling, valid save, and sealed emergency-code creation. The Android biometric path and owner-side trusted-person information route are now repaired and emulator-verified; physical iOS regression remains required before another release.
- `/claim` remains informational and inactive. No real claimant data, evidence intake, entitlement decision, release, or claimant decryption is authorized.

Detailed pre-consolidation phase evidence is preserved in Git at commit `96e89c1` and indexed in `docs/handoff/archive/CONSOLIDATION-2026-07-20.md`.

The authoritative claimant and encrypted-release playbook is `CLAIM_HANDOFF.md`; use its linear slice plan and stop gates for all claimant work.

## MVP Scope

### Included

- Public product, security, support, accessibility, privacy, terms, and account-deletion information.
- A protected owner web vault using the same identity, encrypted records, key material, validation, and envelope format as mobile.
- A future claimant portal with two designed routes: registered trusted recipient and V2 offline handover code.
- One canonical Hono API for mobile/web business operations.
- Client-side encryption/decryption and zero-knowledge vault storage.

### Excluded until separately approved

- Public legal publication while `apps/web/LEGAL_CONTENT_REVIEW.md` is unresolved.
- External authenticated web users before the Supabase Pro, backup, session-displacement, hosted-configuration, and smoke-test gates pass.
- Real claimant registration, evidence upload, relationship or entitlement decisions, release authorization, and data release.
- Payments and financial/legal/executor positioning.

## Architecture

| Surface | Repository | Intended host | Current state |
| --- | --- | --- | --- |
| Mobile owner vault | `apps/mobile` | Native app | TestFlight build 5 installed; two interaction regressions open |
| Public website | `apps/web` | `sanduqkin.com` | Protected static preview; publication blocked |
| Canonical redirect | `apps/web` | `www.sanduqkin.com` | Not configured |
| Owner web vault | `apps/web` or separate reviewed project | **Decision required** | Implemented locally; not deployed |
| Claimant portal | `apps/web` or separate reviewed project | `app.sanduqkin.com` | Informational `/claim` only |
| Shared API | `services/api` | `api.sanduqkin.com` | Deployed; dynamic function verified in `fra1` |
| Identity/data | Supabase | Managed service | Existing Free `eu-central-1` project plus local stack |
| DNS | Hostinger | Domain control | Production web records not configured |

### Required origin decision

Before deploying `/login` or `/vault`, choose and document the owner-vault production hostname and enforce host-based routing.

- The owner vault and future claimant intake are different trust contexts and must not rely only on path separation.
- Recommended default for review: `vault.sanduqkin.com` for owners and `app.sanduqkin.com` for claimants, with host-only cookies and exact redirect/CORS/origin allowlists. A separate Vercel project may be preferable if it materially reduces routing, cookie, deployment, or operator risk.
- Public hosts must not accidentally expose protected owner or claimant routes.
- Do not attach any production domain until this decision and its tests are approved.

### Data and compute rules

- Mobile and web use the same Supabase user, `vault_key_material`, and `vault_assets`; do not create a second vault or source of truth.
- Public pages are statically generated and remain usable if Supabase or the API is unavailable.
- Protected pages are dynamic, private, `no-store`, and `noindex`.
- The Hono API remains the canonical privileged/business API. Do not move release logic into Next.js page components.
- API and authenticated dynamic compute must be placed near the Frankfurt data plane.
- Durable workflow state belongs in Postgres, not Vercel process memory.

## Owner Web Vault Contract

- Browser sign-in uses the Supabase publishable client; the password is not submitted to a Sanduqkin server action.
- The browser derives the KEK and unwraps the MEK locally. Record crypto and active MEK storage remain inside the Web Worker.
- Passwords, KEKs, MEKs, and plaintext records are not persisted in browser storage or sent to the API.
- All 17 current asset types are defined by the exhaustive `@vault/shared-validation` registry and shared with mobile.
- Known fields are replaced or cleared through the current schema while unknown future encrypted fields are preserved.
- Web supports encrypted list, view, create, update, soft delete, restore, and confirmed permanent delete.
- Mobile reconciles failed mutations from Supabase or rolls back local state.
- Lock, sign-out, timeout, displacement, and fatal failures must clear decrypted/key state.

## One Active Login

Product intent is that the latest successful sign-in becomes the only active session across mobile and web.

- The existing Supabase project is Free; managed single-session, inactivity timeout, and time-boxed sessions are not active.
- Before production readiness, upgrade the existing project to Pro, enable managed single-session-per-user, and select a supportable JWT lifetime.
- An issued access JWT can remain usable until expiry. Do not claim immediate displacement.
- Sensitive API operations should verify the user server-side and, where supported, validate the JWT session against the active Auth session.
- Test mobile-to-web and web-to-mobile displacement, refresh failure, the bounded old-JWT window, and decrypted-state cleanup using dedicated identities.

## Claimant Model — Design Only

### Registered trusted recipient

1. Owner nominates a recipient and Sanduqkin sends a value-free invitation.
2. Recipient authenticates, enrolls MFA, and creates a key pair locally.
3. Only the public key leaves the client; no claimant private key or server-recoverable private-key package is uploaded.
4. The unlocked owner client creates a recipient-specific sealed MEK grant.
5. A later claim still requires identity, evidence, challenge/cooldown, and release authorization.
6. After authorized release, ciphertext and claimant-specific sealed material decrypt locally into a read-only view.

The existing `pre_authorized_kin` symmetric-key helper is not a finished public-key or account-bound recipient protocol.

Registered-recipient setup is blocked until security and privacy review approve a native, hardware-backed, or otherwise compliant custody design. The current browser policy does not permit persistent claimant private keys.

### V2 offline handover code

Current V1 codes have about 100 bits of generated secret, use Argon2id and XChaCha20-Poly1305, and are not stored raw. They have no public locator and therefore cannot safely locate a grant.

V2 must define:

- a public locator safe to submit;
- a separate high-entropy client-only secret;
- a domain-separated possession proof;
- expiry, attempt limits, throttling, abuse detection, and revocation;
- no full secret in URLs, requests, logs, analytics, support tools, or database rows; and
- explicit compatibility or owner-confirmed regeneration for V1 grants.

Do not scan all grants, transmit the full secret, silently lower the current KDF cost, or revoke active V1 grants automatically. Benchmark browser Argon2 in a Web Worker across representative iPhone, Android, desktop, and low-memory devices.

### Unresolved release authority

Live release cannot be designed or implemented until owner/security/legal review decides:

- who authorizes release when the owner cannot respond;
- accepted evidence, jurisdictions, and qualified reviewers;
- owner notification, challenge/cancel, cooldown, and restart rules;
- lost-access-but-living-owner handling;
- disputes, appeals, audit, incidents, and insider controls;
- operator/data-controller identity, governing law, retention, and deletion.

Authentication, MFA, relationship claims, evidence, or code possession do not establish entitlement and never authorize release by themselves.

## Claimant Security And Data Boundary

- Claimant identity, claims, evidence, and release state require separate capabilities, schema, RLS, storage, API authorization, and audit paths from the owner vault.
- Write the protocol and threat model before migrations. Use append-only migrations, explicit API-mediated transitions, database constraints, idempotency, and append-only state events.
- Require `aal2` for key registration/replacement, claim submission, release approval, and sealed-package retrieval.
- Prevent account/locator enumeration and apply CAPTCHA, bounded timing, and layered rate limits.
- Claim evidence, if approved later, is server-visible PII and outside the vault zero-knowledge claim. It requires a private quarantine bucket, claimant/claim-bound Storage RLS, randomized names, content/size/count limits, malware scanning, retention/deletion, and short-lived upload/download capabilities.
- Claimants must never gain a policy path to `vault_assets`, `vault_key_material`, another claim, or another claimant's evidence.
- Released information remains ciphertext plus claimant-specific sealed key material and decrypts locally. No server-side vault decryption is permitted.

## Delivery Status

### Completed and integrated

- **API Frankfurt alignment:** merged through PR #32 as `affaef1`; production function verified in `fra1`, health and protected route behavior retained, and rollback recorded.
- **Web workspace scaffold:** merged through PR #33 as `c4f1f91`; separate `sanduqkin-web` Vercel project, static shell, tests/build, protected preview, no credentials or data paths.

### Completed and merged on `main`, not deployed

- Static landing/legal/support/accessibility/security routes and inactive `/claim` preview.
- Refined public landing-to-sign-in navigation and a cleaned, aligned web login experience.
- Supabase web authentication foundation and server-side protected-route claim validation.
- Deterministic mobile/web crypto compatibility vector and Web Worker key boundary.
- Live owner-only bank-account proof in both cross-client directions with tagged-row cleanup.
- Exhaustive schema-driven registry and encrypted CRUD parity for all 17 current asset types.
- Mobile unknown-field preservation and failed-mutation reconciliation.
- Protected-route nonce CSP and security headers.
- Repeatable local protected smoke across card, contact, medical-care, and business-interest records, including bidirectional edit/decrypt, forward-field preservation, ciphertext-only rows, browser deletion lifecycle, offline failure reconciliation, browser storage/key cleanup, protected headers, and full synthetic cleanup.
- The 2026-07-27 regression passed mobile 377 tests with 3 protected live tests skipped, web 81 tests, repository typecheck and lint, the Next.js `16.2.12` production build, Expo Doctor 21/21, Phase 1/security/mobile-secret guards, and a production dependency audit reporting zero vulnerabilities. The protected web surface remains blocked from deployment for the remaining release-readiness work described in this handoff.
- PR #38 adds closed claimant protocol contracts and validators, five reproducible synthetic suites, cross-consumer verification, state-release invariants, a hard-disabled native custody probe, and runtime-isolation guards. It adds no claimant authentication, persistence, API, evidence, notification, processor, or release path. Its offline-code V2 Argon2id profile is synthetic-only and not production-approved.
- PR #49 adds the build-4 QA repairs: fixed vault footer, corrected Emergency Readiness hierarchy, friendly dynamic-form validation and valid-save recovery, biometric availability refresh/native error handling, Face ID native configuration, and a checkout-line-ending-safe claimant-vector check. Authenticated emulator coverage passed the repaired owner flow and permanent synthetic cleanup.
- Final PR #49 verification passed 391 mobile tests with 3 protected skips, coverage, typecheck, lint, Expo Doctor 21/21, Android native/emulator smoke, iOS simulator smoke, application/security gates, live/hosted Supabase checks, CodeQL, OWASP ZAP, GitGuardian, and Vercel previews.

### Mobile MVP UI/UX session — 2026-07-26

- Verified the controlled test account against Supabase: new TestFlight records reached the encrypted vault path, stored rows did not expose plaintext vault fields, and the owner-selected deleted test item was fully removed as expected.
- Replaced the mixed landing experience with a dedicated Dashboard, separate Add and Saved Records destinations, explicit return controls, and a five-action Home/Add/Records/Settings/Lock footer.
- Added safe live vault-coverage guidance and emergency-readiness status backed by existing encrypted-record and sealed-grant state, including a seven-day on-device reminder deferral. No emergency grant was changed.
- Android emulator checks covered sign-in, Dashboard rendering, all footer destinations, Lock, emergency-access routing, return-time refresh, and final styling.
- Latest mobile verification after the final styling change: TypeScript passed; Vitest passed 377 tests with 3 protected tests skipped across 100 passed and 3 skipped files.

### Hosted state

- Current hosted web preview is still static deployment `dpl_56CPAxso438Az7z6pmVwisotCiH5`, protected by Vercel SSO.
- It predates `/login` and `/vault`, has no custom domain, and has no project environment variables.
- Do not describe the owner web vault as deployed.

## Execution Plan

### 1. Complete protected cross-client smoke and PR review — complete

The repeatable local leg passed with a dedicated identity and synthetic/tagged rows across four representative categories. It covered bidirectional browser/mobile-repository decrypt and edit, optional and multiline fields, forward-field preservation, ciphertext-only rows, browser create/update/delete/restore/permanent-delete, offline failure without a ghost record, protected headers, empty local/session storage, worker relock, and full tagged cleanup.

- The dedicated synthetic identity passed the physical TestFlight build 3 display/edit path: the native app displayed and edited a web-created encrypted record, the web read the native edit, and the tagged record was permanently removed.
- Value-free device evidence: iPhone 12, iOS 26.5.2, TestFlight build 3 — pass.
- Only value-free device/build/pass-fail evidence is retained.

The standard verification and complete local branch diff review passed on 2026-07-21. Docker-backed checks require the local stack started with `npx supabase start --workdir supabase`; starting from the repository root creates a different project id than the checked-in harness expects.

Exit gate passed: physical native UI evidence and branch review completed without observed plaintext leakage, cross-client field loss, ghost/local-divergent state, uncleaned tagged data, or unresolved high-severity finding. Stop for owner review.

### 2. Public website publication — parked

- Complete `apps/web/LEGAL_CONTENT_REVIEW.md` and owner/design/counsel review.
- Configure public domains, TLS, canonical redirect, static caching, headers, monitoring, billing alerts, accessibility/browser checks, and rollback.
- Keep `/claim` inactive and protected routes off public hosts.

Exit gate: approved static content is securely available on the public domain. This does not make the protected vault or claimant portal production-ready.

### 3. Protected owner-vault deployment — blocked

- Decide the owner hostname/origin and deployment boundary.
- Upgrade Supabase to Pro; verify backups, session policy, redirect origins, cookies, CORS/origin checks, CSP, monitoring, rollback, and displacement behavior.
- Deploy protected preview first and rerun authenticated browser/native checks.

Exit gate: hosted configuration and cross-client session/data behavior pass, with no unresolved high-severity security issue, before external authenticated users are considered.

### 4. Native links — future

- Add exact Apple association and Android asset-link files, narrow entitlements/intent filters, safe browser fallback, and path allowlists.
- Never place emergency secrets in links.
- Verify installed/not-installed, malformed, and hostile cases on physical iOS and Android devices.

### 5. Claim protocol and threat model — blocked on decisions

- Resolve release authority and legal/privacy/operator responsibilities.
- Specify V2 code, registered-recipient cryptography and claimant-key custody, route-specific release material, state machine, roles, API, RLS, audit, error, abuse, retention, and compatibility contracts.
- Produce protocol vectors, property/replay/guessing analysis, browser KDF benchmarks, and RLS attack designs.

Exit gate: written owner/security/legal approval and no unresolved critical threat. No live claim yet.

### 6. Claim implementation — future gated slices

Only after step 5 approval:

1. Registered-recipient invitation, MFA, client keys, owner grant finalization, replacement, and revocation — no release.
2. V2 offline-code initiation — controlled submitted claim only, no release.
3. Evidence quarantine, if approved — synthetic documents first, with privacy and operational controls.
4. Review/challenge/cooldown/release state machine — approved server/database transitions only.
5. Local read-only claimant viewer and invitation-only pilot — focused security review or penetration test first.

Each slice must define non-goals, tests, rollback/kill switch, value-free evidence, and an owner stop gate.

## Next Session Opener

First pass protected CI, then create the next controlled internal TestFlight candidate and run the combined physical-iPhone regression for the repaired biometric path and owner-side trusted-person information route. Cover enablement, background lock, prompt success/cancel/error, expired-session password fallback, returning-user recovery, navigation, Emergency Readiness, encrypted CRUD, and sealed-code status. Keep distribution internal and do not promote the candidate until it passes. The trusted-person page remains informational only; do not add invitations, recipient accounts, key custody, grants, or claimant runtime.

The claimant journey and delivery map are already documented. Both registered recipients and V2 code holders enter the same claimant portal and later converge on application, evidence, review, cooldown, approval, and encrypted read-only retrieval. Neither registration nor code possession authorizes release.

Begin claimant Slice 2 decision closure in parallel with that final physical QA. Use the existing delivery map, and resolve the Android transaction-binding design/minimum platform, physical iOS and representative Android custody evidence, independent review, claimant key recovery/multi-device policy, release authority, jurisdictions, evidence/retention, cooldown/challenge, reviewer separation, and owner/claimant origin boundary. Produce decisions and approval gates only; do not add runtime claimant behavior.

Only after those gates are explicitly approved may a bounded registered/verified-recipient setup slice be authorized. That future slice stops before claim submission, document intake, review, or release.

Authentication, persistence, migrations, APIs, invitations, evidence handling, notifications, workflow processors, and release behavior remain disabled until their specific slice and unresolved approval gates are approved.

## Cost, Resilience, And Performance Constraints

- Do not claim multi-region database failover; Supabase has one primary region.
- Use transactions, bounded retries, idempotency, and outbox/processor patterns for durable claim workflows.
- Restore testing is mandatory before live claims; select PITR or an explicitly accepted recovery-point strategy.
- Add indexes and higher-tier infrastructure from measured query/load evidence, not speculation.
- Paginate and limit response sizes from the first claimant API.
- Keep public content static, lazy-load crypto, run heavy KDF work in a worker, and benchmark GCC latency and representative devices.
- Recheck current Vercel, Supabase, domain, messaging, storage, and legal costs before purchasing. Configure billing alerts and deliberate spend controls.

## Standard Verification

```powershell
npm run typecheck
npm run lint
npm test --workspaces --if-present
npm run build --workspace @vault/web
npm run test:coverage --workspace @vault/mobile
npm run doctor --workspace @vault/mobile
npm run check:phase1
npm run check:security
npm run check:github-actions-security
npm run check:mobile-secrets
npm run check:supabase-db-security
npm run check:supabase-rls
npm run check:claim-vectors
npm run check:claim-vector-isolation
npm run check:claim-custody-isolation
npm run sbom:release
npm audit --omit=dev --workspaces --audit-level=high
```

Add phase-specific browser, native, API, database, and deployment checks. Unit tests alone do not prove browser/native flows, and a desktop browser does not prove native associations.

## Startup Checklist

1. Read `HANDOFF.md`, `SECURITY_HANDOFF.md`, this file, and `apps/web/LEGAL_CONTENT_REVIEW.md`.
2. Inspect branch, status, recent commits, and whether the hosted state changed.
3. Preserve unrelated changes and expected local-only files.
4. Confirm the active step above; do not select work from historical phase numbering.
5. Verify the environment is still protected development. Stop if production readiness or external users are proposed before their gates pass.
6. Restate scope/non-goals, complete one bounded slice, verify it, update the handoffs, and stop for owner review.
