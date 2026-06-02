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
- Repository root: `C:\Projects\GitHub\Sandoq Kin`
- Current date of this handoff refresh: 2026-06-01

## Product Guardrails

- Sanduqkin is a secure information organizer, not a financial service, estate-planning product, legal service, or investment product.
- User-facing copy must avoid forbidden financial/legal positioning from the BRD.
- Phase 1 is single-user only.
- Phase 1 excludes beneficiaries, activation flow, witnesses, document upload, production notifications, web app, and payments.
- Phase 1 must prove auth, encryption, persistence/sync, and asset CRUD end-to-end before the next phase.

## Founder Product Context

The core user promise is that a user can save key personal and family information so their next of kin can receive an organized copy if the user dies, enters a coma, or becomes disabled and cannot communicate.

Examples of information users may eventually save include assets, personal information, passwords, emails, bank accounts, will-related information, and locations of important documents.

Encryption design must preserve two requirements at the same time:

- During normal operation, Sanduqkin must not be able to read the user's vault contents. The database should contain ciphertext and non-sensitive metadata only.
- After a future verified next-of-kin / Beneficiary release process, the authorized recipient must be able to decrypt and receive the user's saved information.
- Sanduqkin staff, colleagues, contractors, support users, and administrators must not be able to view plaintext vault information through dashboards, logs, database access, support tools, or backend services.

Implication for future phases: do not design Phase 1 encryption as device-only permanent lock-in. Phase 1 must encrypt data with the user's MEK, persist wrapped MEK/key material, and leave a clean path for Phase 2 Beneficiary Access Key / encrypted release workflows without exposing plaintext to Sanduqkin servers.

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
- RevenueCat purchase-service abstraction for the `Sanduqkin Pro` entitlement and `monthly` / `yearly` packages.

## Critical Gaps

### P0 - Vault Persistence Is Not Integrated

Assets are still stored at runtime in an in-memory `Map` in `apps/mobile/src/features/vault/vault-store.ts`.

A local Supabase migration now exists at `supabase/migrations/20260529184326_phase1_secure_data_foundation.sql` for encrypted vault assets, wrapped MEK key material, and audit events with RLS. It has not yet been applied to the remote Supabase project. Mobile vault asset persistence is wired locally but not remote-verified.

A tested mobile Supabase vault asset repository now exists at `apps/mobile/src/features/vault/supabase-vault-repository.ts`. It saves, lists, soft-deletes, restores, and permanently deletes already-encrypted vault asset records through `vault_assets`. The mobile vault session now accepts this repository, loads persisted encrypted records after MEK unlock, and persists encrypted create/update/delete metadata operations when Supabase is configured.

Impact:

- Assets should no longer be limited to the in-memory session once Supabase is configured and the remote migration is applied, but this has not yet been verified against the remote project.
- Assets are still effectively local-only in environments where Supabase is not configured or the remote migration is not applied.
- Supabase persistence schema exists locally but is not applied to the remote project.
- No backend vault CRUD endpoints exist.
- The BRD requirement that encrypted vault data syncs/persists end-to-end is not met.

Required next work:

- Verify the live vault session against the remote Supabase project after migration deployment.
- Ensure only ciphertext, nonce, asset type, timestamps, owner id, and deletion metadata are server-visible during live device/simulator testing.

### Launch-Deferred - Real Supabase MFA Is Not Wired

Supabase MFA is intentionally on hold until launch because it is a paid feature. During development, password sign-in now proceeds to persisted vault unlock rather than the placeholder TOTP route.

Current placeholders:

- TOTP enrollment route links with `factorId=placeholder-factor-id`.
- Re-auth uses `placeholder-factor-id`.

Impact:

- Mandatory 2FA cannot be considered enforced for production until Supabase MFA is enabled.
- Re-auth before deletion is not production-valid.

Required launch work:

- Wire Supabase MFA enrollment result into UI.
- Render/store the real factor id for verification.
- Fetch/list enrolled factors for returning sign-in.
- Enforce AAL/session checks before vault access.
- Remove all placeholder factor ids.

### P0 - Recovery Phrase / MEK Lifecycle Is Not Production-Safe

Current issues:

- Recovery words are no longer passed through route params in the local signup flow.
- MEK is no longer saved to SecureStore when generated; it is saved only after phrase confirmation succeeds.
- KEK/MEK wrapping is now saved during recovery phrase confirmation when Supabase is configured.
- Returning-user password sign-in now loads wrapped MEK, derives KEK, unwraps MEK, stores it locally, initializes the vault session, and loads persisted encrypted asset records.
- This returning-user unlock path still needs live Supabase journey verification.

Impact:

- The zero-knowledge key lifecycle is partially integrated but not yet physically/live verified.
- Password reset/recovery cannot safely restore a persisted vault yet.

Required next work:

- Verify wrapped MEK save/load/unwrap against the remote Supabase project in the app.
- Integrate password reset/recovery with wrapped MEK update flows.

### P0 - Returning User Flow Is Not End-To-End

The BRD requires: log out, kill app, reopen, log back in including biometric, and render decrypted vault.

Current issues:

- Password login now unwraps server-stored MEK and initializes the vault session when key material exists.
- Persisted encrypted asset load is wired after MEK unlock.
- This has not yet been verified in a live app journey against the remote Supabase project.
- Biometric unlock still depends on cached local key state.

Required next work:

- Run a live returning-user journey: sign up, confirm phrase, save asset, sign out, sign back in with password, unwrap MEK, and render decrypted remote asset.
- Verify biometric unlock after the returning-user persisted-data path is proven.

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
- Latest vault persistence wiring slice: `npm run test --workspace @vault/mobile` passes: 59 files, 228 tests.
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

RevenueCat/paywall/customer-center work exists even though the BRD says Phase 1 payments are out of scope and Phase 1 must be complete before moving forward.

Recommendation:

- Treat the current RevenueCat work as a contained payment foundation only.
- Do not gate Phase 1 vault functionality behind subscriptions until Phase 1 integration DoD is green.
- Return to Phase 1 integration hardening.

## Phase 1 DoD Status

Current assessment against BRD Section 7.4:

- New user can sign up, complete real 2FA, save recovery phrase, and reach dashboard on iOS/Android: **not met**
- User can add one asset of each 10 categories: **partially met locally**
- User can edit and delete assets: **partially met locally**
- User can log out, kill app, reopen, and log back in including biometric: **not met**
- User can delete account: **partially met with server-side request queue plus local clear**
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
   - Server-side deletion processing worker/API path.
   - Supabase Auth user cleanup using service role on the server only.
   - Confirmation email plan or placeholder endpoint.
   - 30-day processing policy and 7-year anonymized audit retention policy.

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

### 2026-05-30 - RevenueCat Subscription Foundation

Changed:

- Confirmed `react-native-purchases` and `react-native-purchases-ui` are installed.
- Added support for a shared local RevenueCat public SDK key via `EXPO_PUBLIC_REVENUECAT_API_KEY`.
- Added the provided RevenueCat test key to local `.env`; `.env.example` remains placeholder-only.
- Kept platform-specific `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` support for production App Store / Google Play keys.
- Updated RevenueCat SDK selection so app launch uses the platform key when present, otherwise the shared key.
- Set the active entitlement identifier to `Sanduqkin Pro`.
- Added package identifiers for `monthly` and `yearly`.
- Expanded purchase service behavior for customer info retrieval, entitlement checks, offering/package lookup, purchases, restore purchases, cancellation handling, and error handling.
- Updated premium-status hook to listen for RevenueCat customer-info updates.
- Switched paywall route to `RevenueCatUI.presentPaywallIfNeeded` with the `Sanduqkin Pro` entitlement.
- Switched customer center route to `RevenueCatUI.presentCustomerCenter` with restore callbacks.
- Refreshed npm workspace junctions after the local project folder changed to `C:\Projects\GitHub\Sandoq Kin`.

