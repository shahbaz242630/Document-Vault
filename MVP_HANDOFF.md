# Sanduqkin MVP Website And Claimant Portal Handoff

Last updated: 2026-07-19 (Asia/Dubai)

## Session Opener

> Read `HANDOFF.md`, `SECURITY_HANDOFF.md`, and this document before starting MVP website work. The approved direction is a separate Next.js web application in the existing monorepo, deployed as its own Vercel project, with `sanduqkin.com` for the public site, `app.sanduqkin.com` for the isolated claimant portal, and `api.sanduqkin.com` for the canonical Hono API shared with the mobile app. Hostinger remains the registrar/DNS provider and Supabase remains the identity and encrypted-data platform. Begin with **MVP Phase 1: API Region Alignment** only. Build the stated slice, run its verification, record evidence, stop for review, and do not begin the next phase automatically. Public and legal website work may proceed as a bounded parallel track; live trusted-recipient, claimant, activation, or release functionality remains gated by the main Phase 1 release/security requirements and by the unresolved release-authority decision in this handoff.

## Purpose And Authority

This handoff is the durable source of truth for the Sanduqkin website MVP and the future claimant portal. It records:

- the repository and live-infrastructure findings verified before implementation;
- the agreed hosting, domain, API, identity, and zero-knowledge architecture;
- the two intended claimant routes;
- security, privacy, legal, resilience, scaling, cost, and performance constraints;
- unresolved decisions that block live data release;
- small implementation phases with explicit build, test, and exit gates; and
- the startup checklist a future session needs to continue without reconstructing prior discussions.

The phase numbers in this document describe the **website/claimant MVP track**. They do not replace the product phases in `HANDOFF.md` or `Vault_BRD_v1.0.md`.

## Slice Execution Rule

Every phase must follow this sequence:

1. Re-read the three active handoffs and inspect the current branch and working tree.
2. Confirm the phase scope and its non-goals.
3. Build only that narrow slice.
4. Add or update proportionate automated tests and security guards.
5. Run the phase verification plus the repository-wide checks affected by the change.
6. Inspect the diff for secrets, plaintext sensitive data, unrelated changes, and scope creep.
7. Record the result and any residual risk in this handoff.
8. Stop and obtain owner review before beginning the next phase.

Do not combine multiple phases merely because context remains available. A phase is complete only when its exit gate has evidence.

## Repository Baseline

- Repository: `C:\Projects\GitHub\Sandoq Kin`
- GitHub repository: `shahbaz242630/Document-Vault`
- Default/release branch: `main`
- `main` and `origin/main` verified at `88f578a` on 2026-07-19.
- Documentation branch at the time of this handoff: `codex/export-compliance-handoff` at `3e0c99f`, one documentation commit above `main`.
- Clean MVP publication branch: `codex/mvp-api-frankfurt`, created directly from `main` so the unrelated export-compliance commit is excluded.
- Expected unrelated local-only files: `.playwright-mcp/` and `welcome.png`; leave them untracked unless explicitly scoped.
- Monorepo workspaces: `apps/*`, `packages/*`, and `services/*`.
- Existing applications/services:
  - `apps/mobile`: Expo/React Native mobile application;
  - `services/api`: Hono API deployed on Vercel;
  - `packages/shared-types`: currently limited shared types;
  - `packages/shared-validation`: currently limited shared validation.
- No `apps/web` application exists yet.
- No website or claimant flow was implemented by the work that produced this document.

## Verified Live Infrastructure Baseline

Verified read-only on 2026-07-19:

- Supabase project status: `ACTIVE_HEALTHY`.
- Supabase primary database region: `eu-central-1` (Frankfurt).
- Existing Vercel project: `sanduqkin-api`.
- Vercel project root: `services/api`.
- Vercel Node.js version: `24.x`.
- Inspected production deployment route: `api/index` running in `iad1` (Washington, D.C.).
- `services/api/vercel.json` contains rewrites but no explicit function region.
- Hostinger domain registration was reported by the owner; DNS records and domain ownership were not independently changed or verified in this documentation slice.

### Immediate Performance Finding

The production API compute and Supabase database are currently on different continents. Database-dependent requests can travel from Vercel Washington to Supabase Frankfurt and back.

The first implementation slice must place the API function in Vercel `fra1` (Frankfurt), verify the deployed build reports `fra1`, and confirm health and existing processor routes still pass. Static website content will continue to be distributed globally by Vercel's CDN; this placement affects dynamic server-side compute, not the public CDN or the database location.

Do not assume the change succeeded merely because `vercel.json` validates. Inspect the resulting production or protected preview deployment.

## Approved Target Architecture

### Deployment And Domain Map

