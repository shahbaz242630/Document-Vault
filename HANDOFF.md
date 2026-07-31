# Sanduqkin Project Handoff

Last updated: 2026-07-31 (Asia/Dubai)

## Start Here

Sanduqkin is a zero-knowledge personal-information vault. The mobile Phase 1 vault is in controlled TestFlight testing. The protected owner web vault, mobile MVP redesign, build-4 QA repairs, and runtime-disconnected claimant protocol/custody feasibility work are merged on `main`. TestFlight build 5 is installed for controlled physical QA. The public website remains a protected draft, and all claimant submission and release functionality is disabled.

Read these active documents before changing the project:

1. `HANDOFF.md` — product state, repository structure, completed work, and cross-project priorities.
2. `SECURITY_HANDOFF.md` — mandatory security boundaries, release gates, and security debt.
3. `MVP_HANDOFF.md` — website, owner web vault, and future claimant execution plan.
4. `apps/web/LEGAL_CONTENT_REVIEW.md` — publication blockers for the public/legal website.

Detailed history removed during the 2026-07-20 consolidation remains available in Git at commit `96e89c1` and is indexed in `docs/handoff/archive/CONSOLIDATION-2026-07-20.md`.

Claimant and encrypted-release work is governed by `CLAIM_HANDOFF.md`; read its slice gates before changing any claimant surface, protocol, schema, API, evidence path, or release control.

## Source Of Truth

- Repository: `C:\Projects\GitHub\Sandoq Kin`
- GitHub: `shahbaz242630/Document-Vault`
- Default/release branch: `main`
- Current session-close branch: `main`.
- Current `origin/main`: `306c18f` (`Fix mobile QA regressions and claimant vector checks (#49)`).
- PR #48 merged the lockfile-based release SBOM repair and enabled the successful protected build-4 release.
- PR #49 merged the build-4 mobile QA repairs, Expo SDK 56 alignment, biometric/native Face ID configuration, deterministic claimant-vector line-ending repair, and focused coverage repair.
- Product requirements: `Vault_BRD_v1.0.md` (document version 1.1)
- Expected unrelated local-only items include `.playwright-mcp/`, `.codex-runtime/`, and `welcome.png`; do not commit or delete them unless explicitly requested.

## Current Product State

### Mobile owner vault

- App version `1.0.0`, TestFlight build `5`, is the current installed Supabase-enabled internal-test build.
- Build 4 was produced by protected GitHub run `30520301290` from commit `7dab9b7`, processed by App Store Connect, cleared through the manual encryption questionnaire, assigned to `GCC Internal Testers`, and installed on the controlled iPhone.
- Build 5 was produced and automatically submitted by protected GitHub run `30570280096` from `main` commit `306c18f`. EAS build `4a39030c-6345-440a-9aca-780fe9cdabd1` and submission `ffc74175-ea27-4201-b273-8486df020fc9` completed successfully. App Store compliance and `GCC Internal Testers` assignment were completed, and the controlled tester installed the build.
- Phase 1 remains a controlled internal test, not a production-readiness declaration. Multi-day physical-device functional and security QA is still open.
- `main` has a dedicated Dashboard, separate Add and Saved Records pages, explicit Dashboard returns, and an icon-based Home/Add/Records/Settings/Lock footer.
- Dashboard content now includes live encrypted-record coverage, a safe data-derived next-reference suggestion, and live emergency-readiness status from the existing sealed emergency grant. All cards use one consistent surface treatment.

### Owner web vault

- `main` implements Supabase authentication, local browser-worker cryptography, and encrypted owner-vault CRUD for all 17 current asset types.
- Mobile and web share the same Supabase identity, `vault_key_material`, `vault_assets`, envelope format, and schema-driven category registry. There is no parallel web vault.
- `main` includes mobile forward-field preservation, failed-persistence reconciliation, and nonce-based protected-route security headers.
- The owner web vault is committed but not deployed. The hosted web preview is still the earlier static protected build and has no Supabase environment variables.

### Public website and claimant flow

- Static landing, product, support, accessibility, security, privacy, terms, deletion, and inactive claim-information routes are implemented and protected-preview-verified.
- Legal content remains `Preview draft 0.1` and is not approved for publication. `apps/web/LEGAL_CONTENT_REVIEW.md` remains blocking.
- `/claim` is informational only. There is no claimant intake, evidence upload, claimant schema, release state machine, or claimant data release.

