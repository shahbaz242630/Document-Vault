# Sanduqkin Project Handoff

## Current Status

Sanduqkin is still in **Phase 1 foundation / integration hardening**.

Do **not** move to Phase 2 beneficiary/activation work yet. Do **not** continue Phase 3 payments work until Phase 1 is integrated and verified end-to-end.

The codebase contains a large amount of Phase 1 UI and domain logic, plus some early Phase 3 RevenueCat/payment work, but the core Phase 1 Definition of Done is not met because several critical flows are local-only or placeholder-wired.

## Source Of Truth

- BRD: `Vault_BRD_v1.0.md`
- BRD version shown in file: 1.1
- Active scope: Phase 1 - Core Single-User Vault
- App/product name: Sanduqkin
- Domain: `sanduqkin`
- Repository root: `C:\Projects\GitHub\Secrets Vault`
- Current date of this handoff refresh: 2026-05-29

## Product Guardrails

- Sanduqkin is a secure information organizer, not a financial service, estate-planning product, legal service, or investment product.
- User-facing copy must avoid forbidden financial/legal positioning from the BRD.
- Phase 1 is single-user only.
- Phase 1 excludes beneficiaries, activation flow, witnesses, document upload, production notifications, web app, and payments.
- Phase 1 must prove auth, encryption, persistence/sync, and asset CRUD end-to-end before the next phase.

## Architecture Snapshot

- Monorepo with npm workspaces:
  - `apps/mobile` - Expo React Native app using Expo Router and TypeScript.
  - `packages/shared-types` - shared asset types.
  - `packages/shared-validation` - shared Zod validation.
  - `services/api` - Hono API scaffold.
- Mobile dependencies include Supabase, libsodium, SecureStore, local authentication, RevenueCat, and Zod.
- Backend currently exposes only:
  - `GET /health`
  - `POST /webhooks/revenuecat`

## What Is Built

### Mobile UI / Routes

The app has route screens for:

- Welcome/onboarding.
- Sign up and sign in.
- Email verification placeholder.
- Profile basics.
- TOTP setup, backup codes, and TOTP verification placeholders.
- Recovery phrase generation and confirmation.
- Biometric setup.
- Vault dashboard.
- Add asset forms for all 10 Phase 1 categories:
  - bank account
  - investment
  - property
  - insurance
  - crypto
  - pension
  - subscription
  - document location
  - contact
  - other
- Asset detail and generic edit flow.
- Recently deleted, restore, and permanent delete with confirmation.
- Settings.
- Re-authentication before account deletion.
- Account deletion.
- Forgot/reset password.
- RevenueCat paywall and customer center routes.

### Local Domain Logic

Implemented and tested in local modules:

- Asset payload validation and encryption boundary.
- Client-side encryption primitives using libsodium XChaCha20-Poly1305.
- Argon2id KEK derivation.
- MEK wrapping/unwrapping helpers.
- Recovery phrase generation/confirmation.
- In-memory vault store/session.
- Soft delete, restore, and permanent delete behavior.
- Failed-login lockout logic.
- Auto-lock timing and privacy overlay.
- Biometric storage wrapper.
- Audit log singleton.
- Account deletion local storage clearing.
- RevenueCat purchase-service abstraction.

## Critical Gaps

### P0 - Vault Persistence Is Not Integrated

Assets are still stored at runtime in an in-memory `Map` in `apps/mobile/src/features/vault/vault-store.ts`.

A local Supabase migration now exists at `supabase/migrations/20260529184326_phase1_secure_data_foundation.sql` for encrypted vault assets, wrapped MEK key material, and audit events with RLS. It has not yet been applied to the remote Supabase project or wired into the live mobile vault flows.

Impact:

- Assets are lost on app reload.
- Assets are lost on sign-out.
- Supabase persistence schema exists locally but is not applied/wired.
- No backend vault CRUD endpoints exist.
- The BRD requirement that encrypted vault data syncs/persists end-to-end is not met.

Required next work:

- Apply and verify the Supabase schema/migration against the remote project.
- Add mobile persistence boundary or API client for encrypted asset CRUD.
- Ensure only ciphertext, nonce, asset type, timestamps, owner id, and deletion metadata are server-visible.

