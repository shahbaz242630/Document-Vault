# Sanduqkin Project Handoff

Last updated: 2026-07-21 (Asia/Dubai)

## Start Here

Sanduqkin is a zero-knowledge personal-information vault. The mobile Phase 1 vault is in controlled TestFlight testing. A protected owner web vault is implemented on the current feature branch but is not deployed. The public website is still a protected draft, and all claimant submission and release functionality is disabled.

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
- Current feature branch: `codex/mvp-landing-legal`
- Latest pushed feature-branch commit: `ff0187d` (`Add inactive claimant portal foundation`); the Slice 2 claimant approval package is the current local documentation slice.
- `main` at consolidation: `c4f1f91` (MVP web scaffold merged through PR #33)
- Product requirements: `Vault_BRD_v1.0.md` (document version 1.1)
- Expected unrelated local-only items: `.playwright-mcp/` and `welcome.png`; do not commit or delete them unless explicitly requested.

## Current Product State

### Mobile owner vault

- App version `1.0.0`, TestFlight build `3`, is the current Supabase-enabled test build.
- Build 3 was produced by protected GitHub run `29695865266`, processed by App Store Connect, cleared for the current encryption/distribution scope, assigned manually to `GCC Internal Testers`, installed on the owner's iPhone, and verified for password sign-in, local vault unlock, and web-to-mobile encrypted-record visibility.
- Phase 1 remains a controlled internal test, not a production-readiness declaration. Multi-day physical-device functional and security QA is still open.

### Owner web vault

- The current branch implements Supabase authentication, local browser-worker cryptography, and encrypted owner-vault CRUD for all 17 current asset types.
- Mobile and web share the same Supabase identity, `vault_key_material`, `vault_assets`, envelope format, and schema-driven category registry. There is no parallel web vault.
- The branch includes mobile forward-field preservation, failed-persistence reconciliation, and nonce-based protected-route security headers.
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

## Current Blockers And Technical Debt

### Before completing mobile Phase 1 readiness

- Complete TestFlight contact/test information and intended initial GCC territory configuration.
- Run and record multi-day physical-device QA against build 3: cold start, authentication/unlock, encrypted CRUD, background/foreground locking, biometrics, screenshot/sensitive-screen behavior, recovery, emergency access, sign-out, and returning-user flow.
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
- Revisit the remaining moderate Expo/UUID tooling path and Next/PostCSS advisory through compatible upstream releases; do not force breaking downgrades. On 2026-07-21, compatible lockfile updates moved `js-yaml` to `4.3.0` and `shell-quote` to `1.10.0`, removing two newly reported high-severity production findings. The post-fix production audit has no high or critical finding.
- Update the local Node runtime: this machine reports `24.2.0`, below the repository's deliberate `>=24.3.0` Node 24 range. Do not weaken the engine requirement.

### Public and claimant blockers

- Resolve `apps/web/LEGAL_CONTENT_REVIEW.md` and obtain owner/counsel approval before public legal publication.
- Decide who can authorize release when the owner cannot respond, what evidence is accepted, applicable jurisdictions, challenge/cooldown rules, operator responsibilities, retention, disputes, and governing law.
- Design and review the V2 split emergency-code protocol before any code-based claim lookup. Existing V1 codes have no safe public locator.

## Active Next Slice

Finish device-backed validation and review `codex/mvp-landing-legal` for PR readiness.

This remains the single project-wide implementation slice. The parallel claimant Slice 2 track in `CLAIM_HANDOFF.md` is limited to documentation, non-runtime synthetic test-vector tooling, and static information-only pages with every capability hard-disabled. It does not authorize claimant authentication, persistence, migrations, APIs, invitations, evidence handling, notifications, workflow processors, or release behavior.

The repeatable local portion is complete and lives in `apps/mobile/src/features/vault/mobile-web-live-supabase-smoke.test.ts`. It passed bidirectional browser/mobile-repository decrypt and edit for four representative categories, optional and multiline fields, unknown-field preservation, ciphertext-only persistence, the browser deletion lifecycle, offline-save reconciliation, protected headers, empty local/session storage, worker relock, and tagged identity/row cleanup.

The local branch/PR-readiness review completed on 2026-07-21. The full diff passed whitespace and changed-file risk scans; web production build, all workspace typechecks and lint, 516 tests with the expected 3 protected live tests skipped, mobile coverage, Expo Doctor 21/21, Phase 1/security/workflow/secret guards, 38 guard regression tests, Docker-backed Supabase catalog and hostile RLS tests, and the high-severity production dependency threshold passed. The local Supabase stack must be started with `npx supabase start --workdir supabase` because the checked-in security harness targets that project id. No unresolved high-severity branch-review finding remains.

Remaining evidence:

1. On TestFlight build 3, use a dedicated synthetic identity to confirm web-created records display and edit through the native UI and that the web reads the native edit.
2. Record only value-free device/build/pass-fail evidence; remove every tagged row and test identity.

Do not deploy the protected vault, attach production domains, publish draft legal content, change Supabase Auth globally, or begin stateful claimant implementation in this slice.

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

Run database security checks before and after any migration or RLS change. Release candidates also require the protected `iOS TestFlight release` workflow from `main`, explicit `Release` approval, App Store processing confirmation, and recorded physical-device QA.

## Session Startup Checklist

1. Read the four documents listed under `Start Here`.
2. Run `git status --short --branch` and `git log --oneline --decorate -5`.
3. Preserve unrelated user changes and expected local-only files.
4. Confirm that the active slice above is still current and that the environment remains protected development.
5. Recheck time-sensitive provider or security guidance only when the slice depends on it.
6. State the slice scope and non-goals, implement or verify only that slice, record evidence, update the handoffs, and stop for owner review.
