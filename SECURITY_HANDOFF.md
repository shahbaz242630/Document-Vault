# Sanduqkin Security Handoff

Last updated: 2026-07-31 (Asia/Dubai)

## Security Status

The mobile vault is in controlled TestFlight testing. PR #51 and the runtime-disconnected claimant protocol/custody work are merged on `main`. Build 5 remains installed; build 6 was submitted successfully and is processing at Apple before internal assignment and physical QA. The hosted web preview remains protected. Public legal publication and all claimant runtime functionality remain disabled.

Claimant security, protocol, evidence, review, and encrypted-release slices are governed by `CLAIM_HANDOFF.md`; its stop gates apply before any claimant implementation.

Current security reference points:

- Current installed TestFlight build: app `1.0.0`, build `5`, EAS build `4a39030c-6345-440a-9aca-780fe9cdabd1`, submission `ffc74175-ea27-4201-b273-8486df020fc9`.
- Processing TestFlight candidate: app `1.0.0` (6), EAS build `905cf43a-369e-42fa-a9ba-1bc8d6bf787a`, submission `16464bb5-6ef9-4b24-b891-a664255c963f`.
- Protected release run: `30647817586`.
- Current session-close branch: `main`; current `origin/main` is `9a903f2` from PR #51.
- Supabase: existing Free project in `eu-central-1`; local stack is used for migrations and attack tests.
- Web preview: `sanduqkin-web`, SSO protected, no custom domain, no hosted environment variables, and still serving the earlier static Phase 3 preview.

## Non-Negotiable Security Boundaries

### Zero knowledge

- Encrypt vault payloads before persistence and decrypt only in the active client.
- Never send or store plaintext vault details, passwords, recovery phrases, raw MEKs, claimant private keys, full emergency secrets, seed phrases, or private credentials in Sanduqkin servers, Supabase, Vercel, GitHub, analytics, logs, support tools, or email.
- Normalize only approved metadata. New asset details belong inside authenticated ciphertext.
- Keep KEK derivation, MEK unwrap, record encryption/decryption, recipient key generation, and owner-side grant finalization on the client.
- Preserve versioned envelopes and domain-separated associated data. Cryptographic format changes require compatibility vectors and focused review.
- Readable PDF export remains a user-directed local device action.

### Authentication and authorization

- Authentication, MFA, code possession, identity proofing, relationship/evidence review, and release authorization are distinct controls.
- Re-verify the authenticated user server-side for sensitive API operations and enforce authorization independently of the UI.
- Claim-sensitive operations must require `aal2` once designed; never trust client-supplied owner IDs, claim IDs, roles, states, or assurance levels.
- Managed single-session-per-user is a production gate, not an active Free-tier control. Old access JWTs can remain usable until expiry; do not claim instantaneous displacement.
- Clear decrypted state and browser-worker key material on lock, sign-out, timeout, displacement, lifecycle boundaries where practical, and fatal errors.

### Browser and origin isolation