Dashboard setup still required:

- In RevenueCat, create/confirm entitlement identifier exactly `Sanduqkin Pro`.
- In RevenueCat offerings, expose packages with identifiers `monthly` and `yearly`.
- Link those packages to App Store Connect / Google Play subscription product ids.
- Before production, replace the shared test key with platform-specific iOS and Android public SDK keys if RevenueCat gives separate app keys.

Verification:

- `npm run test --workspace @vault/mobile -- revenuecat-env purchase-service` passes: 2 files, 18 tests.
- `npm run typecheck` passes.
- `npm run test --workspace @vault/mobile` passes: 58 files, 221 tests.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories.

### 2026-05-30 - Supabase Vault Asset Repository Boundary

Changed:

- Added `apps/mobile/src/features/vault/supabase-vault-repository.ts`.
- Added a narrow Supabase client interface for the `vault_assets` table.
- Added repository operations for:
  - encrypted asset upsert/save,
  - ordered encrypted asset listing,
  - soft delete metadata updates,
  - restore metadata updates,
  - permanent encrypted asset deletion.
- Kept the repository boundary encrypted-record-only; plaintext title, fields, and notes are not accepted or serialized by the repository.
- Exported the repository from the vault public module.

Not yet done:

- Live vault session/screens were wired in the following slice, but this repository-boundary slice did not yet integrate them.
- Remote Supabase migration still needs to be applied and verified.
- Wrapped MEK key material persistence is still not wired.
- Durable audit persistence is still not wired.

Verification:

- Test-first red check: `npm run test --workspace @vault/mobile -- supabase-vault-repository` initially failed because `supabase-vault-repository` did not exist.
- `npm run test --workspace @vault/mobile -- supabase-vault-repository` passes: 1 file, 4 tests.
- `npm run test --workspace @vault/mobile -- supabase-vault-codec supabase-vault-repository vault-store vault-session` passes: 4 files, 20 tests.
- `npm run test --workspace @vault/mobile` passes: 59 files, 225 tests.
- `npm run typecheck` passes.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories. `npm audit fix --force` still proposes `expo@56.0.8`, so no force fix was applied.

### 2026-05-30 - Vault Session Supabase Persistence Wiring

Changed:

- Extended `createVaultSession` to accept a `VaultAssetRepository`.
- Added `loadPersistedAssets()` to the vault session so encrypted records can be loaded after MEK unlock and decrypted locally.
- Changed session soft delete, restore, and permanent delete operations to async so repository writes are awaited.
- Added `replaceEncryptedRecords()` to the in-memory vault store for safe hydration from persisted encrypted records.
- Wired `VaultSessionProvider` to create a Supabase vault repository when Supabase env is configured.
- The provider now loads persisted encrypted assets when a stored/unlocked MEK is available:
  - app startup with a locally stored MEK,
  - explicit vault initialization/unlock with a MEK.
- The provider does not attempt to load remote encrypted records when it had to generate a fresh local MEK, avoiding decrypting persisted records with the wrong key.

Not yet done:

- Remote Supabase migration still needs to be applied and verified.
- Wrapped MEK key material persistence is still not wired, so true returning-user unlock after sign-out/app reinstall remains incomplete.
- Recovery phrase confirmation now asks the user to re-enter their account password, derives KEK locally, wraps MEK locally, and saves only wrapped MEK + salt + KDF metadata through the key-material repository when Supabase is configured.
- Durable audit persistence is still not wired.
- No physical-device Supabase persistence journey has been run yet.

Verification:

- Test-first red check: `npm run test --workspace @vault/mobile -- vault-session` initially failed because `loadPersistedAssets()` and repository persistence calls did not exist.
- `npm run test --workspace @vault/mobile -- vault-session vault-store supabase-vault-repository` passes: 3 files, 20 tests.
- `npm run typecheck` passes.
- `npm run test --workspace @vault/mobile` passes: 59 files, 228 tests.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories. `npm audit fix --force` still proposes `expo@56.0.8`, so no force fix was applied.

### 2026-05-30 - Supabase Wrapped MEK Key-Material Repository

Changed:

- Added `apps/mobile/src/features/vault/supabase-key-material-repository.ts`.
- Added a narrow Supabase client interface for the `vault_key_material` table.
- Added repository operations for:
  - saving wrapped MEK key material,
  - loading wrapped MEK key material,
  - returning `null` when no key material exists yet.
- Kept the repository boundary wrapped-key-only; it does not accept plaintext MEK, password, email, or user id.
- Exported the repository from the vault public module.

Remote deployment status:

- `supabase --version` reports CLI `2.39.2` and warns that `2.102.0` is available.
- Supabase CLI was logged into the account that can see project `pxwtexjjttpgtairpepz`.
- `supabase link --project-ref pxwtexjjttpgtairpepz` completed successfully after providing the project database password via `SUPABASE_DB_PASSWORD`.
- `supabase db push` applied `20260529184326_phase1_secure_data_foundation.sql` to the remote database.
- `supabase migration list` now shows local and remote both at `20260529184326`.
- `supabase db dump --schema public` could not be used for schema inspection because Docker Desktop is not available in this environment.
- `psql` was not found on PATH or in common PostgreSQL install locations. Scoop PostgreSQL install failed due an invalid/timed-out EnterpriseDB package URL; Chocolatey PostgreSQL install failed due non-admin Chocolatey lock/permission issues. The failed Scoop install marker was cleaned up with `scoop uninstall postgresql`.
- Remote schema was inspected using a temporary Node `pg` install outside the repo. No temporary package files were kept in the repository.
- No Supabase tokens or database passwords were written to project files.

Not yet done:

- Recovery phrase confirmation UI now asks for password re-entry and saves wrapped MEK key material when Supabase is configured.
- Returning-user login still does not load wrapped MEK, derive KEK from the entered password, unwrap MEK, and initialize the vault session.

Verification:

- Test-first red check: `npm run test --workspace @vault/mobile -- supabase-key-material-repository` initially failed because `supabase-key-material-repository` did not exist.
- `npm run test --workspace @vault/mobile -- supabase-key-material-repository supabase-vault-codec` passes: 2 files, 6 tests.
- `npm run typecheck` passes.
- `npm run test --workspace @vault/mobile` passes: 60 files, 231 tests.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories. `npm audit fix --force` still proposes `expo@56.0.8`, so no force fix was applied.

### 2026-05-30 - Recovery Confirmation Wrapped MEK Save

Changed:

- Recovery phrase confirmation now includes an account password field.
- `completeRecoveryPhraseConfirmation` now requires the password, rejects an empty password before local MEK storage, derives KEK locally, wraps MEK locally, and saves wrapped key material before advancing signup progress.
- Wired the confirmation route to real crypto dependencies:
  - `generateSalt`,
  - `deriveKEK`,
  - `wrapMEK`,
  - `createSupabaseKeyMaterialRepository` when Supabase is configured.
- Password is used only in memory for KEK derivation and is not stored in SecureStore, route params, signup progress, logs, or repository data.

Not yet done:

- Returning-user login still does not load wrapped MEK, derive KEK from the entered password, unwrap MEK, and initialize the vault session.
- Remote Supabase migration has been applied and migration history matches. Direct table inspection still needs either Docker Desktop, `psql`, or dashboard SQL verification.