## Product Guardrails

- Sanduqkin is a secure information organizer, not a bank, financial adviser, investment product, legal service, estate planner, executor, or legal entitlement authority.
- Normal vault operation must remain zero knowledge: Sanduqkin infrastructure receives ciphertext and approved metadata, never plaintext vault fields, passwords, recovery phrases, raw MEKs, private keys, or raw emergency secrets.
- Encryption and decryption occur only in the active client. Readable PDF export remains local to the user's device.
- Permanent deletion is irreversible and must be described accurately.
- A claimant account, MFA, evidence, relationship, or emergency code does not by itself authorize release.
- Do not begin live claimant work until release authority, protocol, threat model, privacy/legal responsibilities, schema, RLS, and operating procedures are approved.
- Payments remain out of the active workstream.

## Repository Structure

- `apps/mobile` — Expo/React Native owner application.
- `apps/web` — Next.js public site and protected web proof-of-concept.
- `services/api` — canonical Hono API deployed separately on Vercel.
- `packages/shared-types` — cross-client asset and cryptographic-envelope types.
- `packages/shared-validation` — exhaustive 17-category schemas, field definitions, normalization, summaries, and registry invariants.
- `supabase/migrations` — append-only database changes and RLS foundations.
- `docs` — release, security-test, deletion, secret-lifecycle, RevenueCat, and design/implementation records.

Dynamic API compute is pinned to Vercel `fra1` near the Supabase `eu-central-1` primary. Public static pages are intended to remain independent of API or Supabase availability.

## Verified Delivered Work