| Surface | Repository root | Hostname | Responsibility |
| --- | --- | --- | --- |
| Mobile application | `apps/mobile` | Native app | Owner vault, owner-side encryption, owner controls |
| Public website | `apps/web` | `sanduqkin.com` | Landing, product information, security explanation, legal and support pages |
| Canonical redirect | `apps/web` | `www.sanduqkin.com` | Permanent redirect to `sanduqkin.com` |
| Claimant portal | `apps/web` | `app.sanduqkin.com` | Isolated authentication, claim application, status, and eventual local decryption |
| Shared API | `services/api` | `api.sanduqkin.com` | Canonical mobile/web contracts, authorization, claim state machine, rate limits, audit |
| Identity/data | Supabase | Managed service | Authentication, RLS-protected metadata, ciphertext, sealed key packages, audit state |
| DNS/registration | Hostinger | Domain control | DNS records pointing approved hosts to Vercel |

### Web Technology Decision

- Create `apps/web` using Next.js App Router and TypeScript.
- Deploy it as a separate Vercel project rooted at `apps/web`.
- Keep the API as a separate Vercel project rooted at `services/api`.
- Statically generate public product and legal content wherever possible.
- Use dynamic server execution only for authenticated claimant operations.
- Keep the Hono API as the canonical business API used by both mobile and web.
- Use shared packages for versioned API schemas, validation, identifiers, and safe protocol types as the flow is designed.
- Do not move privileged claim logic into page components or create a second independent claim implementation in Next.js.

### Authenticated Web Boundary

Prefer a thin, same-origin session/BFF layer under `app.sanduqkin.com` so browser code does not need to persist bearer tokens in `localStorage`. The portal may forward authenticated, ciphertext-only requests to the canonical Hono API.

Before standardizing the session implementation, build a narrow proof of concept covering Supabase PKCE sign-in, refresh, sign-out, host-only secure cookies, CSRF/origin enforcement, and server-side user verification. Supabase's SSR helpers and their current stability must be rechecked at implementation time.

The BFF is not permitted to:

- receive or log plaintext vault records;
- receive a claimant private key or its recovery secret;
- hold a master encryption key;
- use browser-exposed service-role credentials; or
- create a second source of truth for claim status.

## Architecture Decision Record

### Confirmed Decisions

- Keep one GitHub monorepo and use separate Vercel projects per deployable root.
- Keep Hostinger as registrar/DNS rather than migrating registration merely for hosting.
- Use separate public and claimant hostnames as a real browser-origin boundary.
- Keep one canonical Hono API for mobile and web.
- Keep the existing Supabase project and identity system for the MVP.
- Co-locate dynamic Vercel compute with the Frankfurt Supabase primary.
- Keep marketing and legal pages static and independent from API health.
- Preserve zero knowledge: infrastructure stores ciphertext and controlled metadata, never normal vault plaintext.
- Use client-generated recipient key material and client-side release decryption.
- Keep `/claim` inactive until the threat model, protocol, database policy, and authorization gates pass.
- Refer to an applicant as a **claimant** and a user-selected person as a **trusted recipient** unless legal counsel approves a jurisdiction-specific “next of kin” assertion.

### Rejected Or Unsafe Assumptions

- A valid account does not prove a family relationship.
- Possession of a handover code does not prove identity or legal entitlement.
- MFA proves control of authentication factors, not entitlement to released data.
- A backend re-encryption step involving plaintext MEKs is not compatible with the zero-knowledge promise.
- A Vercel multi-region function does not make a single-primary Supabase database multi-region.
- Preview deployments must not use production claimant data.
- A URL query parameter must not contain the full emergency secret.
- Existing owner-only RLS policies do not automatically support claimants.
- An owner-approval-only flow does not solve the case where the owner is deceased or incapacitated.

## Current Emergency-Access Code Reality

The repository already contains an emergency-access foundation, but it is not a public claim system.

### Implemented Today

- Mobile generates a 20-character code in five groups of four.
- The alphabet contains 32 unambiguous characters, providing approximately 100 bits before any generation-bias analysis.
- The raw code is shown once and is not stored by the repository.
- The code derives a wrapping key with Argon2id.
- Current Argon2id parameters are 256 MiB memory, three operations, and a 32-byte output.
- The MEK is wrapped with XChaCha20-Poly1305 and associated data.
- Supabase stores the sealed package, KDF metadata, nonce, ciphertext, status, and safe audit events.
- Tests assert that the raw code and plaintext MEK are not serialized.

### Not Implemented Today

- A public, non-secret locator for finding the correct grant.
- A domain-separated possession proof that avoids sending the raw secret.
- Claimant registration, identity verification, or MFA enforcement.
- Relationship/evidence review.
- A claimant-readable RLS/API model.
- A server-enforced release state machine.
- Notification, cooldown, challenge, or release authority.
- Browser-side KDF performance verification.
- A read-only claimant vault viewer.

### Required V2 Code Design

Before a web code-claim route becomes active, define a versioned code with:

- a public locator safe to submit to the API;
- a separate high-entropy client-only secret;
- an optional domain-separated possession proof derived locally;
- strict expiry, attempt limits, throttling, abuse monitoring, and revocation;
- no raw secret in query strings, analytics, logs, audit metadata, support tools, or database rows; and
- compatibility behavior for existing version-one sealed codes.

