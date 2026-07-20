# Sanduqkin Website, Owner Web Vault, And Claimant MVP Handoff

Last updated: 2026-07-20 (Asia/Dubai)

## Current Decision

Continue protected core-flow validation before public website publication or claimant implementation.

- API region alignment and the web workspace scaffold are merged on `main`.
- Static landing/legal content is implemented and protected-preview-verified, but publication is parked pending owner/design/legal approval.
- The current branch implements the protected owner web vault and shared mobile/web 17-category engine. It is committed but not deployed.
- The repeatable local browser/mobile-repository smoke passed; the next slice is the remaining TestFlight build 3 native-UI confirmation and branch PR-readiness review.
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
| Mobile owner vault | `apps/mobile` | Native app | TestFlight build 3 in controlled QA |
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
3. Only the public key and an approved encrypted private-key recovery package leave the client.
4. The unlocked owner client creates a recipient-specific sealed MEK grant.
5. A later claim still requires identity, evidence, challenge/cooldown, and release authorization.
6. After authorized release, ciphertext and claimant-specific sealed material decrypt locally into a read-only view.

The existing `pre_authorized_kin` symmetric-key helper is not a finished public-key or account-bound recipient protocol.

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

### Completed on the current branch, not deployed

- Static landing/legal/support/accessibility/security routes and inactive `/claim` preview.
- Supabase web authentication foundation and server-side protected-route claim validation.
- Deterministic mobile/web crypto compatibility vector and Web Worker key boundary.
- Live owner-only bank-account proof in both cross-client directions with tagged-row cleanup.
- Exhaustive schema-driven registry and encrypted CRUD parity for all 17 current asset types.
- Mobile unknown-field preservation and failed-mutation reconciliation.
- Protected-route nonce CSP and security headers.
- Repeatable local protected smoke across card, contact, medical-care, and business-interest records, including bidirectional edit/decrypt, forward-field preservation, ciphertext-only rows, browser deletion lifecycle, offline failure reconciliation, browser storage/key cleanup, protected headers, and full synthetic cleanup.
- Current regression result: 515 tests passed, 3 protected live tests skipped by default; typecheck, lint, web build, Phase 1/security/workflow/secret guards, and the high-severity production dependency threshold passed. Expo Doctor, mobile coverage, and database guards also passed in the preceding full branch verification.

### Hosted state

- Current hosted web preview is still static deployment `dpl_56CPAxso438Az7z6pmVwisotCiH5`, protected by Vercel SSO.
- It predates `/login` and `/vault`, has no custom domain, and has no project environment variables.
- Do not describe the owner web vault as deployed.

## Execution Plan

### 1. Complete protected cross-client smoke and PR review — next

The repeatable local leg passed with a dedicated identity and synthetic/tagged rows across four representative categories. It covered bidirectional browser/mobile-repository decrypt and edit, optional and multiline fields, forward-field preservation, ciphertext-only rows, browser create/update/delete/restore/permanent-delete, offline failure without a ghost record, protected headers, empty local/session storage, worker relock, and full tagged cleanup.

- Repeat the cross-client display/edit path through the physical TestFlight build 3 UI with a dedicated synthetic identity; local repository execution is not physical-device evidence.
- Record only value-free device/build/pass-fail evidence and remove all tagged data and the identity.
- Run the standard verification and inspect the complete branch diff for PR readiness.

Exit gate: physical native UI evidence and branch review pass without plaintext leakage, cross-client field loss, ghost/local-divergent state, uncleaned test data, or unresolved high-severity finding. Stop for owner review.

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
- Specify V2 code, registered-recipient cryptography, state machine, roles, API, RLS, audit, error, abuse, retention, and compatibility contracts.
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