- Mobile email/password authentication, wrapped-MEK returning-user unlock, recovery continuity, encrypted Supabase-backed CRUD, soft delete/restore/permanent delete, local PDF export, and sealed emergency-code foundation.
- Client-side XChaCha20-Poly1305 encryption and Argon2id KEK derivation with versioned envelopes and associated data.
- Account-deletion and audit-retention processors, protected workflows, value-free monitoring, release checklist, SBOM generation, secret guards, CodeQL, ZAP, native CI, and Supabase security tests.
- Signed TestFlight builds and controlled GCC-only internal distribution with France excluded.
- API Frankfurt placement, separate protected Vercel web project, and static public/legal preview.
- Cross-client crypto vector, browser Web Worker key boundary, live mobile-to-web and web-to-mobile encrypted bank-account proof, and shared 17-category owner-vault parity.
- Forward-compatible encrypted-field preservation and failure reconciliation across mobile persistence operations.
- Local authenticated browser/mobile-repository smoke across card, contact, medical-care, and business-interest records: bidirectional decrypt/edit, unknown-field preservation, ciphertext-only rows, deletion lifecycle, offline-save reconciliation, empty browser storage, worker relock, protected headers, and complete tagged-row/account cleanup.
- Refined public landing-to-sign-in navigation and aligned the protected web login form.
- Completed the 2026-07-26 Android-emulator owner-flow redesign: Dashboard separation, Add and Saved Records destinations, explicit back routes, correctly wired icon footer, footer Lock action, removal of duplicate header controls, live coverage, and consistent card styling.
- Added a live emergency-readiness Dashboard card using the existing Supabase sealed grant and secure interruption marker, including seven-day on-device reminder deferral for missing or interrupted setup. The controlled test account reported `Ready` without changing its grant.
- Verified controlled TestFlight-created test entries reached encrypted Supabase storage and the selected deleted test item was fully removed.
- The 2026-07-27 consolidation passed repository typecheck and lint, mobile 377 tests with 3 protected skips, web 81 tests, the Next.js `16.2.12` production build, Expo Doctor 21/21, Phase 1/security/mobile-secret guards, and a production dependency audit reporting zero vulnerabilities.
- PR #38 merged the owner-approved, runtime-disconnected claimant protocol/vector and custody feasibility work: closed shared contracts and validators, five reproducible synthetic suites, state invariants, cross-consumer tests, a hard-disabled native custody module, and runtime-isolation guards. It remains runtime-disabled and is not present in TestFlight build 3.
- The final PR #38 matrix passed Android native compile, Android emulator smoke, iOS simulator smoke, application/security gates, live and hosted Supabase gates, CodeQL, OWASP ZAP, GitGuardian, and Vercel preview checks.
- Protected TestFlight run `30362667662` stopped at the release SBOM job before credentials or EAS were accessed. npm rejected the intentional dependency overrides as an invalid tree; the build-and-submit job was skipped.
- PR #48 replaces npm dependency re-resolution with a tested CycloneDX production inventory generated directly from the committed npm v3 lockfile. Local generation produced 662 components, the production audit remained at zero vulnerabilities, and the full PR check matrix passed.
- Protected TestFlight run `30520301290` produced and submitted build 4. Physical QA confirmed the main navigation and early owner-vault checks, then exposed four reproducible issues: the footer scrolled away, Emergency Readiness hierarchy was awkward, required-field failures exposed raw Zod structures and blocked valid save recovery, and biometric lock/unlock became unavailable.
- PR #49 fixed those build-4 findings: the vault footer is fixed while content scrolls, `Needs Attention` is a proper Emergency Readiness heading, asset validation emits friendly field messages and permits valid saves, biometric availability refreshes on Settings focus with actionable native errors, and Expo now includes the local-authentication plugin and Face ID usage description.
- Authenticated Pixel-emulator regression passed footer behavior, emergency-card presentation, invalid and valid contact save, permanent synthetic cleanup, biometric enable, lock, fingerprint unlock, and vault restoration. Final local mobile verification passed 391 tests with 3 protected skips, coverage thresholds, typecheck, targeted lint, and Expo Doctor 21/21.
- PR #49 and post-merge `main` passed application/coverage/security gates, live and hosted Supabase checks, Android native and emulator smoke, iOS simulator smoke, CodeQL, OWASP ZAP, GitGuardian, and protected Vercel previews. Post-merge Security CI run: `30566745549`.
- Protected TestFlight run `30570280096` generated the release SBOM, built app `1.0.0` (5), and completed the EAS submission. App Store processing, compliance, internal assignment, and installation completed.
- Build-5 physical QA passed the fixed footer, Emergency Readiness heading, friendly invalid-data handling, and valid encrypted record save. Sealed emergency-code creation also passed.
- The two build-5 interaction regressions are repaired locally. Android now shows one native biometric prompt after explicit Unlock, restores only with a live Supabase session, and offers password fallback; the owner Emergency card opens a tested information-only trusted-person requirements page with no claimant runtime. Physical iOS regression is still required before release.
- Marriage and death certificates are available through the existing encrypted Document Locations CRUD path. Hosted create/edit/persistence and permanent synthetic cleanup passed without a database schema change.
- Sealed emergency-code regeneration persisted one active complete encrypted grant with prior grants revoked. No raw code was included in logs or evidence.
- The 2026-07-31 pre-build gate passed 574 workspace tests with 3 protected skips, mobile coverage, typecheck, zero-warning lint, the web production build, Expo Doctor 21/21, Phase 1/security/GitHub Actions/mobile-secret and claimant isolation guards, local database catalog/hostile RLS suites, Android native assembly/install/biometric smoke, a zero-vulnerability production audit, and the 662-component release SBOM.

## Current Blockers And Technical Debt

### Before completing mobile Phase 1 readiness

- Complete TestFlight contact/test information and intended initial GCC territory configuration.
- After protected CI passes, create the next controlled internal TestFlight candidate and rerun the repaired biometric path and trusted-person information route on a physical iPhone. Cover cold start, authentication/unlock, encrypted CRUD including certificate locations, fixed footer, friendly validation, emergency-readiness hierarchy, background/foreground locking, biometric success/cancel/error, screenshot/sensitive-screen behavior, recovery, emergency access, sealed-code status, sign-out, and returning-user flow. Do not promote the candidate until it passes.
- Record only device model, iOS version, build number, and value-free pass/fail evidence.
- Finalize the supportable U.S. export-classification rationale before setting persistent iOS compliance metadata.
- Complete the French ANSSI declaration before enabling France.
- Select and integrate a production transactional-email provider; Resend is only a candidate.

### Before any external protected web user or production-readiness claim

- Upgrade the existing Supabase project from Free to Pro.
- Confirm managed backup retention and perform the required recovery review/drill.
- Enable managed single-session-per-user behavior, select a supportable JWT lifetime, and verify mobile-to-web and web-to-mobile displacement including the bounded old-JWT window and decrypted-state cleanup.
- Decide and enforce the production hostname/origin boundary for the owner vault versus claimant portal; see `MVP_HANDOFF.md`.
- Deploy and review the protected web configuration only after the synthetic authenticated smoke matrix passes.