Existing grants have no public locator. Do not solve this by scanning all grants or sending the full secret to the server. The likely migration is owner-confirmed regeneration into the V2 format after the protocol is approved. Do not revoke an existing active code automatically.

The 256 MiB Argon2id setting may be expensive in mobile browsers. Benchmark the exact WebAssembly/browser implementation in a Web Worker across representative iPhone, Android, desktop, and low-memory devices. Do not silently lower the KDF cost; any change requires a documented cryptographic review and compatibility plan.

## Intended Claimant Routes

### Route A: Registered Trusted Recipient

Intended sequence, subject to threat-model approval:

1. The owner nominates a trusted recipient in the mobile app.
2. Sanduqkin sends a value-free invitation through the approved notification provider.
3. The recipient creates or verifies a Sanduqkin identity and enrolls MFA.
4. The recipient client generates a public/private key pair locally.
5. Only the public key and an approved encrypted private-key recovery package leave the client.
6. The owner is prompted to unlock the mobile vault and locally creates a recipient-specific sealed MEK grant using the recipient public key.
7. The recipient may later submit a claim, but claim submission does not release data.
8. Identity, evidence, challenge/cooldown, and release authorization occur as separate states.
9. After authorized release, infrastructure returns ciphertext and the recipient-specific sealed package.
10. The recipient client decrypts locally into a read-only experience.

The current `pre_authorized_kin` helper accepts a symmetric 32-byte wrapping key. It is not yet a complete public-key exchange or account-bound protocol. Do not expose it as if registered-recipient cryptography were finished.

### Route B: Offline Handover Code

Intended sequence, subject to threat-model approval:

1. The owner creates and confirms a versioned sealed code in the mobile app.
2. The owner gives it to a trusted person offline or stores it with important papers.
3. The claimant opens the website or app and submits only the public locator initially.
4. The claimant authenticates, enrolls MFA, and completes client-side code-possession proof.
5. The claimant applies for release and supplies only evidence approved by the future legal/security design.
6. The same controlled review, challenge/cooldown, and release state machine applies.
7. Only after authorized release does the client receive the sealed package and encrypted records.
8. The client uses the secret locally to unwrap the MEK and decrypt a read-only view.

Do not treat knowledge of the code as automatic release authorization.

## Unresolved Product And Legal Blocker: Release Authority

Live release cannot be implemented until the owner decides, with security and legal review, who or what authorizes release when the vault owner cannot respond.

The design must explicitly answer:

- Is release approved by the living owner, a Sanduqkin operations reviewer, a documented legal process, trusted witnesses, an inactivity/cooldown rule, or a defined combination?
- What evidence is accepted, for which jurisdictions, and who is qualified to evaluate it?
- How is the owner notified and allowed to challenge or cancel a fraudulent request?
- What waiting period applies, and what events restart or stop it?
- What happens if an owner loses access but is alive?
- What appeal, dispute, and audit process exists?
- Which entity is the data controller/operator and what governing law applies?

Until this is approved, the website may explain the future process and accept no real claim submission. Do not imply that Sanduqkin legally certifies a next-of-kin relationship.

## Database And API Gaps

Existing Supabase tables are `emergency_contacts`, `emergency_key_grants`, and `emergency_release_requests`. Their current authenticated RLS policies are owner-based through `auth.uid() = user_id`. Anonymous access has been revoked.

Therefore, the current schema cannot safely support a claimant. Before changing it:

- write the protocol and threat model first;
- define separate owner, claimant, reviewer/service, and processor capabilities;
- prefer explicit API-mediated transitions plus defense-in-depth RLS;
- require `aal2` for sensitive operations;
- add immutable or append-only state-transition audit records;
- use database constraints to prevent illegal state changes;
- use idempotency keys for claim submission and release operations;
- keep PII and verification metadata minimal, classified, and retention-bound;
- use append-only migrations rather than editing applied migrations; and
- extend hosted RLS attack tests for cross-user, anonymous, claimant, stale-token, and replay scenarios.

Candidate concepts may include invitations, claimant identities, recipient public keys, code locators, claims, claim events, release authorizations, and sealed release packages. Final table names and schemas are intentionally deferred to the design slice.

## Security Requirements

### Identity And Authorization

- Distinguish authentication, code possession, identity proofing, relationship/entitlement review, and release authorization.
- Require Supabase MFA assurance level `aal2` for key registration/replacement, claim submission, release approval, and sealed-package retrieval.
- Re-verify the user server-side for every sensitive request.
- Use least-privilege API credentials and explicit authorization at every transition.
- Apply CAPTCHA and layered rate limits to public/authentication/claim-entry endpoints.
- Prevent account and locator enumeration with uniform responses and bounded timing.
- Never rely on client-supplied claim status, owner ID, grant ID, reviewer role, or assurance level.

### Browser And Network