### 2026-05-30 - Supabase CLI Link And Remote Migration Push

Changed:

- Logged Supabase CLI into the account that can access the Sanduqkin project.
- Linked the local repo to project `pxwtexjjttpgtairpepz`.
- Applied remote migration `20260529184326_phase1_secure_data_foundation.sql` with `supabase db push`.
- Confirmed `supabase migration list` reports local and remote migration versions both at `20260529184326`.

Verification:

- `supabase projects list` shows `pxwtexjjttpgtairpepz` / `admin@sanduqkin.com's Project`.
- `supabase link --project-ref pxwtexjjttpgtairpepz` completed.
- `supabase db push` completed and applied the Phase 1 secure data foundation migration.
- `supabase migration list` shows the migration present locally and remotely.
- Remote schema inspection confirmed `vault_key_material`, `vault_assets`, and `audit_events` exist and RLS is enabled.

Limitations:

- `supabase db dump --schema public` failed because Docker Desktop is not available.
- `psql` is not available on PATH. Direct schema inspection was performed through a temporary Node `pg` script instead.
- Initial remote inspection found broad direct grants to `anon`; this was fixed in the following hardening migration.

### 2026-05-30 - Supabase Phase 1 Grant Hardening

Changed:

- Added migration `supabase/migrations/20260530183320_harden_phase1_table_grants.sql`.
- The migration revokes all direct table privileges from `anon`, `authenticated`, and `public` for:
  - `vault_key_material`,
  - `vault_assets`,
  - `audit_events`.
- The migration reapplies only the intended authenticated grants:
  - `vault_key_material`: `select`, `insert`, `update`,
  - `vault_assets`: `select`, `insert`, `update`, `delete`,
  - `audit_events`: `select`, `insert`.
- `service_role` keeps full access.
- Added a schema test that requires explicit `anon`/`public` revokes in the migration set.

Remote verification:

- Initial temporary Node `pg` schema inspection confirmed all three tables existed and RLS was enabled, but showed broad direct `anon` grants.
- `supabase db push` applied `20260530183320_harden_phase1_table_grants.sql`.
- `supabase migration list` now shows local and remote migrations:
  - `20260529184326`
  - `20260530183320`
- Follow-up temporary Node `pg` schema inspection confirmed:
  - all three tables exist,
  - RLS is enabled on all three tables,
  - RLS policies are scoped to `authenticated`,
  - `anon` no longer has direct grants on the Phase 1 vault tables,
  - authenticated grants match the intended table-level permissions.

Verification:

- Test-first red check: `npm run test --workspace @vault/mobile -- supabase-schema` initially failed because no grant-hardening migration existed.
- `npm run test --workspace @vault/mobile -- supabase-schema` passes: 1 file, 3 tests.
- `npm run test --workspace @vault/mobile` passes: 60 files, 233 tests.
- `npm run typecheck` passes.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories. `npm audit fix --force` still proposes `expo@56.0.8`, so no force fix was applied.

Verification:

- Test-first red check: `npm run test --workspace @vault/mobile -- recovery-phrase-flow` initially failed because key material was not saved and empty password was accepted.
- `npm run test --workspace @vault/mobile -- recovery-phrase-flow supabase-key-material-repository supabase-vault-codec` passes: 3 files, 10 tests.
- `npm run typecheck` passes.
- `npm run test --workspace @vault/mobile` passes: 60 files, 232 tests.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories. `npm audit fix --force` still proposes `expo@56.0.8`, so no force fix was applied.

### 2026-05-31 - Returning User Wrapped MEK Unlock

Decision:

- Supabase MFA is intentionally deferred until launch because it is a paid feature.
- During development, successful Supabase password sign-in proceeds to persisted vault unlock instead of the placeholder TOTP verification route.
- MFA placeholders remain tracked as launch work and must not be represented as production-complete.

Changed:

- Added `apps/mobile/src/features/auth/returning-user-unlock-flow.ts`.
- Added returning-user unlock behavior that:
  - loads wrapped MEK key material from `vault_key_material`,
  - derives KEK from the entered sign-in password and persisted salt,
  - unwraps MEK locally,
  - stores the MEK in SecureStore through the existing MEK storage boundary,
  - initializes the vault session with the unwrapped MEK,
  - loads persisted encrypted vault assets through the vault session.
- Changed password sign-in result from placeholder `totp-verification` to `vault-unlock` for the development path.
- Wired the sign-in form to call the returning-user unlock flow and route to `/vault` after unlock.

Not yet done:

- Live remote Supabase journey verification is still needed.
- Biometric returning-user flow still needs verification after password returning-user flow is proven.
- Supabase MFA enrollment/verification/re-auth remains launch-deferred.

Verification:

- Test-first red check: `npm run test --workspace @vault/mobile -- returning-user-unlock-flow` initially failed because `returning-user-unlock-flow` did not exist.
- `npm run test --workspace @vault/mobile -- returning-user-unlock-flow auth-service` passes: 3 files, 13 tests.
- `npm run test --workspace @vault/mobile` passes: 61 files, 235 tests.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories. `npm audit fix --force` still proposes `expo@56.0.8`, so no force fix was applied.

### 2026-05-31 - Gated Live Supabase Returning-User Verification

Changed:

- Added `apps/mobile/src/features/auth/returning-user-live-supabase.test.ts`.
- The test is skipped by default and runs only when `RUN_LIVE_SUPABASE_RETURNING_USER=1`.
- The test supports two modes:
  - create a fresh Supabase Auth user when no verified test credentials are supplied,
  - use an existing verified test account via `LIVE_SUPABASE_TEST_EMAIL` and `LIVE_SUPABASE_TEST_PASSWORD`.
- The test uses Supabase Auth and PostgREST over HTTPS directly so Vitest does not pull React Native entrypoints from the Supabase client package.
- The live journey covers:
  - Supabase password auth session,
  - `vault_key_material` wrapped MEK save/load through RLS,
  - encrypted `vault_assets` save/list through RLS,
  - sign-out/sign-in,
  - KEK derivation from password,
  - MEK unwrap,
  - vault session hydration,
  - decrypted asset assertion,
  - raw Supabase ciphertext assertion that plaintext title/contact text is not stored in the asset row.

Live verification status:

- First live attempt with `.test` email reached Supabase Auth and failed because the remote project rejects `.test` email domains.
- Second live attempt with `example.com` reached Supabase Auth and failed because the project email rate limit was exceeded.
- The live vault table journey is therefore not yet proven against remote Supabase; Auth is blocking before key-material/assets are exercised.

Required next work:

- Create or provide a verified Supabase test account and set local-only env vars:
  - `LIVE_SUPABASE_TEST_EMAIL`
  - `LIVE_SUPABASE_TEST_PASSWORD`
- Rerun:

```powershell
Get-Content .env | ForEach-Object { if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') { $name = $matches[1]; $value = $matches[2].Trim(); if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) { $value = $value.Substring(1, $value.Length - 2) }; Set-Item -Path "Env:$name" -Value $value } }; $env:RUN_LIVE_SUPABASE_RETURNING_USER='1'; npm run test --workspace @vault/mobile -- returning-user-live-supabase
```

Verification:

- `RUN_LIVE_SUPABASE_RETURNING_USER=1 npm run test --workspace @vault/mobile -- returning-user-live-supabase` reaches Supabase Auth but fails with `email rate limit exceeded` when no verified test account env vars are present.
- `npm run test --workspace @vault/mobile -- returning-user-live-supabase` passes by skipping the gated live test: 1 skipped file, 1 skipped test.
- `npm run test --workspace @vault/mobile` passes: 61 files passed, 1 file skipped; 235 tests passed, 1 skipped.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories. `npm audit fix --force` still proposes `expo@56.0.8`, so no force fix was applied.

### 2026-05-31 - Live Supabase Returning-User Journey Passed

Changed:

- Used the verified Supabase test account for live returning-user verification. The password was supplied only as a local process env var and was not written to repo files.
- The live run passed Supabase Auth and found a real remote persistence bug: default vault asset ids were local strings like `local-asset-1`, but `vault_assets.id` is a UUID column.
- Updated the default vault asset id generator in `apps/mobile/src/features/vault/vault-store.ts` to emit UUID v4-compatible ids.
- Added a regression assertion in `apps/mobile/src/features/vault/vault-session.test.ts` that default asset ids are UUID v4-compatible.

Live verification now proven:

- Password sign-in succeeds with the verified Supabase account.
- Wrapped MEK key material saves to and loads from `vault_key_material` through authenticated RLS.
- Encrypted asset records save to and load from `vault_assets` through authenticated RLS.
- Sign-out/sign-in returning-user flow derives KEK from password, unwraps MEK locally, initializes the vault session, hydrates persisted encrypted records, and renders/decrypts the expected asset.
- Raw remote asset rows were checked for ciphertext-only storage; the live plaintext asset title and contact name were not present in the selected Supabase row data.

Verification:

- Failing live check before fix: `RUN_LIVE_SUPABASE_RETURNING_USER=1 npm run test --workspace @vault/mobile -- returning-user-live-supabase` failed with `invalid input syntax for type uuid: "local-asset-1"`.
- `npm run test --workspace @vault/mobile -- vault-session returning-user-live-supabase` passes by running `vault-session` and skipping the gated live test: 1 passed file, 1 skipped file; 9 passed tests, 1 skipped.
- Live check after fix with local-only `LIVE_SUPABASE_TEST_EMAIL` / `LIVE_SUPABASE_TEST_PASSWORD`: `RUN_LIVE_SUPABASE_RETURNING_USER=1 npm run test --workspace @vault/mobile -- returning-user-live-supabase` passes: 1 file, 1 test.
- `npm run test --workspace @vault/mobile` passes: 61 files passed, 1 file skipped; 236 tests passed, 1 skipped.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories. `npm audit fix --force` still proposes `expo@56.0.8`, so no force fix was applied.

Recommended next slice:

- Run the same returning-user persistence journey through the Expo app UI or simulator/device, not just the headless repository/session path.
- Then verify biometric unlock against persisted remote assets.

### 2026-05-31 - Android Expo Go UI Verification Blocked By Crypto Runtime

Changed:

- Confirmed Android Studio/SDK is available locally and booted the `Pixel_7` AVD as `emulator-5554`.
- Launched the Expo app in Android Expo Go and confirmed the welcome/sign-in UI renders.
- Added `expo-crypto` and a small secure-random polyfill loaded from `apps/mobile/app/_layout.tsx` so React Native has `globalThis.crypto.getRandomValues` before vault crypto initializes.
- Added tests for the secure-random polyfill behavior.
- Added a RevenueCat runtime guard so Expo Go and web skip the native RevenueCat bridge. This avoids the Expo Go/browser-mode `syncPurchases is not supported on web platform` startup failure.
- Hardened biometric support probing so emulator/Expo Go hardware-check failures return unavailable support instead of crashing `BiometricSetupPanel`.

Android verification result:

- Android Expo Go now starts past the initial secure-random, RevenueCat, and biometric support blockers.
- The verified Supabase account credentials were accepted through the UI path.
- The flow is currently blocked after sign-in by `libsodium-wrappers-sumo` / `libsodium-sumo` trying to use `WebAssembly`, which is not available in the Android Expo Go React Native runtime.
- This means the current vault crypto implementation works in Node/headless tests, including live Supabase persistence, but is not yet React Native runtime compatible on Android Expo Go.

Verification:

- `npm run test --workspace @vault/mobile -- secure-random-polyfill biometric-auth-service revenuecat-runtime` passes.
- `npm run test --workspace @vault/mobile` passes: 63 files passed, 1 file skipped; 242 tests passed, 1 skipped.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK 54 transitive `postcss` and `uuid` advisories. `npm audit fix --force` still proposes `expo@56.0.8`, so no force fix was applied.

Recommended next slice:

- Decide and implement a React Native-compatible vault crypto runtime.
- Preserve the zero-knowledge design: MEK/KEK handling must remain client-side and Supabase must continue receiving ciphertext only.
- Do not casually downgrade Argon2id/XChaCha-style guarantees without an explicit security decision.
- Viable paths to investigate:
  - move to a development build/native module that supports the required primitives on Android/iOS,
  - or replace `libsodium-wrappers-sumo` with React Native-compatible crypto/KDF/AEAD primitives and keep the existing vault contract tests.
- After the crypto runtime is compatible, rerun Android UI sign-in/persistence verification, then biometric unlock verification.

### 2026-05-31 - Android Development Build Path Prepared

Decision:

- Expo Go is no longer the target runtime for encrypted vault-flow verification.
- The current `libsodium-wrappers-sumo` backend is a WASM backend and is valid in Node/headless tests, but not valid for Android Expo Go because `WebAssembly` is unavailable there.
- The next implementation step must introduce a React Native-compatible native/mobile crypto backend before claiming Android encrypted vault flows are runtime-ready.

Changed:

- Installed SDK-compatible `expo-dev-client`.
- Added `eas.json` with a development profile:
  - `developmentClient: true`,
  - `distribution: "internal"`,
  - Android `buildType: "apk"`.
- Added `start:dev-client` script for Metro dev-client sessions.
- Added stable Android application id `com.sanduqkin.mobile`.
- Added config regression tests covering the dev-client profile, dependency/script, and Android package id.
- Added `vault-crypto-runtime.ts` to explicitly model supported crypto backends.
- Added runtime assertions to the current sodium-WASM crypto entry points:
  - `generateMasterEncryptionKey`,
  - `encryptVaultPayload`,
  - `decryptVaultPayload`,
  - `toBase64`,
  - `fromBase64`,
  - `generateSalt`,
  - `deriveKEK`.
- Unsupported no-WASM runtimes now fail with a clear vault crypto migration error instead of surfacing a lower-level `libsodium-sumo` `WebAssembly` crash.

Not yet done:

- No native/mobile crypto backend exists yet.
- No Android development build was created in this slice because it would still hit the deliberate sodium-WASM runtime guard during encrypted vault flows.
- Android UI returning-user persistence and biometric unlock remain blocked until the native/mobile crypto backend is implemented.

Verification:

- Test-first red checks:
  - `development-build-config` initially failed because `eas.json`, `expo-dev-client`, `start:dev-client`, and Android package id were missing.
  - `vault-crypto-runtime` initially failed because the runtime support module did not exist.
  - `vault-crypto` and `kek-derivation` initially failed because sodium-WASM paths did not reject no-WASM runtimes clearly.
- `npm run test --workspace @vault/mobile -- kek-derivation vault-crypto vault-crypto-runtime development-build-config` passes: 4 files, 22 tests.
- `npm run test --workspace @vault/mobile` passes: 65 files passed, 1 file skipped; 250 tests passed, 1 skipped.
- `npm run typecheck` passes.
- `npx expo config --type public` resolves the Expo config and shows Android package `com.sanduqkin.mobile`.
- `npx expo-doctor` passes: 17/17 checks.
- `npx eas --version` reports `eas-cli/16.17.4`.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK transitive `postcss` and `uuid` advisories. After adding `expo-dev-client`, the audit path also includes dev-client dependencies, but the proposed force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Recommended next slice:

- Implement a native/mobile vault crypto backend behind the existing crypto contract.
- Keep existing Node/headless tests for the sodium-WASM backend if useful, but add a React Native backend boundary that can be exercised in a dev build.
- Required primitives remain:
  - secure random bytes,
  - Argon2id-compatible password KDF or an explicitly approved security-equivalent KDF,
  - 32-byte MEK generation,
  - authenticated encryption/decryption for vault payloads,
  - MEK wrap/unwrap,
  - base64 encode/decode compatibility with existing persisted records.
- Once the backend exists, build/install the Android dev client and rerun the verified Supabase returning-user journey through the UI.

### 2026-05-31 - Native Android/iOS Vault Crypto Backend Wired

Decision:

- Expo Go remains unsupported for encrypted vault-flow verification because the existing web/Node sodium path depends on `WebAssembly`.
- Development builds are now the target for Android and iOS vault crypto verification.
- Native vault crypto uses `react-native-libsodium` through React Native platform files, while Node/headless tests keep the existing `libsodium-wrappers-sumo` implementation.

Changed:

- Installed `react-native-libsodium` and registered its Expo config plugin.
- Added stable iOS bundle id `com.sanduqkin.mobile` alongside the existing Android package id.
- Added native platform crypto entry points:
  - `vault-crypto.native.ts`,
  - `kek-derivation.native.ts`,
  - `random-bytes.native.ts`.
- Added shared `generateSecureRandomBytes` usage so native screens no longer import the WASM sodium package directly.
- Updated recovery phrase entropy generation to use the shared random-bytes helper.
- Added config/tests for the native libsodium dependency, Expo plugin, iOS bundle id, and the intentional Expo doctor React Native Directory exception.
- Added a minimal `patch-package` patch for `react-native-libsodium` Android CMake path handling so Windows repo paths with spaces build correctly.

Android verification result:

- Android development build succeeded and installed on the `Pixel_7` emulator.
- The dev client loaded the native library: logcat showed `liblibsodium.so` loaded successfully.
- The previous Android runtime `WebAssembly` crash is gone in the dev build.
- The app renders the welcome/sign-in UI in the native dev client.
- With the root `.env` loaded into Metro, the live sign-in path reached Supabase.
- Live returning-user unlock is currently blocked by the remote database returning `permission denied for table vault_key_material`.
- Local migrations already include the required authenticated grants and RLS policies, so the next action is to apply/verify the remote Supabase grants/migrations. The CLI could not inspect remote migration state without the database password.

Verification:

- `npm run test --workspace @vault/mobile` passes: 66 files passed, 1 skipped; 255 tests passed, 1 skipped.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run test --workspace @vault/mobile -- development-build-config` passes after the doctor exception: 7 tests.
- `npx expo config --type public` shows:
  - Android package `com.sanduqkin.mobile`,
  - iOS bundle id `com.sanduqkin.mobile`,
  - `react-native-libsodium` config plugin.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on known Expo SDK transitive `postcss` and `uuid` advisories. The available force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Recommended next slice:

- Apply or verify the remote Supabase migrations/grants for:
  - `public.vault_key_material`,
  - `public.vault_assets`,
  - `public.audit_events`.
- Rerun Android dev-client returning-user sign-in and vault unlock once the remote `authenticated` role can access the tables through RLS.
- After Android is green, run the same native crypto verification on iOS using a development build/simulator.

### 2026-05-31 - Android Returning-User Unlock Verified In Native Dev Build

Changed:

- Reused the same Supabase client instance across sign-in, key-material load, and vault asset initialization.
- Updated `VaultSessionProvider.initialize` to accept the authenticated Supabase client for remote vault asset loading.
- Prevented cached local MEK startup restore from making remote vault asset calls without a live authenticated Supabase session.
- Added regression tests for the sign-in-to-vault session handoff and startup restore behavior.
- Removed accidental root `package.json` dependency pollution while keeping the intended `patch-package` postinstall setup.

Remote Supabase verification:

- Remote migration history shows both local migrations applied:
  - `20260529184326_phase1_secure_data_foundation`,
  - `20260530183320_harden_phase1_table_grants`.
- Remote grants were inspected directly:
  - `authenticated` has `SELECT/INSERT/UPDATE` on `vault_key_material`,
  - `authenticated` has `SELECT/INSERT/UPDATE/DELETE` on `vault_assets`,
  - `authenticated` has `SELECT/INSERT` on `audit_events`.
- Remote RLS policies are present and enabled for all three Phase 1 tables.

Android verification result:

- Android dev client loaded the updated bundle and native `liblibsodium.so`.
- Returning-user sign-in with the verified Supabase account reached the Vault screen.
- Vault UI displayed `Your vault is ready.` with vault actions.
- Filtered Android logs showed no `WebAssembly` crash and no Supabase table permission errors after the session-handoff fixes.
- Android displayed a Google Password Manager save prompt after sign-in; dismissing it revealed the Vault screen.

Verification:

- `npm run test --workspace @vault/mobile` passes: 68 files passed, 1 skipped; 258 tests passed, 1 skipped.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on known Expo SDK transitive `postcss` and `uuid` advisories. The available force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Recommended next slice:

- Verify the same native crypto returning-user flow on iOS using an iOS development build/simulator.
- Then move to biometric unlock verification against the native dev-client flow.

### 2026-06-01 - iOS Native Dev-Build Verification Blocked On Local Tooling

Attempted next slice:

- Loaded the iOS simulator workflow guidance and checked XcodeBuildMCP session defaults.
- XcodeBuildMCP had no configured project/workspace, scheme, or simulator defaults.
- Local command discovery found `eas` and `npx`, but no `xcodebuild`, `xcrun`, or CocoaPods `pod`.
- `mcp__xcodebuildmcp.list_sims` failed with `spawn xcrun ENOENT`, confirming this environment cannot list or run iOS simulators.
- `apps/mobile` currently has an Android native project but no generated `ios/` directory.

Fallback verification completed:

- Ran the gated live Supabase returning-user test with the verified Supabase test account. The password was supplied only through the local process environment and was not written to repository files.
- The live test passed and reverified:
  - Supabase password auth session,
  - wrapped MEK save/load through `vault_key_material` with RLS,
  - encrypted vault asset save/list through `vault_assets` with RLS,
  - sign-out/sign-in returning-user unlock,
  - KEK derivation from the entered password,
  - local MEK unwrap,
  - vault session hydration and decrypted asset assertion,
  - raw remote row check that plaintext asset title/contact data is not stored in the selected Supabase row.

Verification:

- `npm run test --workspace @vault/mobile -- returning-user-live-supabase` passes: 1 file, 1 test.
- `npm run test --workspace @vault/mobile` passes: 68 files passed, 1 skipped; 258 tests passed, 1 skipped.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on known Expo SDK transitive `postcss` and `uuid` advisories. The available force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Recommended next slice:

- Run iOS native dev-client verification from a macOS environment with Xcode installed, `xcrun` available, an iOS simulator bootable, and either a generated Expo `ios/` project or an EAS/local iOS dev-client build path.
- After iOS is green, move to biometric unlock verification against the native dev-client flow.

### 2026-06-01 - Android Biometric Unlock Verified In Native Dev Client

Changed:

- Added signed-in biometric unlock preferences to Settings so returning users can enable/disable biometric unlock after password sign-in.
- Added `createBiometricPreferenceService` to authenticate locally, read the stored MEK from SecureStore, cache the MEK for biometric unlock, and toggle the biometric enabled flag.
- Wired Settings to render the biometric preference control before sign-out.
- Fixed biometric cached-key unlock so it does not create an unauthenticated Supabase vault repository when no authenticated Supabase client is available.
- Fixed biometric unlock routing so a successful cached-key unlock routes to `/vault` instead of leaving the user on the welcome screen after cold start.

Android verification result:

- Booted the existing `Pixel_7` Android emulator.
- Launched the installed Sanduqkin Android dev client against local Metro.
- Signed in with the verified Supabase test account and confirmed the Vault screen showed `Your vault is ready.`
- Added a PIN and enrolled a test Pixel Imprint fingerprint in the emulator.
- Opened Settings and confirmed the new biometric unlock preference appeared.
- Enabled biometric unlock with the Android system prompt and emulator fingerprint event.
- Force-stopped and relaunched the app through the dev-client launcher.
- Confirmed the app showed `Sanduqkin is locked` on cold start.
- Unlocked with the emulator fingerprint event and confirmed the app routed to the Vault screen with `Your vault is ready.`
- The first biometric cold-start attempt exposed a bug: cached-key unlock tried to load `vault_assets` through an unauthenticated Supabase repository and showed `permission denied for table vault_assets`. The session repository handoff was fixed and the final Android run no longer showed that error.

Verification:

- Test-first red checks:
  - `biometric-preference-service` initially failed because the service did not exist.
  - `settings-screen` initially failed because Settings did not render the biometric preference control.
  - `vault-session-context` initially failed because cached-key unlock could still create a default Supabase client without an authenticated handoff.
  - `app-lock-overlay` initially failed because biometric unlock did not route to `/vault`.
- `npm run test --workspace @vault/mobile` passes: 71 files passed, 1 skipped; 264 tests passed, 1 skipped.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on known Expo SDK transitive `postcss` and `uuid` advisories. The available force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Recommended next slice:

- On Windows/Android: start Phase 1 durable audit persistence by wiring mobile sensitive-action audit events to Supabase `audit_events` through an encrypted/plain-metadata-safe repository with RLS.
- On macOS later: run iOS native dev-client verification for returning-user unlock and biometric unlock.

### 2026-06-01 - Durable Audit Persistence Boundary

Changed:

- Added `apps/mobile/src/features/auth/supabase-audit-event-repository.ts` for Supabase `audit_events` inserts.
- Added `apps/mobile/src/features/auth/durable-audit-log.ts` to attach an authenticated Supabase audit sink to the existing local `defaultAuditLog`.
- Updated `defaultAuditLog` so durable persistence is non-blocking and failures do not break auth/vault flows.
- Durable writes intentionally omit raw `userEmail`; local in-memory audit events can still hold and anonymize it.
- Added metadata guardrails so audit rows reject plaintext vault payload keys such as `title`, `fields`, and `notes`.
- Wired durable audit setup after successful password auth and biometric cold-start unlock.
- Added audit events for signed-in biometric enable/disable.
- Added and remotely applied Supabase migration `20260601085752_add_biometric_audit_event_types.sql` to allow the biometric audit event types.

Security notes:

- The Supabase database password was used only for CLI migration commands and was not written to repo files.
- Audit metadata remains limited to safe identifiers and event context; plaintext vault payloads must stay out of `audit_events`.
- `audit_events` remains RLS-protected with authenticated select/insert grants from the previous Phase 1 hardening.

Verification:

- Test-first red checks:
  - `supabase-audit-event-repository` initially failed because the module did not exist.
  - `audit-log` initially failed because durable forwarding did not exist and then exposed unhandled durable sink rejection behavior.
  - `durable-audit-log` initially failed because the configuration helper did not exist.
  - `durable-audit-wiring` initially failed because app auth/biometric paths were not wired.
- `npm run test --workspace @vault/mobile` passes: 74 files passed, 1 skipped; 274 tests passed, 1 skipped.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `supabase db push --linked --dry-run` showed only `20260601085752_add_biometric_audit_event_types.sql`.
- `supabase db push --linked` applied the migration remotely.
- `supabase migration list --linked` confirms local/remote migrations match through `20260601085752`.
- `npm audit --audit-level=moderate` still fails on known Expo SDK transitive `postcss` and `uuid` advisories. The available force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Recommended next slice:

- Run Android dev-client verification for durable audit persistence:
  - sign in,
  - unlock vault,
  - enable/disable biometric unlock,
  - create/update/delete a vault asset,
  - confirm `audit_events` rows appear with safe metadata only.
- Then add account deletion/server-side retention work or continue iOS verification on macOS.

### 2026-06-01 - Android Durable Audit Persistence Verified

Android verification result:

- Launched the Android dev client on the `Pixel_7` emulator against Metro on `http://10.0.2.2:8081`.
- User entered the verified Supabase test account credentials manually.
- Password sign-in reached the Vault screen with `Your vault is ready.`
- Queried Supabase `audit_events` through the authenticated client and confirmed durable rows for:
  - `sign_in_success`,
  - `vault_unlocked`,
  - `asset_created`,
  - `asset_soft_deleted`,
  - `asset_restored`,
  - `biometric_unlock_enabled`,
  - `biometric_unlock_disabled`.
- Created a bank-account test record from the Android UI, soft-deleted it, restored it, enabled biometric unlock, and disabled biometric unlock.
- Confirmed durable audit metadata stayed safe:
  - asset events only included `assetId` and, for create, `assetType`,
  - biometric/sign-in/unlock events used empty metadata,
  - `user_email_hash` remained null,
  - no plaintext title, institution name, last-four value, `fields`, or `notes` appeared in audit rows.

Notes:

- Clearing emulator-local app data was used only to get out of a stale biometric lock state and does not affect Supabase data.
- Android biometric prompt accepted the enrolled emulator fingerprint event.

Recommended next slice:

- Finish the server-only account deletion processor/API path that consumes `account_deletion_requests`.
- Add the confirmation email/notification placeholder.
- Document and enforce the 30-day deletion and 7-year anonymized audit retention policy.
- Run iOS native dev-client verification when a macOS/Xcode machine is available.

### 2026-06-01 - Account Deletion Request Queue

Changed:

- Added `public.account_deletion_requests` with RLS, authenticated `select/insert`, no anon/public table access, a one-open-request-per-user unique index, and a default 30-day `scheduled_for` timestamp.
- Added `createSupabaseAccountDeletionRequestRepository` so mobile can queue a deletion request through the authenticated Supabase client without service-role access.
- Updated account deletion flow to save the server-side deletion request before local vault lock/clear, RevenueCat logout, local audit anonymization, and navigation.
- Added tests for repository insert shape/errors, service sequencing, and schema/RLS guardrails.

Verification:

- Remote migration `20260601140548_add_account_deletion_requests.sql` applied with `supabase db push --linked`.
- `supabase migration list --linked` shows local/remote match through `20260601140548`.
- Live Supabase REST verification passed:
  - anonymous read of `account_deletion_requests` is denied,
  - authenticated test-account read succeeds,
  - no real deletion request was inserted during verification.
- `npm run test --workspace @vault/mobile` passes: 75 files passed, 1 skipped; 278 tests passed, 1 skipped.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.
- `supabase db dump` was not usable on this Windows machine because Docker Desktop is not running; REST/client verification was used instead.

