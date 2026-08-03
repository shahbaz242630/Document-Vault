# Sanduqkin Security Handoff

Last updated: 2026-08-03 (Asia/Dubai)

## Security Status

Owner-vault controls are implemented and under controlled internal testing. Sanduqkin `1.0.0` Build 7, containing the PR #53 biometric interaction repair, was built and uploaded successfully from exact `main` commit `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; Apple processing/export-compliance confirmation and the full physical Face ID path remain open. Public legal publication, external protected-web access, real claimant data, and all claimant runtime remain disabled.

Repository reference: Build 7 was dispatched from `main`/`origin/main` at `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac` after PR #56. PR #54 remains the closed synthetic claimant review baseline and did not enable claimant runtime.

## Enforced Boundaries

### Zero knowledge

- Passwords, KEKs, MEKs, recovery phrases, private keys, plaintext vault fields, and complete emergency secrets never go to Sanduqkin infrastructure, logs, analytics, URLs, notifications, or support tooling.
- Encryption/decryption and readable PDF export occur only in the active client.
- Mobile and web use versioned authenticated envelopes and the same encrypted owner-vault records.

### Authentication and authorization

- Sensitive operations require server-validated identity and the appropriate fresh assurance level.
- Clients do not choose owner IDs, roles, claim states, approval results, deadlines, or release eligibility.
- Lock, sign-out, timeout, session displacement, and fatal failures must clear decrypted/key state.
- Service credentials remain inside protected processors and never reach clients.

### Browser and origin isolation

- Public, owner, claimant, and API surfaces are separate trust contexts.
- Recommended production hosts are `sanduqkin.com`, `vault.sanduqkin.com`, `app.sanduqkin.com`, and `api.sanduqkin.com`, using host-only cookies and exact origin/CORS/redirect allowlists.
- Do not expose owner or claimant routes on the public host or use a parent-domain cookie.

### Claimant boundary

- Claimant web capabilities and the native custody probe are hard-disabled in code.
- Claimants have no database or Storage path to `vault_assets`, `vault_key_material`, another claim, or another claimant's evidence.
- Future evidence is server-visible sensitive PII and requires an isolated private quarantine, strict file controls, malware scanning, bounded capabilities, retention/deletion rules, and hostile cross-tenant tests.
- Future release remains claimant-addressed ciphertext with native local decryption. Backend/browser-readable PDFs and system-known PDF passwords are out of scope.
- Non-response never causes automatic release; uncertainty moves a case to hold/manual review.

## Verified Controls

- Owner authentication, wrapped-MEK continuity, encrypted CRUD, deletion lifecycle, local PDF export, sealed emergency grant, audit processors, secret guards, CodeQL/ZAP workflows, SBOM generation, and Supabase database/RLS test harnesses exist.
- Browser crypto and active MEK state remain in a Web Worker and are not persisted in browser storage.
- Claim contracts, canonical validation, deterministic synthetic vectors, state invariants, and cross-consumer tests are runtime-disconnected.
- End-to-end claimant acceptance covers the synthetic submission-to-closure ledger, every safe public projection, all seven read-only preview surfaces, hard-disabled runtime capabilities, truthful receipt language, and collapsed private outcomes.
- Claimant contract isolation recursively scans nested production modules; its regression test prevents a return to top-level-only coverage.
- The offline-code V2 KDF profile is synthetic-only and not production-approved.
- Biometric enablement authenticates before storing the MEK; lock-screen restoration uses the authenticated SecureStore read as the single native prompt; password fallback remains available.

## Owner-Web Security Baseline