- Keep authentication cookies host-only; never set `Domain=.sanduqkin.com`.
- Use `Secure`, appropriate `SameSite`, short session bounds, rotation, revocation, and CSRF/origin checks.
- Prefer no persistent bearer token in `localStorage` or `sessionStorage`.
- Use strict CSP with nonces/hashes where dynamic scripts require them.
- Set HSTS, `frame-ancestors 'none'`, `nosniff`, a restrictive referrer policy, and a minimal permissions policy.
- Allow only exact production/preview origins where CORS is necessary.
- Do not run advertising or unnecessary third-party analytics on `app.sanduqkin.com`.
- Mark authenticated and claimant responses private/no-store; do not cache personalized data at the CDN.
- Protect preview deployments and use fake or isolated development data.

### Zero-Knowledge And Cryptography

- Never send plaintext vault content, a raw MEK, a claimant private key, recovery phrase, seed phrase, password, or full emergency secret to Vercel, Supabase, GitHub, analytics, logs, support systems, or email.
- Keep the Supabase service-role key only in the canonical API/processor environment, never in browser code or `NEXT_PUBLIC_*` variables.
- Recipient key pairs are generated client-side.
- Owner-side grant finalization occurs only after the owner unlocks the mobile vault.
- Browser decryption occurs locally and should keep plaintext in memory for the shortest practical time.
- Do not add export, download, print, clipboard, or persistent offline storage to the claimant viewer without a separate threat review.
- Use versioned cryptographic envelopes and domain-separated associated data/proofs.
- Obtain focused cryptographic review before selecting the public-key sealed-box construction and recovery design.

### Logging And Privacy

- Logs and audit events must remain value-free: identifiers, safe state, timestamps, reason codes, and correlation IDs only.
- Never log request bodies on claim or release endpoints.
- Define retention and deletion for claimant PII, rejected claims, evidence, operational logs, and audit records before collecting them.
- Do not add claimant document uploads in the initial MVP. If later required, design an isolated quarantine/scan/review/storage pipeline with allowlisted types, size limits, randomized names, malware scanning, access control, encryption, and deletion.

## Resilience, Scaling, Cost, Optimization, And Performance

### Resilience

- Static marketing/legal content must remain available when Supabase or the API is degraded.
- Supabase is currently a single primary region; do not claim multi-region database failover.
- Keep durable workflow state in Postgres, never in Vercel process memory.
- Use transactional state changes, retries with bounds, idempotency, and an outbox/processor pattern for notifications.
- Maintain an external uptime check for the public site, portal health, API health, and critical processors.
- Supabase Pro daily backups are adequate for the static-site phase; run a restore drill before live claims.
- Before live claims, select PITR or document an equivalent acceptable recovery strategy and recovery-point objective.
- Keep schema, configuration, functions, and operational runbooks reproducible because a database restore alone does not recreate every service setting or stored object.

### Scaling

- The proposed Next.js/Vercel plus Hono/Vercel plus Supabase design is sufficient for MVP traffic.
- Do not buy read replicas, multi-region compute, or Enterprise plans without measured need.
- Read replicas do not make Auth, Storage, or Realtime multi-region and should not be treated as a claim-flow availability solution.
- Add indexes from observed query plans and load tests, not speculation.
- Apply pagination and response-size limits from the first claimant API version.

### Cost Baseline

Pricing verified on 2026-07-19 and must be rechecked before purchasing:

- Vercel Pro starts around USD 20 per developer/month plus usage.
- Supabase Pro starts around USD 25/month and includes the first project's micro compute credit.
- A separate always-on Supabase development project may add compute cost.
- Supabase PITR was listed as an additional paid capability, around USD 100/month for seven days.
- Domain registration, transactional email/SMS, legal review, taxes, storage, and usage overages are separate.
- A second Vercel project does not inherently require a second developer seat.

Configure billing alerts and a deliberate spend limit. Do not rely on a free/personal hosting tier for commercial production.

### Optimization And Performance

- Statically render landing, features, security, privacy, terms, deletion, and support pages.
- Keep authenticated portal pages dynamic and explicitly non-cacheable.
- Place API and authenticated web compute in `fra1` near Supabase `eu-central-1`.
- Lazy-load browser cryptography only on routes that need it.
- Run Argon2 and heavy cryptography in a Web Worker to avoid freezing the UI.
- Benchmark GCC user latency and browser KDF performance before activation.
- Keep API calls coarse enough to avoid repeated database round trips.
- Use Vercel monorepo project roots and affected-build skipping; use GitHub path filters so web-only changes do not trigger expensive native CI unnecessarily.

## Public Website And Legal Content

Initial public routes:

- `/` - landing page and clear product positioning;
- `/features` - current features only, with future functionality labeled accurately;
- `/how-it-works` - zero-knowledge owner flow and controlled future claim concept;
- `/security` - plain-language security model and responsible disclosure contact;
- `/privacy` - public privacy policy;
- `/terms` - terms of use;
- `/account-deletion` - public deletion instructions consistent with the in-app process;
- `/support` - support and contact path; and
- `/claim` - inactive informational entry until activation gates pass.