Remaining account-deletion work:

- Decide whether deletion requests should trigger email confirmation before processing.
- Deploy and schedule the server-only processor/API path.
- Decide whether hard delete is required later; current processor uses Supabase Auth soft-delete.
- Formalize retention behavior for anonymized audit rows.

### 2026-06-01 - Server-Side Account Deletion Processor

Changed:

- Added `services/api/src/account-deletion/processor.ts` to process due `account_deletion_requests`.
- Added `services/api/src/account-deletion/supabase-processor-client.ts` with a Supabase service-role adapter for server-only use.
- Added protected Hono route `POST /internal/account-deletion/process`.
- Route requires `ACCOUNT_DELETION_PROCESSOR_TOKEN`; processor config requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Processor selects pending due requests, marks them `processing`, calls Supabase Auth Admin `deleteUser(userId, true)` for soft delete, then marks requests `completed`.
- Failed Auth deletion marks the request `failed` and stores `last_error`.
- Added migration `20260601141825_add_account_deletion_processing_state.sql` for `failed`, `attempt_count`, and `last_error`.
- Added API Vitest coverage for processor success/failure and route authorization.

Verification:

- Remote migration `20260601141825_add_account_deletion_processing_state.sql` applied with `supabase db push --linked`.
- `supabase migration list --linked` shows local/remote match through `20260601141825`.
- Live Supabase REST verification confirmed authenticated reads can select `attempt_count` and `last_error`.
- `npm run test --workspace @vault/api` passes: 2 files, 4 tests.
- `npm run typecheck --workspace @vault/api` passes.
- `npm run test --workspace @vault/mobile` passes: 75 files passed, 1 skipped; 279 tests passed, 1 skipped.
- `npm run typecheck` passes.
- `npx expo-doctor` passes: 17/17 checks.

Remaining account-deletion work:

- Deploy the API service and configure the internal processor token/service-role env vars in the deployment platform only.
- Add a scheduler/cron invocation for `POST /internal/account-deletion/process`.
- Decide and document confirmation-email behavior before the 30-day scheduled deletion date.
- Add an operational retention policy for anonymized audit rows.

### 2026-06-02 - Account Deletion Scheduler And Retention Boundary

Changed:

- Added a GitHub Actions scheduler wrapper at `.github/workflows/account-deletion-processor.yml`.
- Scheduler supports daily cron and manual dispatch.
- Scheduler calls only the protected deployed API endpoint with `ACCOUNT_DELETION_PROCESSOR_URL` and `ACCOUNT_DELETION_PROCESSOR_TOKEN` repository secrets.
- Kept Supabase service-role credentials confined to the API deployment environment; the workflow does not need or accept the service-role key.
- Updated the account deletion processor so due requests explicitly delete `vault_assets` and `vault_key_material` rows before Supabase Auth soft-delete.
- Updated the processor to anonymize durable `audit_events` rows by setting `user_id = null` before Auth soft-delete, preserving audit history without retaining direct user linkage.
- Added adapter coverage for the Supabase service-role query contract.
- Added `docs/account-deletion-operations.md` documenting deployment env vars, scheduler secrets, 30-day deletion scheduling, confirmation-email status, and the seven-year anonymized audit retention target.
- Added `services/api/api/index.ts` and `services/api/vercel.json` so the Hono API deploys from the API workspace as an ESM-compatible Vercel serverless app.
- Deployed the API to Vercel production at `https://sanduqkin-api.vercel.app`.
- Configured Vercel production env vars for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ACCOUNT_DELETION_PROCESSOR_TOKEN`.
- Configured GitHub repository secrets `ACCOUNT_DELETION_PROCESSOR_URL` and `ACCOUNT_DELETION_PROCESSOR_TOKEN`.
- Rotated the processor token after live deployment and updated both Vercel and GitHub secrets to the same value.

Verification:

- `npm run test --workspace @vault/api` passes: 3 files, 6 tests.
- `npm run typecheck --workspace @vault/api` passes.
- Live `GET https://sanduqkin-api.vercel.app/health` returns `{"ok":true,"service":"sanduqkin-api"}`.
- Live unauthenticated `POST https://sanduqkin-api.vercel.app/internal/account-deletion/process` returns `401`.
- Live authenticated `POST https://sanduqkin-api.vercel.app/internal/account-deletion/process` returns `{"ok":true,"completed":0,"failed":0,"selected":0}`.
- Pushed `.github/workflows/account-deletion-processor.yml` to `origin/main`.
- Manually dispatched GitHub Actions run `26820934107`; it completed successfully and the workflow log shows the protected processor endpoint returned `{"ok":true,"completed":0,"failed":0,"selected":0}` with secrets masked.
- `npm run typecheck` passes across all workspaces.
- `npm run test --workspace @vault/mobile` passes: 75 files passed, 1 skipped; 279 tests passed, 1 skipped.
- `npx expo-doctor` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK transitive `postcss` and `uuid` advisories. The available force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Remaining account-deletion work:

- Add production transactional confirmation email when a deletion request is queued.
- Add a separate retention job for seven-year anonymized audit row expiry when production retention automation is introduced.

### 2026-06-02 - Account Deletion Confirmation Email Boundary

Changed:

- Added `POST /account-deletion/request` to the deployed API.
- The new endpoint validates a Supabase bearer session, creates the `account_deletion_requests` row server-side with service-role credentials, and sends a transactional confirmation email with the scheduled deletion date.
- Added a Resend-backed transactional sender using server-only `RESEND_API_KEY`.
- Added mobile `EXPO_PUBLIC_API_URL` config via `getApiEnv`.
- Replaced the mobile account-deletion screen's direct Supabase insert with an API-backed request repository so confirmation email remains server-side.
- Updated `.env.example` with `EXPO_PUBLIC_API_URL=https://sanduqkin-api.vercel.app`.
- Updated `docs/account-deletion-operations.md` with required Vercel email env vars and mobile API config.
- Configured Vercel production env vars `ACCOUNT_DELETION_APP_BASE_URL` and `ACCOUNT_DELETION_EMAIL_FROM`.
- Deployed the updated API to Vercel production.

Verification:

- Test-first red checks:
  - `request-route` initially failed because the API route module did not exist.
  - `api-account-deletion-request-repository` initially failed because the mobile API repository did not exist.
  - `api-env` initially failed because the mobile API env helper did not exist.
  - `account-deletion-api-wiring` initially failed because the mobile screen still used direct Supabase inserts.
  - route-order coverage initially failed because unauthenticated requests saw `503` before `401`.
- `npm run test --workspace @vault/api` passes: 4 files, 9 tests.
- `npm run typecheck` passes across all workspaces.
- `npm run test --workspace @vault/mobile` passes: 78 files passed, 1 skipped; 283 tests passed, 1 skipped.
- `npx expo-doctor` passes: 17/17 checks.
- Live `GET https://sanduqkin-api.vercel.app/health` returns `{"ok":true,"service":"sanduqkin-api"}`.
- Live unauthenticated `POST https://sanduqkin-api.vercel.app/account-deletion/request` returns `401`.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK transitive `postcss` and `uuid` advisories. The available force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Remaining account-deletion work:

- Configure Vercel production `RESEND_API_KEY` with a real Resend key.
- Verify `ACCOUNT_DELETION_EMAIL_FROM` is a Resend-verified sender/domain. Current configured sender is `Sanduqkin <support@sanduqkin.com>`.
- Live-verify authenticated `POST /account-deletion/request` using a test account after `RESEND_API_KEY` is configured.
- Add a separate retention job for seven-year anonymized audit row expiry when production retention automation is introduced.

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