### P0 - Real TOTP Flow Is Not Wired

Current placeholders:

- TOTP enrollment route links with `factorId=placeholder-factor-id`.
- Sign-in sends `factorId: ""` to verification.
- Re-auth uses `placeholder-factor-id`.

Impact:

- Mandatory 2FA cannot be considered enforced.
- Re-auth before deletion is not production-valid.
- Returning login flow does not satisfy the BRD.

Required next work:

- Wire Supabase MFA enrollment result into UI.
- Render/store the real factor id for verification.
- Fetch/list enrolled factors for returning sign-in.
- Enforce AAL/session checks before vault access.
- Remove all placeholder factor ids.

### P0 - Recovery Phrase / MEK Lifecycle Is Not Production-Safe

Current issues:

- Recovery words are no longer passed through route params in the local signup flow.
- MEK is no longer saved to SecureStore when generated; it is saved only after phrase confirmation succeeds.
- KEK/MEK wrapping exists but is not integrated into sign-up upload/persistence.
- Returning-user unlock does not restore persisted encrypted records because assets are local-only.

Impact:

- The zero-knowledge key lifecycle is incomplete.
- Password reset/recovery cannot safely restore a persisted vault yet.

Required next work:

- Persist wrapped MEK and salt to Supabase only after confirmation.
- Integrate password-derived KEK on signup/login/reset.
- Wire wrapped MEK save/load/update flows through the new `vault_key_material` table.

### P0 - Returning User Flow Is Not End-To-End

The BRD requires: log out, kill app, reopen, log back in including biometric, and render decrypted vault.

Current issues:

- Sign-out clears local MEK state.
- Asset records are in memory only.
- Login does not unwrap a server-stored MEK.
- Biometric unlock only works with cached local key state and no durable synced assets.

Required next work:

- Implement persisted encrypted assets.
- Wire persisted wrapped MEK metadata.
- Restore vault session from Supabase Auth + MFA + KEK/biometric unlock.

### P1 - Account Deletion Is Local-Only

Current behavior:

- Locks/clears local vault state.
- Clears local SecureStore values.
- Anonymizes local audit log.
- Logs out RevenueCat.
- Navigates home.

Missing:

- Server-side account deletion queue.
- Supabase vault data deletion.
- Supabase auth/user cleanup path.
- Confirmation email.
- 30-day deletion handling.
- 7-year anonymized audit retention.

Also, re-auth currently includes a prototype bypass when Supabase is unavailable. That must be removed before production hardening.

### P1 - Audit Logging Is Local-Only

Audit events are stored in an in-memory singleton.

Missing:

- Durable audit persistence.
- Server-side/auditable timestamps.
- IP address capture for login attempts.
- Device metadata beyond the hardcoded `"React Native"`.
- Retention/anonymization model in the database.

### P1 - Tests / Tooling Baseline

Most recent verification results:

- `npm run test --workspace @vault/mobile` passes: 56 files, 213 tests.
- Latest Supabase foundation slice: `npm run test --workspace @vault/mobile` passes: 58 files, 218 tests.
- `npm run typecheck` passes across mobile, shared packages, and API.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails with 14 moderate vulnerabilities.

Audit details:

- Remaining advisories are Expo SDK 54 transitive tooling dependencies:
  - `postcss <8.5.10` under `@expo/metro-config`.
  - `uuid <11.1.1` under `xcode`.
- `npm audit fix` cannot resolve cleanly in this workspace.
- `npm audit fix --force` proposes installing `expo@56.0.8`, a breaking SDK-family upgrade. Do not take that as part of Phase 1 hardening without an explicit Expo upgrade slice.
- A previous targeted root `@expo/metro-config.postcss` override remains in `package.json`, but npm currently still resolves the nested vulnerable `postcss@8.4.49` under `@expo/metro-config`.

### P1 - Production TODO Exists

`services/api/src/webhooks/revenuecat.ts` contains a TODO to sync entitlement state to Supabase.

This violates the Phase 1 BRD Definition of Done rule: no TODO comments in production code paths.