Legal pages should be accessible HTML, stable, versioned in Git, dated, and available without authentication or geographic blocking. Before publication, obtain the legal entity name, controller/contact address, privacy/support contacts, governing law, processor list, data categories, purposes, retention periods, deletion behavior, cross-border transfer position, and counsel approval appropriate to the initial GCC scope.

Do not add non-essential cookies or trackers by default. If analytics is later proposed, perform a separate privacy/consent review and keep analytics off the claimant origin unless specifically approved.

## Mobile And Web Linking

The mobile app currently has the custom scheme `sanduqkin` but no verified iOS Associated Domains configuration or Android App Links intent filters.

The future linking slice must:

- serve `/.well-known/apple-app-site-association` without redirects or secrets;
- serve `/.well-known/assetlinks.json` with the verified Android package and signing-certificate fingerprint;
- add the exact iOS associated domain entitlement;
- add narrow Android HTTPS intent filters;
- use an allowlisted path grammar and never place an emergency secret in a universal/app link query string;
- provide safe browser fallback behavior; and
- test on physical iOS and Android builds because native association changes are not proven by a browser-only test.

## GitHub And Delivery Controls

- Preserve required reviews and checks on `main`.
- Add web typecheck, lint, unit/component tests, build, dependency audit, secret scanning, and focused browser smoke coverage.
- Extend `CODEOWNERS` for `apps/web`, shared claim contracts, claim migrations, legal pages, and domain-association files.
- Keep GitHub Actions pinned to immutable commit SHAs and update deprecated action runtimes in their own tooling slice.
- Enable Dependabot, secret scanning, push protection, and dependency review where the repository plan supports them.
- Use least-privilege workflow permissions.
- Never expose production environment secrets to pull-request workflows or untrusted forks.
- Protect Vercel previews and connect them only to fake or isolated non-production data.
- Use concurrency cancellation and path filters to control CI cost.

## Implementation Phases

### MVP Phase 1: API Region Alignment

**Status:** Implemented and production-verified on 2026-07-19; owner review and durable repository integration are pending. See `Phase Completion Evidence` below.

**Objective:** remove the verified Washington-to-Frankfurt dynamic-data path before adding web traffic.

**Build:**

- Add the supported `fra1` region setting to the existing `services/api` Vercel configuration.
- Add a narrow regression check so removal or accidental reversion is detected.
- Do not alter database regions, endpoints, secrets, API behavior, or processors.

**Test:**

- Validate configuration and run API typecheck/tests.
- Run repository security/configuration guards affected by the edit.
- Deploy through the approved Vercel path.
- Inspect the deployed function and verify `api/index` reports `fra1`.
- Verify health, account-deletion, audit-retention, and RevenueCat route behavior without emitting sensitive values.
- Compare a small set of value-free latency measurements before and after.

**Exit gate:** production or approved target deployment is healthy in `fra1`, existing API checks pass, and rollback is documented. Stop for review.

### MVP Phase 2: Web Workspace Scaffold

**Objective:** create a production-quality but content-minimal `apps/web` foundation.

**Build:**

- Scaffold Next.js App Router with TypeScript under `apps/web`.
- Integrate root workspaces, lint, typecheck, tests, and deterministic build.
- Add a minimal accessible shell, metadata, error/not-found pages, and static health signal.
- Create a separate Vercel project rooted at `apps/web` using non-production configuration.
- Add no Supabase secret, claim endpoint, authentication, analytics, or browser cryptography.

**Test:**

- Web typecheck, lint, unit tests, production build, dependency audit, and local browser smoke.
- Confirm existing mobile/API tests remain green.
- Inspect the client bundle and deployment environment for secrets.
- Verify preview protection and that the preview cannot access production claimant data.

**Exit gate:** an isolated preview renders correctly and all new/existing required checks pass. Stop for review.

### MVP Phase 3: Landing And Legal Information

**Objective:** deliver the public informational MVP without enabling claims.

**Build:**

- Implement the approved public routes and responsive navigation/footer.
- Use accurate present-tense feature copy and label future claim features clearly.
- Add draft/versioned privacy, terms, deletion, support, security, and accessibility content with unresolved legal fields visibly tracked outside published copy.
- Keep `/claim` informational and inactive.

**Test:**

- Accessibility, keyboard, responsive, SEO metadata, broken-link, and browser smoke tests.
- Validate legal pages are public HTML and contain correct effective/version information.
- Confirm no form suggests that a live claim can be submitted.
- Confirm no non-essential cookie or tracker is introduced.

**Exit gate:** owner approves content/design, legal placeholders are resolved or publication remains blocked, and the static build passes. Stop for review.

### MVP Phase 4: Production Domains And Web Hardening

**Objective:** publish the static MVP safely on the registered domain.

**Build:**