## Next Session Opener

Use this opener to resume cleanly:

```text
Partner, read HANDOFF.md first. We finished Android native dev-client verification for returning-user unlock, biometric cached-key unlock, durable audit persistence, and account-deletion queue/processor hardening. Android supports signed-in biometric enable/disable from Settings, cached-key unlock avoids unauthenticated Supabase vault repository calls, and cold-start biometric unlock routes to the Vault screen with `Your vault is ready.` Durable audit persistence is wired to Supabase `audit_events` with plaintext vault metadata guards. Account deletion now queues through the deployed API at `POST /account-deletion/request`, which validates the Supabase bearer session, creates the deletion request server-side, and sends a confirmation email through Resend when `RESEND_API_KEY` is configured. The processor explicitly deletes `vault_assets` and `vault_key_material`, anonymizes retained audit rows, then soft-deletes due Supabase Auth users with service-role credentials outside mobile. The API is deployed to Vercel production at `https://sanduqkin-api.vercel.app`; health, unauthorized processor rejection, authenticated processor invocation, manual GitHub scheduler dispatch, and unauthenticated deletion-request rejection are live-verified. Migrations through `20260601141825_add_account_deletion_processing_state.sql` are applied remotely and live RLS/column verification passed. On 2026-06-01, iOS native dev-build verification was attempted but blocked because this Windows environment has no Xcode/xcrun/iOS simulator. MFA remains intentionally on hold until launch because it is a paid Supabase feature.

Start the next Windows/Android slice: configure Vercel `RESEND_API_KEY`, verify the sender/domain in Resend, and live-verify authenticated `POST /account-deletion/request`; or add seven-year anonymized audit expiry automation. If working on a Mac instead, run iOS native dev-client verification for returning-user unlock and biometric unlock.
```

Current next-slice checklist:

- Continue account deletion/server-side retention hardening:
  - configure `RESEND_API_KEY` and live-verify confirmation email,
  - seven-year anonymized audit expiry automation.
- Run closeout checks:
  - `npm run test --workspace @vault/mobile`,
  - `npm run typecheck --workspace @vault/mobile`,
  - `npx expo-doctor` from `apps/mobile`,
  - `npm audit --audit-level=moderate` from repo root.
- Update this handoff with deployment/scheduler or retention status.

iOS later checklist:

- Switch to or provision a macOS/Xcode-capable environment with `xcrun` and an available iOS simulator.
- Generate or use the iOS Expo native/dev-client build path as needed.
- Build/run the iOS Expo development client with native `react-native-libsodium`.
- Start Metro from `apps/mobile` with root `.env` values loaded into the process.
- Run returning-user sign-in and biometric unlock with the verified Supabase account.
- Confirm iOS reaches the Vault screen and logs show no native crypto/session/Supabase errors.

## Product Data Categories And Vault Model

Purpose:

- The app helps a user create an encrypted inventory of important accounts, assets, documents, contacts, and instructions.
- The kin experience should help authorized kin locate the right institution, document, or person when something happens to the user.
- The product should avoid asking for full sensitive identifiers by default. Prefer provider name, country, location, contact details, and optional last 4 digits.

Important architecture decision:

- Do not create plaintext Supabase tables for each category unless explicitly approved later.
- Keep the zero-knowledge vault model:
  - Supabase stores `vault_assets.asset_type`,
  - Supabase stores encrypted `ciphertext` and `nonce`,
  - structured category fields live inside the encrypted JSON payload,
  - only low-risk routing metadata such as `asset_type`, timestamps, and deletion state remains queryable.
- Category-specific work should usually mean:
  - add/update mobile form schema,
  - add/update local validation/view-model,
  - add/update encrypted payload tests,
  - extend the `asset_type` enum/check constraint if a new category is introduced,
  - keep plaintext out of Supabase columns.

Recommended MVP category list:

1. `bank_account`
   - Bank name, country, branch/city/address, account type, optional last 4 digits, optional full account number only behind explicit sensitive-data confirmation, contact phone/website, notes.
2. `card`
   - Issuer/bank, card type, country, last 4 digits, support phone, optional autopay source, notes.
3. `property`
   - Property type, address/country, ownership type, mortgage lender if any, property manager/agent, location of title deed/documents, notes.
4. `vehicle`
   - Vehicle type, make/model, registration plate, country/state, insurance provider, finance provider if any, location of documents/spare keys.
5. `insurance`
   - Insurance type, provider, policy nickname/reference, optional last 4 of policy number, beneficiary if relevant, claims contact, renewal date, document location.
6. `investment`
   - Platform/broker, country, account type, optional last 4/reference, advisor contact, notes.
7. `pension`
   - Provider/employer, country, pension type, optional member/reference last 4, beneficiary info, contact details, notes.
8. `crypto`
   - Exchange or wallet name, asset type, custody type, location of recovery instructions. Do not encourage storing seed phrases/private keys by default.
9. `loan_debt`
   - Lender, debt type, optional last 4/reference, payment amount/range, autopay source, contact details.
10. `subscription`
   - Provider, bill type, billing frequency, payment card/bank last 4, cancel/transfer instructions, notes.
11. `document_location`
   - Document type, country, storage location, expiry date if relevant, person/institution holding it.
12. `contact`
   - Professional or trusted contact: lawyer, accountant, financial advisor, insurance broker, property agent, doctor, business partner, emergency trusted person.
13. `medical_care`
   - Conditions/allergies, medications, doctor/clinic, health insurance, emergency preferences, care instructions for dependents.
14. `dependent_pet`
   - Children/dependents/pets, school/caregiver/vet contacts, care instructions, access/location notes.
15. `business_interest`
   - Company name, role/ownership percentage, registration country, accountant/lawyer/contact, bank/provider names, continuity instructions.
16. `digital_account`
   - Primary email, password manager name, cloud storage, phone/SIM provider, social media, important online services, legacy contact or close/preserve instructions. Do not store passwords by default.
17. `other`
   - Flexible fallback for important information not covered above.

Current implementation gap:

- Current Supabase `vault_assets.asset_type` check constraint and mobile `AssetType` enum already include:
  - `bank_account`,
  - `investment`,
  - `property`,
  - `insurance`,
  - `crypto`,
  - `pension`,
  - `subscription`,
  - `document_location`,
  - `contact`,
  - `other`.
- The recommended MVP list adds these missing categories:
  - `card`,
  - `vehicle`,
  - `loan_debt`,
  - `medical_care`,
  - `dependent_pet`,
  - `business_interest`,
  - `digital_account`.
- Adding those requires a Supabase migration to update the `asset_type` check constraint and matching mobile schema/tests.

Sensitive-field UX rule:

- Default to minimal identifiers: name, country, location, provider, contact, document location, and last 4 digits.
- Full account numbers, policy numbers, seed phrases, passwords, PINs, MFA backup codes, and private keys should not be encouraged.
- If full sensitive values are allowed, the UI must require an explicit warning/confirmation and store them only inside the encrypted payload.

Future kin-access decision:

- The existing vault is user-encrypted and cannot be decrypted by Supabase alone.
- Before kin access can work, the product needs a key-release design, for example:
  - user pre-authorizes kin and wraps the MEK for the kin/public key,
  - or stores a recovery/key share released after a verified claim workflow,
  - or uses another explicit emergency-access mechanism.
- Do not build a kin-request flow that implies Supabase/admins can decrypt existing vault data unless the cryptographic key-release design exists and is documented.