- Protected responses must remain dynamic, private, `no-store`, and `noindex`.
- Keep authentication cookies host-only with `Secure` and appropriate `SameSite`; never set `Domain=.sanduqkin.com`.
- Do not persist passwords, KEKs, MEKs, claimant secrets, or decrypted vault state in `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, or service-worker storage.
- Retain nonce-based CSP, restrictive `connect-src`, worker restrictions, anti-framing, `nosniff`, restrictive referrer/permissions policies, and HTTPS HSTS.
- Public content must not request account credentials or vault data. Advertising and unnecessary third-party analytics are prohibited on protected origins.
- The owner vault and future claimant intake require an explicit reviewed hostname/origin boundary before production deployment. Path-only separation is not sufficient evidence of origin isolation.

### Logging and privacy

- Logs, audit events, CI artifacts, screenshots, and failure evidence must be value-free: safe identifiers, states, timestamps, reason codes, and correlation IDs only.
- Never log claim/release request bodies or sensitive command arguments.
- Define retention, deletion, access, incident response, and data-controller responsibilities before collecting claimant PII or evidence.
- Do not collect real claimant data during development or preview testing.

## Current Implemented Controls

- XChaCha20-Poly1305 client encryption, Argon2id KEK derivation, wrapped-MEK unlock, recovery re-wrapping, and shared compatibility vectors.
- Browser Web Worker retains the active MEK in worker memory, refuses operations while locked, replaces and zeroes byte arrays on re-unlock, and zeroes them on lock.
- Owner-only Supabase RLS for `vault_assets` and `vault_key_material`, with local/hosted security coverage.
- Shared exhaustive registry for all 17 asset types; schemas, field mappings, safe summaries, and encrypted-payload-only classification are enforced across mobile and web.
- Unknown future encrypted fields survive edits from either client.
- Mobile mutation failures reconcile from Supabase or roll back locally, preventing ghost records and local/remote deletion-state divergence.
- Protected `/login` and `/vault` routes use server-side claim validation, private/no-store responses, nonce CSP, and security headers.
- Static public and inactive `/claim` pages contain no forms, trackers, browser persistence, or claimant data path.
- `main` contains runtime-disconnected claimant contracts, five reproducible synthetic vector suites, cross-consumer tests, and a hard-disabled native custody probe. The offline-code V2 Argon2id fixture profile is explicitly synthetic-only and not production-approved.
- GitHub branch protection, CODEOWNERS coverage, immutable action pins, CodeQL, OWASP ZAP, dependency audit, secret scans, native build/smoke jobs, Supabase tests, release checklist, SBOM generation, and approval-gated environments.
- Release signing and submission credentials are materialized only in the protected runner and removed in unconditional cleanup.
- Account-deletion and audit-retention processors have value-free secretless failure monitoring.
- A local authenticated browser/mobile-repository smoke now covers representative encrypted shapes, bidirectional edits, forward-field preservation, ciphertext-only persistence, delete/restore/permanent-delete, offline failure without a ghost record, protected headers, empty local/session storage, worker relock, and tagged identity/row cleanup.

## Development And Release Boundaries

### Allowed protected development

- Use the existing Free Frankfurt Supabase project only with dedicated identities and synthetic or uniquely tagged encrypted rows.
- Use the local Supabase stack for migrations, destructive cases, RLS attacks, and repeatable database tests.
- Keep hosted changes backward compatible with installed TestFlight builds.
- Keep Vercel previews protected and claimant intake/release disabled.
- Take and verify a manual off-site logical backup before material hosted schema work while the project remains Free.

### Required before external authenticated users or production readiness

- Upgrade the existing Supabase project to Pro and confirm managed backup retention.
- Enable managed single-session-per-user, choose a supportable JWT lifetime, and pass cross-client displacement tests including the bounded old-JWT window.
- Prove decrypted-state and key cleanup after refresh failure, displacement, sign-out, timeout, and fatal errors.
- Decide and enforce owner-vault versus claimant hostname/origin isolation.
- Review hosted environment variables, Supabase redirect origins, CORS/origin checks, cookies, CSP, caching, monitoring, rollback, and incident response.
- Run a restore drill before live claims and select an acceptable recovery-point strategy, including PITR if required.

## Claimant And Emergency-Release Boundary

- Current V1 emergency codes wrap the MEK safely but have no public locator and cannot support safe grant lookup.
- Do not scan grants or submit a full secret to locate one. V2 must split a public locator from a high-entropy client-only secret and define legacy compatibility.
- Registered-recipient and V2 releases use distinct, version-bound release-material profiles. A registered-recipient sealed grant cannot substitute for a V2 secret-wrapped MEK or vice versa.
- Registered-recipient setup remains blocked until an approved claimant-key custody client exists. The current browser policy forbids persisting the claimant private key in browser storage, and Sanduqkin must not provide server-recoverable private-key custody.
- Possessing a code never authorizes release.
- No claimant schema or RLS path may be added before the protocol, threat model, release authority, roles, state machine, retention, privacy model, and abuse controls are approved.
- Claimant evidence, if later approved, must use a private isolated quarantine boundary with randomized names, allowlisted types, strict limits, malware scanning, short-lived capabilities, retention/deletion controls, and claimant/claim-bound Storage RLS.
- Evidence is intentionally server-visible PII unless a later design says otherwise; it is outside the normal vault zero-knowledge claim.
- Released data must remain ciphertext plus claimant-specific sealed key material and decrypt locally into a read-only client.

## Open Security And Operations Debt

### Immediate

- After protected CI passes, create the next controlled internal TestFlight candidate and run the repaired biometric path on a physical iPhone: enablement, lifecycle lock, explicit prompt invocation, success/cancel/error mapping, expired-session password fallback, secure-state restoration, and returning-user recovery. Android emulator evidence is complete; do not promote the candidate until physical QA passes.
- Verify the owner-side trusted-person information route on physical iOS without weakening claimant isolation. It must remain free of invitations, recipient persistence, key registration, grants, network integration, evidence, review, and release.
- Preserve and rerun the passing checks: fixed footer, Emergency Readiness heading, friendly invalid-data handling, valid encrypted save, certificate-location CRUD, sealed-code status, and synthetic cleanup.
- The TestFlight build 3 native-UI leg of the protected browser/native synthetic smoke is complete on an iPhone 12 running iOS 26.5.2: the native app displayed and edited a web-created encrypted record, the web read the native edit, and the tagged record was permanently removed.
- Complete TestFlight metadata and initial GCC territory configuration; keep France disabled until French ANSSI approval.
- Finalize the U.S. export-classification rationale before setting persistent iOS compliance metadata.

### Operational

- Rotate four legacy processor secrets into the protected `Production` environment, verify the processors, then remove repository-level copies.
- Add a second qualified security reviewer before enforcing required code-owner approval.
- Define durable SBOM and dependency-license review ownership before 90-day artifacts expire.
- Review log/artifact retention and periodically inspect audit metadata for sensitive values.
- Select the production transactional-email provider and verify value-free failure handling.

### Dependencies and tooling

- The four 2026-07-27 high-severity production findings are resolved. Scoped root overrides now keep `glob@13.0.6` on `brace-expansion` `5.0.8` and Next.js `16.2.12` on PostCSS `8.5.23` and Sharp `0.35.3`; the production audit reports zero vulnerabilities.
- `scripts/security-check.cjs` now rejects production lockfile resolutions below `brace-expansion` `5.0.8`, PostCSS `8.5.18`, or Sharp `0.35.0`. The resolved paths passed the web production build and Expo Doctor 21/21. `npm ls` identifies the PostCSS and Sharp resolutions as intentional out-of-range Next.js overrides; preserve the scoped overrides and compatibility checks until upstream ranges make them unnecessary.
- Update pinned GitHub actions when compatible immutable revisions remove the Node 20 runtime deprecation annotation.
- Six deterministic synthetic crypto-fixture findings were individually classified as false positives in GitGuardian. No repository-wide exclusion or weakened secret-detection rule was added.

## Next Security Gate

The four original deterministic synthetic protocol vector suites and the later registered-recipient V2 custody suite specified in `CLAIM_HANDOFF.md` are implemented and owner-approved. Reproducibility, primitive and binding checks, state invariants, cross-consumer verification, unknown-version rejection, synthetic markers, and runtime isolation passed. The slice contains no runtime authentication, storage, API, evidence, notification, processor, or release path.

The claimant-key custody and client-boundary direction in `docs/superpowers/specs/2026-07-28-claimant-key-custody-client-boundary.md` is owner-approved. Its hard-disabled feasibility probe and findings are recorded in `docs/superpowers/specs/2026-07-28-claimant-custody-probe-evidence.md`.

Android Kotlin compilation confirms hardware-backed P-256 ECDH support, but the current Android 36 platform cannot bind `KeyAgreement` to `BiometricPrompt.CryptoObject` under the approved transaction-bound guarantee. Android remains ineligible; no timed authentication or software fallback is accepted implicitly. The merged iOS module passed simulator compilation; physical iOS and representative Android custody evidence remain outstanding.

Before any registered-recipient runtime work, approve a revised Android transaction-binding design or minimum platform baseline and obtain independent review. Before pilot, product must also accept the single-device loss risk or require multi-device enrollment or a claimant-held recovery protocol. Offline-code V2 production KDF parameters remain unapproved until representative iOS, Android, desktop, and low-memory worker benchmarks pass security review.

The owner approved resolving loss risk through at least two independently enrolled device-bound claimant keys before pilot, with no server recovery, plus registered-recipient first, a death-only invitation pilot, verified notice with a provisional 30-day cooldown, no automatic release for non-response, and two independent reviewers. The owner also required a safe claimant journey dashboard, comprehensive append-only internal audit/journey ledger, and a nationality-neutral global architecture with signed/versioned document-specific jurisdiction policy packs. No operating company exists yet. Legal/privacy, security, operations and independent approvals remain outstanding; current status is `NO-GO` for Slice 3.

The owner-described manual retrieval journey is recorded in `docs/superpowers/specs/2026-07-31-claimant-mvp-manual-review-retrieval-flow.md`. Ordinary shared-drive evidence, emailed retrieval secrets and backend/browser-readable PDFs would expand plaintext trust and are not approved. The current boundary is private evidence quarantine, two-reviewer authorization, value-free notification, ciphertext-only package delivery, native local decryption/export and precise receipt events.

The owner explicitly approved this native local decryption/PDF-export boundary; browser-readable PDF delivery and system-known PDF passwords are out of scope.

The Docker-backed Supabase database catalog check and hostile RLS attack suite passed after the checked-in local stack was started. No migration, schema, RLS, Storage, or runtime API code changed in this slice.

### Release status at session close

- PR #48 merged the lockfile-based CycloneDX SBOM repair after its full matrix passed. Protected run `30520301290` then produced and submitted build 4.
- Build-4 controlled QA exposed footer, validation/save, Emergency Readiness hierarchy, and biometric defects. PR #49 repaired them, added the Expo local-authentication/Face ID native configuration, aligned Expo SDK 56 patch versions, and kept claimant-vector checks deterministic across checkout line endings.
- PR #49 merged as `306c18f` after the full Android, iOS, security, Supabase, CodeQL, ZAP, GitGuardian, and preview matrix passed. Post-merge Security CI run `30566745549`, CodeQL run `30566745741`, and OWASP ZAP run `30566745473` all passed.
- Protected release run `30570280096` passed SBOM generation, protected credential materialization/cleanup, EAS build, and automatic submission for app `1.0.0` (5).
- App Store compliance and `GCC Internal Testers` assignment completed, and build 5 was installed. Physical QA passed the footer, Emergency Readiness heading, invalid/valid save, and sealed-code creation. Biometric unlock and the owner-side `Pre-authorize Kin` card are inert and require focused repair before the next release.
- TestFlight build 6 physical-iPhone feedback identified a Settings affordance defect: the `Biometric unlock` row/card has no press handler, so tapping it silently does nothing. This blocks discoverable setup but does not yet prove failure of the lock-screen protected-key path. The iOS release gate remains failed until the interaction is repaired and physical Face ID setup plus `Lock` -> `Unlock` are verified.
- The 2026-07-31 repair securely sequences MEK storage before biometric enablement, defers authenticated key access until explicit Unlock, maps native outcomes, rejects remote restoration without a live Supabase session, and exposes password fallback. The assembled APK passed a Pixel-emulator system-prompt/fingerprint smoke with no app crash or React Native error.
- The trusted-person control now opens a static owner-side requirements page only. Claimant vector, runtime-isolation, and custody-isolation guards pass; no claimant persistence or capability was enabled.
- Sealed-code regeneration persisted one active encrypted grant with previous versions revoked. Marriage/divorce certificate locations reuse the existing encrypted owner-vault envelope and CRUD path. The earlier synthetic rows were permanently removed after hosted persistence verification; the corrected divorce-certificate value still needs fresh focused verification.
- The release SBOM contains 662 production components, the production dependency audit reports zero vulnerabilities, and the local database catalog and hostile RLS suites pass. This slice contains no database, migration, RLS, Storage, or API change; protected CI must repeat the release matrix.
- PR #51 merged as `9a903f2` after the full protected matrix passed. Release run `30647817586` built and submitted app `1.0.0` (6), removed transient credentials, and is waiting on Apple processing/compliance/internal assignment before physical security QA.
- The Slice 2 decision register, threat/control matrix and approval checklist are documentation-only. No claimant authentication, persistence, migration, API, evidence, notification, processor, release or decryption capability was enabled.

## Standard Security Verification

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
node --test scripts/generate-release-sbom.test.cjs
npm run sbom:release
node --test scripts/security-check.test.cjs scripts/mobile-secret-scan.test.cjs scripts/supabase-db-security-check.test.cjs scripts/github-actions-security-check.test.cjs scripts/phase1-dod-check.test.cjs
npm audit --omit=dev --workspaces --audit-level=high
```

Run the catalog and RLS attack suites for every database or policy change. Release candidates additionally require the protected TestFlight workflow from `main`, explicit `Release` approval, App Store processing, export/distribution review, and recorded physical-device QA.