- Attach `sanduqkin.com` and `www.sanduqkin.com` to the web project using exact Vercel-provided DNS records in Hostinger.
- Redirect `www` canonically to the apex domain.
- Reserve `app.sanduqkin.com` for the claimant portal and `api.sanduqkin.com` for the Hono API; do not activate claim routes.
- Add strict security headers, cache policy separation, robots/sitemap, and minimal operational monitoring.
- Set billing alerts/spend controls.

**Test:**

- DNS, TLS, redirect, caching, CSP/header, uptime, accessibility, and browser checks.
- Confirm public static pages remain usable during a controlled API-unavailable test.
- Confirm claimant/private routes are not indexed and `/claim` remains inactive.

**Exit gate:** the public/legal website is securely available on the production domain with monitoring and rollback evidence. This is the first public website MVP milestone. Stop for review.

### MVP Phase 5: Universal Links And App Links

**Objective:** connect approved website paths to the installed mobile app without exposing secrets.

**Build:**

- Add and serve the Apple and Android association files.
- Add exact native entitlements/intent filters for approved HTTPS paths.
- Define browser fallback and route allowlists.
- Keep secret material out of links.

**Test:**

- Validate association files, content types, TLS, and redirects.
- Test installed/not-installed behavior on physical iOS and Android builds.
- Test malformed, hostile, and unapproved routes.
- Run native build/security checks required by the app configuration change.

**Exit gate:** approved links open only intended routes on both platforms, browser fallback is safe, and no claim secret enters network logs. Stop for review.

### MVP Phase 6: Claim Protocol, Threat Model, And Contracts

**Objective:** approve the system before exposing a real claimant endpoint.

**Build:**

- Produce data-flow and threat models for both claimant routes.
- Resolve release authority, evidence, cooldown/challenge, jurisdiction, retention, and operator responsibilities.
- Specify versioned cryptographic envelopes and the V2 locator/secret format.
- Define API contracts, state transitions, roles, RLS rules, audit events, abuse controls, error semantics, and compatibility.
- Prototype portal session/BFF behavior and browser cryptography performance without production data.

**Test:**

- Security design review against current OWASP ASVS Level 2, transaction authorization guidance, NIST identity separation, and applicable privacy requirements.
- Protocol test vectors, state-machine property tests, replay/guessing analysis, and browser KDF benchmarks.
- RLS policy tests designed before migrations are approved.

**Exit gate:** written owner/security/legal approval of release authority and protocol; tests demonstrate feasibility; no unresolved critical threat. Stop for review. No live claim yet.

### MVP Phase 7: Registered Trusted-Recipient Foundation

**Objective:** implement invitation, identity, MFA, public-key registration, and owner-side grant finalization without release.

**Build:**

- Add invitation and recipient identity/account linking.
- Enforce verified authentication and `aal2` for key operations.
- Generate claimant key pairs client-side and store only approved public/encrypted material.
- Add owner-mobile confirmation and local recipient-specific MEK wrapping.
- Add revocation/replacement and value-free audit behavior.

**Test:**

- Cross-account/RLS attacks, invitation enumeration, replay, expired invitation, key substitution, stale session, downgrade, revocation, and lost-device cases.
- Mobile/web/API integration using non-production identities and ciphertext-only fixtures.
- Confirm no private key, raw MEK, or plaintext enters infrastructure or logs.

**Exit gate:** a recipient can be safely registered and granted sealed material, but cannot submit or receive a live release. Stop for review.

### MVP Phase 8: V2 Offline-Code Claim Initiation

**Objective:** permit safe claim initiation using the new split locator/secret design without data release.

**Build:**

- Implement owner-side V2 code creation/regeneration and explicit legacy handling.
- Implement public locator lookup, client-side possession proof, authentication/MFA, throttling, CAPTCHA, expiry, and revocation.
- Create a submitted claim record with minimal metadata.
- Keep release and decryption disabled.

**Test:**

- Brute force, enumeration, replay, timing, malformed code, revoked code, expired proof, duplicate submission, rate-limit bypass, logging, URL/referrer, and analytics leakage tests.
- Benchmark client KDF and verify Web Worker isolation.
- Confirm existing V1 grants are neither exposed nor silently revoked.

**Exit gate:** an authorized test claimant can create only a controlled submitted claim, with no access to a sealed package or vault data. Stop for review.

### MVP Phase 9: Review, Challenge, And Release State Machine

**Objective:** implement the separately approved authorization process.

**Build:**

- Implement legal state transitions, owner/operator notifications, challenge/cancel, cooldown, approval/rejection, idempotency, immutable audit, and bounded processors.
- Enforce role, `aal2`, time, evidence, and transition constraints server-side and in the database.
- Produce only recipient-specific sealed release packages.

**Test:**

- Illegal transition, role confusion, replay, concurrent approval/rejection, processor retry, notification failure, owner challenge, expired authorization, insider misuse, audit tampering, backup/restore, and incident rollback tests.
- Conduct a restore drill and confirm the recovery objective is acceptable.