### P1 - Phase Drift

RevenueCat/paywall/customer-center work has started even though the BRD says Phase 1 payments are out of scope and Phase 1 must be complete before moving forward.

Recommendation:

- Freeze payment work for now.
- Leave existing payment code untouched unless it blocks Phase 1 verification.
- Return to Phase 1 integration hardening.

## Phase 1 DoD Status

Current assessment against BRD Section 7.4:

- New user can sign up, complete real 2FA, save recovery phrase, and reach dashboard on iOS/Android: **not met**
- User can add one asset of each 10 categories: **partially met locally**
- User can edit and delete assets: **partially met locally**
- User can log out, kill app, reopen, and log back in including biometric: **not met**
- User can delete account: **partially met locally**
- Vault content encrypted client-side and database contains ciphertext only: **not met because no database integration**
- Audit logging works for sensitive actions: **partially met locally**
- Auto-logout works: **partially met**
- Background privacy screen works: **implemented, needs device verification**
- Failed-login lockout works: **implemented in memory, needs persistence review**
- Tests pass for crypto/auth/CRUD: **not met**
- Manual physical iOS and Android journey test: **not verified**
- No TODO comments in production paths: **not met**
- Folder structure matches Section 2.5: **partially met**
- No file over 500 lines, no function over 100 lines: **needs fresh automated check before completion**

## Recommended Next Stage

Work in this order:

1. Wire real Supabase Phase 1 persistence:
   - Schema/migrations.
   - RLS.
   - Encrypted asset CRUD.
   - Durable audit log.
   - Wrapped MEK storage.

2. Wire real Supabase MFA:
   - Enrollment QR/factor id.
   - Verification.
   - Returning-user factor retrieval.
   - AAL/session gating.
   - Re-auth before deletion.

3. Complete account deletion:
   - Server-side deletion queue/path.
   - Local clear.
   - Audit anonymization.
   - Confirmation email plan or placeholder endpoint.

4. Resolve remaining SDK audit advisories:
   - Either wait for an SDK 54-compatible Expo patch that updates the transitive packages or plan an explicit Expo SDK upgrade slice.
   - Do not apply `npm audit fix --force` casually; it proposes a breaking Expo 56 upgrade.

5. Device verification:
   - Full sign-up journey on iOS.
   - Full sign-up journey on Android.
   - Auto-lock/background privacy.
   - Biometric unlock.
   - Returning-user login.

## Slice Log

### 2026-05-29 - Slice 1 Verification Baseline

Changed:

- Increased mobile Vitest timeout to 30 seconds in `apps/mobile/vitest.config.ts` so full-suite crypto tests can complete with the production Argon2id 256 MiB memory cost.
- Updated `expo` to `~54.0.35` and `expo-router` to `~6.0.24` in `apps/mobile/package.json`.
- Regenerated `package-lock.json`.

Verification:

- `npm run test --workspace @vault/mobile` passes: 54 files, 206 tests.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` fails on Expo SDK 54 transitive `postcss` and `uuid` advisories. npm's force fix proposes a breaking Expo 56 upgrade, so this remains a tracked blocker.

### 2026-05-29 - Slice 2 Recovery Phrase / MEK Lifecycle Hardening

Changed:

- Added an in-memory `RecoveryPhraseSessionProvider` for the active signup recovery phrase flow.
- Wired the root app layout to provide recovery phrase session state.
- Changed recovery phrase generation so `{ words, mek }` is held in memory and the confirmation screen is opened without URL params.
- Removed early MEK persistence from `/auth/recovery-phrase`.
- Changed confirmation so successful phrase validation persists the MEK to SecureStore, clears in-memory phrase state, updates signup progress to `setup-biometric`, and navigates to biometric setup.
- Added a safe restart state when `/auth/confirm-recovery-phrase` is opened without an in-memory phrase session.
- Added `@types/react-dom@~19.1.7` for the new server-rendered React context tests.

Verification:

- `npm run test --workspace @vault/mobile` passes: 56 files, 213 tests.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories.

### 2026-05-29 - Branding Update: Sanduqkin

Changed:

- Updated the Expo app display name, slug, and scheme to `Sanduqkin` / `sanduqkin`.
- Updated the root package name and API health service identifier to `sanduqkin`.
- Updated user-facing mobile auth/onboarding copy from Vault branding to Sanduqkin.
- Updated the BRD project/app naming to Sanduqkin while preserving the existing BRD version.
- Updated focused tests that asserted old Vault-branded copy.
- Preserved internal `vault` route, feature, type, and store names where they describe the secure vault domain rather than the app brand.

Verification:

- `npm run test --workspace @vault/mobile` passes: 56 files, 213 tests.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories.

### 2026-05-29 - Credentials Folder Ignore

Changed:

- Added `.gitignore` rules for the local `Details/` credentials folder.
- Added spreadsheet ignore patterns for `*.xlsx` and temporary Excel lock files.

Verification:

- `git status --short -- Details .gitignore` no longer lists `Details/`; only `.gitignore` remains pending.
- `git check-ignore -v` confirms `Details/Details.xlsx` and `Details/~$Details.xlsx` are ignored.

### 2026-05-29 - Supabase Local Env Connected

Changed:

- Added local `.env` values for the Sanduqkin Supabase project using the Expo variable names expected by the app:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Did not add Vite `VITE_*` variables because this is an Expo React Native app, not a Vite React web app.
- Kept `.env.example` placeholder-only so real project values are not committed.
- Confirmed `@supabase/supabase-js` was already installed in `apps/mobile/package.json`.

Verification:

- `npm run test --workspace @vault/mobile -- supabase-env supabase-client` passes: 2 files, 5 tests.
- `git check-ignore -v .env` confirms `.env` is ignored by `.gitignore`.

### 2026-05-29 - Supabase Phase 1 Data Foundation

Changed:

- Initialized local Supabase project config in `supabase/config.toml`.
- Set local Supabase project id to `sanduqkin`.
- Enabled local TOTP MFA enrollment and verification in Supabase config.
- Added migration `supabase/migrations/20260529184326_phase1_secure_data_foundation.sql`.
- Migration adds:
  - `vault_key_material` for wrapped MEK ciphertext, MEK wrap nonce, KEK salt, and KDF metadata.
  - `vault_assets` for encrypted asset ciphertext, nonce, asset type, timestamps, and deletion metadata.
  - `audit_events` for durable security event records without raw user email storage.
- Migration grants access only to `authenticated` and `service_role`; no `anon` table access was added.
- Migration enables RLS on all exposed public tables and uses `auth.uid()` owner policies.
- Added mobile Supabase vault codec helpers to serialize/deserialize encrypted asset records and wrapped MEK key material without plaintext fields.
- Added schema guard tests for the migration/config and codec tests for encrypted record mapping.

Not yet done:

- Remote Supabase project migration was not applied from this environment because only the publishable client key is configured; schema deployment needs dashboard SQL, DB password, or a Supabase access token.
- Live vault screens still use the in-memory store. The next slice should wire the mobile repository calls into asset create/list/update/delete flows.

Verification:

- `npm run test --workspace @vault/mobile -- supabase-schema supabase-vault-codec` passes: 2 files, 5 tests.
- `npm run test --workspace @vault/mobile` passes: 58 files, 218 tests.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories.

## Commands To Run Before Claiming Completion

From repo root:

```powershell
npm run test --workspace @vault/mobile
npm run typecheck
npm audit --audit-level=moderate
```

From `apps/mobile`:

```powershell
npx expo-doctor
```

After Supabase/API integration exists, add backend/API tests and run them as part of completion.

## Working Agreement For Next Sessions

- Read this handoff first.
- Read only the BRD sections relevant to the current task, usually Sections 1-7 for Phase 1.
- Keep edits scoped to Phase 1 integration hardening unless explicitly directed otherwise.
- Do not add new Phase 2 or Phase 3 features until Phase 1 DoD is green.
- Do not hardcode Supabase service-role keys or secrets into mobile code.
- Keep vault plaintext client-side only.
- Prefer small slices with tests and verification after each slice.