Research snapshot: 2026-08-03. This baseline applies before any external access to `vault.sanduqkin.com`. It uses [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) Level 2 as the minimum verification target, with selected higher-assurance controls for vault cryptography, authentication, sessions, and recovery. It is informed by the [OWASP Top 10:2025](https://owasp.org/Top10/), [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x10-api-security-risks/), [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), [OAuth 2.0 Security BCP RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700), [W3C CSP Level 3](https://www.w3.org/TR/CSP/), [W3C Trusted Types](https://www.w3.org/TR/trusted-types/), the [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), and [SLSA 1.2](https://slsa.dev/spec/v1.2/). These references guide engineering decisions; they do not establish compliance or certification.

### Code-informed starting point

- Protected `/login` and `/vault` responses already use a per-request nonce CSP, `strict-dynamic`, `no-store`, HSTS on HTTPS, `no-referrer`, clickjacking denial, MIME-sniffing denial, and a restrictive Permissions Policy. The current CSP still permits inline styles and `blob:` workers; both require compatibility-tested reduction.
- The server checks signed Supabase claims before rendering the vault, exposed owner tables use RLS with hostile tests, and the browser MEK remains in a dedicated worker. The worker is valuable key-lifetime containment, but it is not an XSS security boundary: same-origin script execution could read rendered plaintext or invoke authorized client operations.
- The unlocked web vault currently holds decrypted records in React state and has a manual lock only. Automatic inactivity/background lock, session-displacement lock, a complete sign-out path, and browser-data clearing are not yet evidenced.
- The browser talks directly to Supabase. This keeps plaintext out of Sanduqkin servers, but requires JavaScript-readable session material; the resulting XSS/session-theft risk needs an explicit architecture decision and compensating controls before deployment.
- CI actions are pinned to immutable commit SHAs, protected checks include CodeQL/ZAP/dependency/security guards, and release SBOM generation exists. Signed build provenance and verification before deployment are not yet evidenced.

### P0 — required before external owner-web access

- [ ] **OWEB-01 — Origin and cookie isolation:** deploy public, owner, claimant, and API surfaces on their approved separate hosts; use exact CORS and authentication redirect allowlists; prohibit open redirects and parent-domain cookies; verify owner cookies are host-only with `Secure`, approved `SameSite`, narrow `Path`, and no accidental cross-subdomain scope.
- [ ] **OWEB-02 — Session-token architecture decision:** threat-model and approve either a same-origin backend-for-frontend using `HttpOnly` host-only session cookies or the direct Supabase browser-token model with its residual XSS exposure. Record token storage, refresh rotation, fixation prevention, revocation, sign-out, incident rotation, and cross-tab behavior. Do not claim `HttpOnly` protection while client JavaScript must read the token.
- [ ] **OWEB-03 — Deterministic plaintext/key clearing:** clear the worker MEK and every decrypted UI/reference on manual lock, sign-out, route exit, session invalidation/displacement, fatal crypto or repository errors, and an owner-approved short inactivity timeout no longer than 15 minutes. Define and device-test background/visibility behavior, back-forward cache handling, and a safe `Clear-Site-Data` sign-out response without clearing sibling hosts unexpectedly.
- [ ] **OWEB-04 — Strong authentication and fresh assurance:** require verified email and [Supabase `aal2`](https://supabase.com/docs/guides/auth/auth-mfa) for protected owner access through both application checks and RLS where supported; implement secure MFA enrollment, factor replacement, recovery, and anti-lockout operations. Require recent reauthentication for factor/key changes, account deletion, recovery changes, and other high-impact operations. NIST's AAL2 limits of no more than 24 hours overall and one hour inactivity are upper bounds, not Sanduqkin's unlocked-vault target.
- [ ] **OWEB-05 — XSS and CSP closure:** remove `style-src 'unsafe-inline'` and `worker-src blob:` when compatibility tests permit; keep nonce-based scripts, `object-src 'none'`, `base-uri`, `form-action`, and `frame-ancestors`; inventory all DOM injection sinks; pilot Trusted Types in report-only mode before enforcement. Collect CSP reports only through a rate-limited, privacy-filtered endpoint that cannot receive vault plaintext, secrets, full sensitive URLs, or authentication tokens.
- [ ] **OWEB-06 — State-changing request integrity:** allow no state change through `GET`; enforce exact allowed origins and content types; use Fetch Metadata as an additional cross-site rejection signal; require CSRF tokens if cookie-authenticated APIs are adopted, following the [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html); keep authorization and RLS authoritative because CORS/Origin headers are not authorization. Bind destructive operations to the authenticated owner, fresh assurance, replay/idempotency rules, and fail-closed transactions.
- [ ] **OWEB-07 — Abuse and resource controls:** apply endpoint-specific per-account and per-network throttles, progressive login defenses, Supabase Auth rate limits, and privacy-compatible CAPTCHA only where abuse evidence warrants it. Enforce actual parsed-body, field, record-count, execution-time, concurrency, email, and cost limits rather than trusting `Content-Length`; configure provider spend alerts and safe retry ceilings, consistent with [OWASP API4](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/).
- [ ] **OWEB-08 — Supabase production posture:** upgrade to an approved production plan; run Security Advisor; verify RLS and least-privilege grants on every exposed table/view/function/Storage bucket; enforce database SSL and approved network restrictions; migrate to publishable/secret API keys and [asymmetric JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys) where supported; document key rotation/revocation. Approve and test [JWT lifetime, time-boxed and inactivity limits, single-session behavior](https://supabase.com/docs/guides/auth/sessions), refresh-token replay, displaced-device behavior, and AAL claims.
- [ ] **OWEB-09 — Security logging, alerting, and response:** record value-free authentication successes/failures, MFA and recovery changes, session revocation/displacement, authorization denials, destructive operations, processor failures, CSP violations, and administrative/configuration changes. Alert on credential stuffing, abnormal denial/error rates, RLS failures, processor backlog, key/config changes, and audit-pipeline failure. Approve retention, access, clock synchronization, escalation, kill switches, and incident exercises; never log credentials, tokens, MEKs, recovery material, ciphertext payloads, or plaintext vault data.
- [ ] **OWEB-10 — Recovery, deletion, and exceptional-condition safety:** approve encrypted-backup RPO/RTO and retention, complete a restore drill, and prove restored RLS/configuration before reopening traffic. Verify deletion propagation into backups and retained audit data. Make multi-step operations idempotent and transactionally fail closed, including account-deletion persistence plus notification failure, timeouts, duplicate delivery, partial provider outages, and rollback.
- [ ] **OWEB-11 — Authenticated deployment evidence:** run exact-production configuration validation, authenticated owner-flow smoke, hostile cross-owner/RLS tests, CSP/browser compatibility tests, session displacement and timeout tests, restore/rollback exercises, dependency/SBOM review, and privacy-safe DAST from the exact immutable release SHA. No preview URL or static ZAP pass substitutes for the authenticated production-shaped gate.

### P1 — required before broad availability

- [ ] **OWEB-12 — Phishing-resistant option:** evaluate [Supabase's experimental WebAuthn/passkey support](https://supabase.com/docs/guides/auth/passkeys) against recovery, relying-party ID permanence, browser/mobile compatibility, attestation, administrative revocation, and vendor-stability requirements. Offer a phishing-resistant option when the dependency is approved; do not make an experimental API the only recovery path.
- [ ] **OWEB-13 — Supply-chain provenance:** generate and retain [signed artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) tying deployed web/API/mobile artifacts and their SBOMs to the reviewed commit, protected workflow, and environment; verify provenance before promotion. Maintain dependency ownership, vulnerability-intelligence monitoring, emergency update/rollback targets, immutable action pinning, least-privilege workflow permissions, and protected environment review.
- [ ] **OWEB-14 — Domain and operator resilience:** protect registrar, DNS, GitHub, Vercel, Supabase, Apple, and email-provider administrator accounts with phishing-resistant MFA and separated recovery; approve least-privilege roles and break-glass access. Record DNSSEC/CAA/certificate-transparency decisions, domain-renewal safeguards, secret/key inventories, owner succession, and periodic access review.
- [ ] **OWEB-15 — Independent assurance:** commission an independent application/API penetration test and focused browser-crypto review after the production-shaped environment is stable; remediate findings and retest. Review the zero-knowledge wording against the real browser threat model, including malicious same-origin script and compromised dependency scenarios.

### Required closure evidence

- Each item must record an owner, exact configuration or commit, test or drill evidence, decision, exceptions/residual risk, approver, and review/expiry date.
- Evidence must be value-free and must not contain live tokens, secrets, owner identifiers, vault ciphertext, or plaintext.
- All P0 items require security approval before external owner-web access. P1 items require an approved owner/security exception if incomplete before broader availability.
- These controls do not authorize public legal publication, claimant authentication/data/runtime, production claimant integration, or any weakening of the client-side vault boundary.

## Open Security Gates

### Mobile release

- Complete Build 7 Apple processing and export-compliance confirmation, then assign it only to the intended internal TestFlight group/testers.
- On Build 7, physically verify Face ID enablement, `Lock` -> `Unlock`, background lock, cancel/error handling, expired-session fallback, and returning-user recovery.
- Reverify corrected divorce-certificate encrypted persistence and cleanup.
- Resolve the workflow warning that `ios.infoPlist.ITSAppUsesNonExemptEncryption` is absent by recording the owner-confirmed App Store Connect answer; do not infer the legal classification.

### Protected web

- Upgrade Supabase to Pro; approve backup retention and complete restore testing.
- Enable and test managed single-session behavior, JWT lifetime, displacement, and decrypted-state cleanup.
- Approve the owner/claimant origin architecture, hosted configuration, CSP/CORS/cookies, monitoring, rollback, and synthetic authenticated smoke.

### Claimant Slice 3

Current result: `NO-GO`.

Product-owner direction is approved: registered recipient first; death-only invitation pilot; verified notice with provisional 30-day cooldown; no automatic release for non-response; two independent reviewers; at least two device-bound claimant keys with no server recovery; provisional 72-hour package availability and 15-minute retrieval sessions; safe journey dashboard; append-only audit ledger; native local decrypt/export; and signed/versioned jurisdiction policy packs.

Still required:

- Legal confirmation of the provisional Shahbaz Malik operator/data controller designation, contracting-entity/controller details, and processor map.
- Legal/privacy authority, jurisdiction, evidence, retention, rights, dispute, and cross-border policies.
- Physical iOS custody proof and independent native/cryptographic review.
- Security/operations approval of authentication, origin, notifications, storage, audit integrity, backup/restore, kill switches, and incident response.
- Named, trained, separated reviewers and operational evidence.
- Android remains fail-closed until transaction-bound key agreement and the required device/attestation baseline are independently approved. Owner approval permits iOS-only preparation; it does not authorize runtime implementation.
- Offline-code V2 remains disabled pending protocol review and representative KDF benchmarks.

`CLAIM_HANDOFF.md` now records the full pending production integration-code backlog. PR #54 supplies synthetic contracts, projections, fixtures, previews, and tests only; it supplies no production claimant authentication, persistence, RLS/Storage policy, evidence pipeline, case processor, reviewer operations, notification delivery, native custody, or release runtime.

## Verification

### Owner-vault candidate on 2026-08-03

- Exact-main Security CI run `30828358898` passed the application security, CodeQL, ZAP, Android native compile, live Supabase/RLS, Android emulator, hosted Supabase integration, and iOS simulator jobs.
- Protected TestFlight workflow run `30830865138` passed release SBOM generation, EAS production build, App Store Connect upload, and transient credential cleanup.
- Candidate: Sanduqkin `1.0.0` Build 7; source `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- Apple processing/export compliance and physical-device verification remain open; claimant runtime remains `NO-GO`.

### Claimant prototype acceptance on 2026-08-02

- Full web suite: 141 passed; shared claimant: 110 passed; shared validation: 42 passed.
- Formal-review remediation now rejects partial-match replays, cross-case audit appends, altered snapshot projections, evidence-preparation metadata mismatches, and event/transition mismatches while keeping synthetic review routes out of public discovery surfaces.
- All workspace typechecks, root lint, production web build, Phase 1, GitHub Actions security, static security/migration, mobile secret, and claimant isolation guards passed.
- Claimant capabilities remain hard-disabled, the custody probe remains hard-disabled, and no runtime, database, native custody, TestFlight, or deployment action was added or performed.
- Live Supabase attack/restore and physical-device gates remain required at their production release gates; passing synthetic acceptance is not specialist approval.

### Focused baseline on 2026-08-01

- Mobile biometric/settings/certificate/custody tests: 27 passed.
- Shared validation: 42 passed.
- Inactive claimant web: 6 passed.
- Claim-vector reproducibility, vector isolation, and custody isolation guards passed.
- Code inspection confirmed the Build 6 biometric interaction defect and the merged PR #53 repair; claimant portal capabilities are all `false`, and `CLAIMANT_CUSTODY_PROBE_ENABLED` is `false`.

Before any release candidate, run the full application, security, database/RLS, native, dependency, SBOM, and protected TestFlight gates defined in `HANDOFF.md` and the repository scripts.