**Exit gate:** the state machine cannot be bypassed in automated and manual security testing; release authority and operations runbooks are approved. Stop for review.

### MVP Phase 10: Local Read-Only Claimant Viewer And Pilot

**Objective:** deliver approved ciphertext for local browser/app decryption and conduct a controlled pilot.

**Build:**

- Retrieve only an authorized claimant-specific sealed package and encrypted records.
- Decrypt locally into a read-only, non-persistent viewer.
- Add memory/session cleanup, re-authentication, lock/timeout, safe error handling, and support/incident paths.
- Keep export, clipboard, offline persistence, and sharing disabled unless separately approved.

**Test:**

- End-to-end registered-recipient and code-route tests on representative browsers/devices.
- XSS/CSP, session theft, cache, back-button, browser history, crash/reporting, screenshot-risk messaging, memory/performance, accessibility, and logout cleanup checks.
- Independent security review or focused penetration test before real claimant data.
- Small invitation-only pilot with monitoring, support ownership, kill switch, and rollback.

**Exit gate:** owner accepts pilot evidence and residual risks before any broader claimant launch. Stop and update all active handoffs.

## Phase Completion Evidence

### MVP Phase 1: API Region Alignment - Implemented And Production-Verified 2026-07-19

**Implemented:**

- Added the project-level `"regions": ["fra1"]` setting to `services/api/vercel.json`.
- Added `services/api/src/deployment-config.test.ts`, which fails unless the API has exactly one configured execution region and it is `fra1`.
- Did not change Supabase, endpoints, credentials, processors, database schemas, or API behavior.

**Provider verification:**

- Rechecked Vercel's official function-region documentation before implementation; the page was last updated 2026-07-01 and confirms the project-level `regions` array.
- The installed global Vercel CLI `46.0.2` could inspect existing deployments but was rejected by the current deployment endpoint as outdated.
- The owner completed Vercel's device-login flow for the current CLI.
- Preview deployment `dpl_5F5GAtQd7r6vwQUSjdmAaqoMrxv2` reached `READY`; inspection reported `api/index` in `fra1`, and its protected `/health` route returned `200` with the expected value-free body.
- Production deployment `dpl_7dVi7pRcxw6EbcxgbLviSsJrS4Jj` reached `READY`, received the `https://sanduqkin-api.vercel.app` alias, and inspection reported `api/index` in `fra1`.

**Automated verification:**

- API focused region test: 1 passed.
- API full suite: 11 files and 28 tests passed.
- Repository typecheck passed across mobile, shared packages, and API.
- Repository lint passed with zero warnings.
- Workspace tests passed: mobile 343 passed/2 protected live tests skipped, shared validation 10 passed, and API 28 passed.
- Phase 1 DoD, security, GitHub Actions security, and mobile-secret guards passed.
- Production dependency audit remained at the accepted high-severity threshold: no high or critical finding; 12 known moderate `uuid` findings remain through Expo tooling, and the offered force fix is breaking.
- The local Supabase database security command could not connect because Docker Desktop's local Supabase container was not running. No schema or database policy changed in this phase, and the migration/schema assertions included in the passing mobile suite were unaffected. A hosted/local database security run is not required to establish the function-region change, but the standard database guard remains required for any later schema slice.

**Production behavior:**

- `/health` returned `200` after cutover.
- Unauthenticated account-deletion request and both internal processor routes retained their pre-change `401` behavior.
- The unauthenticated RevenueCat route retained its pre-change `503` behavior under its current production configuration; this slice did not change or claim readiness for Phase 3 payments.
- Five value-free health samples before the change ranged from approximately 275 ms to 1,503 ms with a 514 ms median; five after the change ranged from approximately 289 ms to 689 ms with a 531 ms median. The warmed health route was effectively flat, as expected because it does not call Supabase. No database-latency improvement is claimed without a protected, controlled benchmark. The verified architectural improvement is removal of the Washington-to-Frankfurt function/database placement mismatch.

**Rollback:**

- Immediate operational rollback target: prior production deployment `dpl_9DacBVy4HVf4Zcetw5Ux4bgM9MkN` (`sanduqkin-4ck7e91zr-shahbaz-ali-maliks-projects.vercel.app`).
- Current CLI command: `npx --yes vercel@56.3.2 rollback dpl_9DacBVy4HVf4Zcetw5Ux4bgM9MkN --yes`.
- A durable rollback must also revert the `fra1` configuration and its regression expectation before the next production deployment. Do not perform either rollback unless monitoring or functional evidence requires it.

**Residual tooling note:** update the globally installed Vercel CLI in a separate tooling slice; this phase used `npx --yes vercel@56.3.2` to avoid an unrelated global installation change.

**Repository integration gate:** publish the Phase 1 files from clean branch `codex/mvp-api-frankfurt` through focused PR #32 to `main`. The live production deployment was built from the local workspace, so a later Git-driven deployment from unchanged `main` could return the API to `iad1`. Verify PR #32 is merged before beginning MVP Phase 2.