### Repository and operations debt

- Rotate four legacy scheduled-processor values into the protected `Production` environment, verify both processors, and remove the repository-level copies.
- Add a second qualified security reviewer before requiring code-owner approval; the sole owner cannot approve their own PR.
- Define durable SBOM/dependency-license ownership before 90-day GitHub artifacts expire.
- Review artifact and log retention and periodically audit that audit metadata remains value-free.
- Replace immutable action pins that still trigger GitHub's deprecated Node 20 action-runtime annotation when compatible upstream revisions are available.
- The four 2026-07-27 production dependency findings are resolved: the production `glob@13.0.6` path uses `brace-expansion` `5.0.8`, Next.js uses PostCSS `8.5.23` and Sharp `0.35.3`, and the production audit reports zero vulnerabilities. Preserve the scoped overrides and the lockfile minimum-version checks until compatible upstream dependency ranges make them unnecessary.
- Update the local Node runtime: this machine reports `24.2.0`, below the repository's deliberate `>=24.3.0` Node 24 range. Do not weaken the engine requirement.

### Public and claimant blockers

- Resolve `apps/web/LEGAL_CONTENT_REVIEW.md` and obtain owner/counsel approval before public legal publication.
- Decide who can authorize release when the owner cannot respond, what evidence is accepted, applicable jurisdictions, challenge/cooldown rules, operator responsibilities, retention, disputes, and governing law.
- Design and review the V2 split emergency-code protocol before any code-based claim lookup. Existing V1 codes have no safe public locator.

## Next Session Opener

1. Commit the bounded repair set, open its PR, and pass the protected CI matrix, including database catalog, hostile RLS, native Android, and iOS simulator checks.
2. After merge and explicit `Release` approval, create the next controlled internal TestFlight candidate. Run biometric, password fallback/recovery, trusted-person information navigation, certificate CRUD, emergency status, and returning-user checks on the physical iPhone; record value-free evidence and do not promote the candidate until it passes.
3. Open the claimant workstream using `CLAIM_HANDOFF.md` and `docs/superpowers/plans/2026-07-28-claimant-integration-delivery-map.md`; do not repeat the delivery-map exercise.
4. Begin bounded Slice 2 decision closure: release authority, supported jurisdictions, evidence/retention policy, owner challenge/cooldown, reviewer separation, claimant-key custody/recovery, Android transaction binding/minimum platform, and owner/claimant origin isolation.
5. Produce a decision register, revised threat/control matrix, and explicit owner/security/legal approval checklist. Stop before migrations, authentication, invitations, evidence upload, notifications, processors, claim submission, or release.

Repository, CI, submission, and App Store distribution snags are resolved. The interaction repairs and local database/RLS gates pass, but physical iOS and the protected release matrix remain required before release; they do not block the authorized claimant documentation, threat-model, benchmark, and decision work above.

Authority, legal/privacy, jurisdiction, retention, origin, backup/restore, independent-assurance, and reviewer-separation gates remain unresolved. Discussion, documentation, physical testing, benchmarks, and independent-review preparation are authorized; runtime integration remains blocked.

Do not deploy the protected vault, attach production domains, publish draft legal content, change Supabase Auth globally, collect real claimant data, or enable claimant runtime or release behavior without the approvals in `CLAIM_HANDOFF.md` and `SECURITY_HANDOFF.md`.

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

Run database security checks before and after any migration or RLS change. Release candidates also require the protected `iOS TestFlight release` workflow from `main`, explicit `Release` approval, App Store processing confirmation, and recorded physical-device QA.

## Session Startup Checklist

1. Read the four documents listed under `Start Here`.
2. Run `git status --short --branch` and `git log --oneline --decorate -5`.
3. Preserve unrelated user changes and expected local-only files.
4. Start with physical iOS verification and the protected release matrix, then use the claimant opener above; no claimant runtime work is implied.
5. Recheck time-sensitive provider or security guidance only when the slice depends on it.
6. State the slice scope and non-goals, implement or verify only that slice, record evidence, update the handoffs, and stop for owner review.