**Next allowed MVP slice after review and repository integration:** MVP Phase 2, Web Workspace Scaffold. Do not combine it with domain publication, legal-content publication, authentication, Supabase integration, or claimant functionality.

## Standard Verification Baseline

Until `apps/web` introduces its own scripts, retain the existing repository checks:

```powershell
npm run typecheck
npm run lint
npm test --workspaces --if-present
npm run check:phase1
npm run check:security
npm run check:github-actions-security
npm run check:mobile-secrets
npm run check:supabase-db-security
npm audit --omit=dev --workspaces --audit-level=high
```

Each new phase must add its exact web/API/database/browser/native commands here or to a phase-specific operations document once they exist. Do not claim a browser flow is verified from unit tests alone, and do not claim a native association flow is verified from a desktop browser.

## Future Session Startup Checklist

1. Read `HANDOFF.md`, `SECURITY_HANDOFF.md`, and `MVP_HANDOFF.md` completely.
2. Run `git status --short --branch` and `git log --oneline --decorate -5`.
3. Preserve `.playwright-mcp/`, `welcome.png`, and any unrelated user changes.
4. Confirm whether the current branch contains commits not yet on `main`.
5. Locate the first MVP phase without a recorded completed exit gate.
6. Recheck time-sensitive provider/framework/security guidance for that phase.
7. Verify live configuration read-only before changing it; never assume dashboard state from repository files alone.
8. Restate the phase scope and non-goals, implement only that phase, verify it, update this document, and stop.

## Official Sources Rechecked For This Decision

These primary sources were reviewed on 2026-07-19. Recheck them when a later phase depends on current behavior or pricing:

- Vercel monorepos: <https://vercel.com/docs/monorepos>
- Vercel custom domains: <https://vercel.com/docs/domains/set-up-custom-domain>
- Vercel CDN and caching: <https://vercel.com/docs/cdn> and <https://vercel.com/docs/caching/cdn-cache>
- Vercel function regions: <https://vercel.com/docs/functions/configuring-functions/region>
- Vercel Fluid compute: <https://vercel.com/docs/fluid-compute>
- Vercel pricing: <https://vercel.com/pricing>
- Supabase production checklist: <https://supabase.com/docs/guides/deployment/going-into-prod>
- Supabase regions: <https://supabase.com/docs/guides/platform/regions>
- Supabase RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase MFA: <https://supabase.com/docs/guides/auth/auth-mfa>
- Supabase server-side auth: <https://supabase.com/docs/guides/auth/server-side>
- Supabase backups: <https://supabase.com/docs/guides/platform/backups>
- Supabase pricing: <https://supabase.com/pricing>
- GitHub Actions secure use: <https://docs.github.com/en/actions/reference/security/secure-use>
- OWASP ASVS: <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP Transaction Authorization: <https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html>
- OWASP HTML5 Security: <https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html>
- OWASP File Upload: <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>
- NIST SP 800-63-4: <https://www.nist.gov/publications/nist-sp-800-63-4-digital-identity-guidelines>
- OAuth 2.0 Security Best Current Practice, RFC 9700: <https://www.rfc-editor.org/info/rfc9700/>
- Apple App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Apple app privacy: <https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/>
- Google Play User Data policy: <https://support.google.com/googleplay/android-developer/answer/17190352>
- UAE data-protection overview: <https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws>

## Security Handoff Decision For This Documentation Slice

`SECURITY_HANDOFF.md` was intentionally not changed. This slice made no production security control, credential, policy, schema, or release-boundary change. Planned MVP security requirements are recorded here. Update `SECURITY_HANDOFF.md` when an MVP phase actually changes the security baseline, introduces a verified control, accepts a residual risk, or changes operational security ownership.

## Next Session Opener

Partner, read `HANDOFF.md`, `SECURITY_HANDOFF.md`, and `MVP_HANDOFF.md` first. MVP Phase 1 is implemented and production-verified: `services/api/vercel.json` pins the API to `fra1`, the regression guard passes, and production deployment `dpl_7dVi7pRcxw6EbcxgbLviSsJrS4Jj` is `READY` with `api/index` verified in Frankfurt beside the Supabase `eu-central-1` primary. Verify that PR #32 from `codex/mvp-api-frankfurt` is merged into `main` so a later Git deployment cannot revert the placement. After that gate, start **MVP Phase 2: Web Workspace Scaffold** only. Create the minimal Next.js App Router and TypeScript workspace under `apps/web`, integrate typecheck/lint/tests/build, add only an accessible static shell and error/health foundations, create an isolated protected Vercel preview project rooted at `apps/web`, verify no secrets or production claimant data are present, record evidence, and stop for owner review. Do not attach production domains, publish unresolved legal copy, add authentication or Supabase, add analytics or browser cryptography, change claim schemas, or activate any claimant route in the same slice.
