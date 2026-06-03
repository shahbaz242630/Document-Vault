# Sanduqkin Project Handoff

## Current Status

Sanduqkin is still in **Phase 1 foundation / integration hardening**.

Do **not** move to Phase 2 beneficiary/activation work yet. Do **not** continue Phase 3 payments work until the remaining Phase 1 verification and production hardening items below are closed.

The codebase now has verified Phase 1 Supabase persistence, wrapped MEK returning-user unlock, Android native-dev-client biometric unlock, durable audit persistence, and server-side account-deletion/retention foundations. Phase 1 is still not green because real Supabase MFA is launch-deferred, iOS native verification is blocked in this Windows environment, Resend confirmation email live verification depends on account approval, the Phase 1 guard still reports function-size debt, and Expo SDK transitive audit advisories remain unresolved.

## Source Of Truth

- BRD: `Vault_BRD_v1.0.md`
- BRD version shown in file: 1.1
- Active scope: Phase 1 - Core Single-User Vault
- App/product name: Sanduqkin
- Domain: `sanduqkin`
- Repository root: `C:\Projects\GitHub\Sandoq Kin`
- Current date of this handoff refresh: 2026-06-03

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
- Backend currently exposes:
  - `GET /health`
  - `POST /webhooks/revenuecat`
  - `POST /account-deletion/request`
  - `POST /internal/account-deletion/process`
  - `POST /internal/audit-retention/process`

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

### P0 - Real Supabase MFA Is Launch-Deferred

Supabase MFA is intentionally on hold until launch because it is a paid feature. During development, password sign-in proceeds to persisted vault unlock rather than the placeholder TOTP route.

Impact:

- Mandatory 2FA cannot be considered enforced for production until Supabase MFA is enabled.
- Re-auth before deletion is not production-valid while placeholder factor ids remain.

Current placeholders:

- TOTP enrollment route links with `factorId=placeholder-factor-id`.
- Re-auth uses `placeholder-factor-id`.

Required launch work:

- Wire Supabase MFA enrollment result into UI.
- Render/store the real factor id for verification.
- Fetch/list enrolled factors for returning sign-in.
- Enforce AAL/session checks before vault access.
- Remove all placeholder factor ids.

### P0 - iOS Native Verification Is Blocked Locally

Impact:

- Android native-dev-client returning-user unlock, biometric cached-key unlock, durable audit persistence, and account-deletion queue/processor hardening have been verified.
- iOS native dev-build verification was attempted on 2026-06-01 and blocked because this Windows environment has no Xcode, `xcrun`, or iOS simulator.

Required next work:

- Run the iOS native/dev-client returning-user and biometric unlock journeys from a macOS/Xcode-capable environment.
- Confirm iOS reaches the Vault screen and logs show no native crypto/session/Supabase errors.

### P1 - Password Reset / Recovery MEK Rotation Is Not Complete

Current issues:

- KEK/MEK wrapping is now saved during recovery phrase confirmation when Supabase is configured.
- Returning-user password sign-in now loads wrapped MEK, derives KEK, unwraps MEK, stores it locally, initializes the vault session, and loads persisted encrypted asset records.
- Live Supabase returning-user verification has passed.
- Password reset/recovery still does not safely rotate or re-wrap persisted MEK key material.

Impact:

- Password reset/recovery cannot safely restore a persisted vault yet.

Required next work:

- Integrate password reset/recovery with wrapped MEK update flows.

### P1 - Account Deletion Confirmation Email Is Externally Blocked

Current behavior:

- Account deletion queues through the deployed API at `POST /account-deletion/request`.
- The API validates the Supabase bearer session and creates the deletion request server-side.
- The processor explicitly deletes `vault_assets` and `vault_key_material`, anonymizes retained audit rows, then soft-deletes due Supabase Auth users with service-role credentials outside mobile.
- Seven-year anonymized audit retention automation is implemented and live-verified via `POST /internal/audit-retention/process`.

Remaining blocker:

- Resend account approval is pending, so production account-deletion confirmation email cannot be live-verified yet.

Required next work:

- After Resend approval, configure Vercel production `RESEND_API_KEY`, verify sender/domain status, and live-verify authenticated `POST /account-deletion/request` sends the confirmation email.

### P1 - Tests / Tooling Baseline

Most recent verification results:

- Latest full mobile suite in the slice log: `npm run test --workspace @vault/mobile` passes: 78 files passed, 1 skipped; 283 tests passed, 1 skipped.
- Latest focused mobile slice: `npm run test --workspace @vault/mobile -- vault-session-context.test.ts vault-session.test.ts` passes: 2 files, 11 tests.
- `npm run typecheck --workspace @vault/mobile` passed in the latest refactor slices; full `npm run typecheck` also passed in the account-deletion/API slices.
- `npx expo-doctor` passes: 17/17 checks.
- `npm run check:phase1` currently fails only on 16 existing function-line-limit violations; no production launch markers or files over 500 lines are reported.
- `npm audit --audit-level=moderate` still fails with 17 moderate vulnerabilities.

Audit details:

- Remaining advisories are Expo SDK 54 transitive tooling dependencies:
  - `postcss <8.5.10` under `@expo/metro-config`.
  - `uuid <11.1.1` under `xcode`.
- `npm audit fix` cannot resolve cleanly in this workspace.
- `npm audit fix --force` proposes installing `expo@56.0.8`, a breaking SDK-family upgrade. Do not take that as part of Phase 1 hardening without an explicit Expo upgrade slice.
- A previous targeted root `@expo/metro-config.postcss` override remains in `package.json`, but npm currently still resolves the nested vulnerable `postcss@8.4.49` under `@expo/metro-config`.

### P1 - RevenueCat Webhook Is Acknowledgement-Only

`services/api/src/webhooks/revenuecat.ts` now validates and acknowledges RevenueCat webhook events without syncing entitlements during Phase 1.

This keeps the existing payment foundation contained while Phase 1 vault integration remains the priority. Do not gate Phase 1 vault behavior behind subscriptions.

### P1 - Phase Drift

RevenueCat/paywall/customer-center work exists even though the BRD says Phase 1 payments are out of scope and Phase 1 must be complete before moving forward.

Recommendation:

- Treat the current RevenueCat work as a contained payment foundation only.
- Do not gate Phase 1 vault functionality behind subscriptions until Phase 1 integration DoD is green.
- Return to Phase 1 integration hardening.

## Phase 1 DoD Status

Current assessment against BRD Section 7.4:

- New user can sign up, complete real 2FA, save recovery phrase, and reach dashboard on iOS/Android: **not met because real MFA is launch-deferred and iOS native verification is blocked locally**
- User can add one asset of each 10 categories: **implemented and covered locally; Android/live Supabase returning-user path verified**
- User can edit and delete assets: **implemented with encrypted Supabase repository; device coverage still needs final closeout**
- User can log out, kill app, reopen, and log back in including biometric: **Android verified; iOS pending macOS/Xcode verification**
- User can delete account: **partially met with server-side request queue plus local clear**
- Vault content encrypted client-side and database contains ciphertext only: **implemented and live Supabase returning-user path verified; continue guarding plaintext metadata**
- Audit logging works for sensitive actions: **durable Supabase persistence wired with plaintext metadata guards; continue expanding event/device metadata as needed**
- Auto-logout works: **partially met**
- Background privacy screen works: **implemented, needs final device closeout verification**
- Failed-login lockout works: **implemented in memory, needs persistence review**
- Tests pass for crypto/auth/CRUD: **mobile and API tests have passed in recent slices; rerun closeout checks before claiming completion**
- Manual physical iOS and Android journey test: **Android native-dev-client verified; iOS blocked in this Windows environment**
- No TODO comments in production paths: **automated guard added; current failures are function-size only**
- Folder structure matches Section 2.5: **partially met**
- No file over 500 lines, no function over 100 lines: **not met; automated guard finds 16 functions over 100 lines and no files over 500 lines**

## Recommended Next Stage

Work in this order:

1. Close externally/environment-blocked verification:
   - After Resend approval, configure `RESEND_API_KEY` and live-verify account-deletion confirmation email.
   - From a macOS/Xcode-capable environment, run iOS native-dev-client returning-user unlock and biometric unlock.

2. Wire real Supabase MFA when launch budget/features allow it:
   - Enrollment QR/factor id.
   - Verification.
   - Returning-user factor retrieval.
   - AAL/session gating.
   - Re-auth before deletion.

3. Finish password reset / recovery key lifecycle:
   - Re-wrap persisted MEK/key material when password reset succeeds.
   - Verify reset/recovery cannot orphan an encrypted vault.

4. Resolve remaining SDK audit advisories:
   - Either wait for an SDK 54-compatible Expo patch that updates the transitive packages or plan an explicit Expo SDK upgrade slice.
   - Do not apply `npm audit fix --force` casually; it proposes a breaking Expo 56 upgrade.

5. Reduce Phase 1 guard debt:
   - Continue splitting the 16 functions/components over the BRD 100-line function limit.
   - Keep `npm run check:phase1` as the closeout gate.

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
- Updated the Vercel project `sanduqkin-api` root directory to `services/api` through the Vercel API so future Git deployments do not build from the monorepo root and break the API alias.

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
- `npx vercel@latest project inspect sanduqkin-api` shows `Root Directory services/api`.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK transitive `postcss` and `uuid` advisories. The available force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Remaining account-deletion work:

- Resend account is pending approval. Confirmation-email live verification is blocked until approval is complete.
- After Resend approval, configure Vercel production `RESEND_API_KEY` with a real Resend key.
- Verify `ACCOUNT_DELETION_EMAIL_FROM` is a Resend-verified sender/domain. Current configured sender is `Sanduqkin <support@sanduqkin.com>`.
- Live-verify authenticated `POST /account-deletion/request` using a test account after `RESEND_API_KEY` is configured.

### 2026-06-02 - Seven-Year Anonymized Audit Retention Automation

Changed:

- Added `services/api/src/audit-retention/processor.ts` to compute a seven-year retention cutoff.
- Added Supabase service-role retention client that deletes only `audit_events` rows where `user_id is null` and `occurred_at` is older than seven years.
- Added protected API route `POST /internal/audit-retention/process`.
- Route requires `AUDIT_RETENTION_PROCESSOR_TOKEN`; processor config also requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Added `.github/workflows/audit-retention-processor.yml` for daily/manual retention processing.
- Configured Vercel production `AUDIT_RETENTION_PROCESSOR_TOKEN`.
- Configured GitHub repository secrets `AUDIT_RETENTION_PROCESSOR_URL` and `AUDIT_RETENTION_PROCESSOR_TOKEN`.
- Deployed the updated API to Vercel production.
- Updated `docs/account-deletion-operations.md` with audit retention endpoint, scheduler, and eligibility rules.

Verification:

- Test-first red checks:
  - `audit-retention/processor` initially failed because the module did not exist.
  - `audit-retention/supabase-retention-client` initially failed because the adapter did not exist.
  - `audit-retention/routes` initially failed because the protected route did not exist.
- `npm run test --workspace @vault/api` passes: 7 files, 13 tests.
- `npm run typecheck` passes across all workspaces.
- `npm run test --workspace @vault/mobile` passes: 78 files passed, 1 skipped; 283 tests passed, 1 skipped.
- `npx expo-doctor` passes: 17/17 checks.
- Live `GET https://sanduqkin-api.vercel.app/health` returns `{"ok":true,"service":"sanduqkin-api"}`.
- Live unauthenticated `POST https://sanduqkin-api.vercel.app/internal/audit-retention/process` returns `401`.
- Manually dispatched GitHub Actions run `26824120201`; it completed successfully and the workflow log shows the protected retention endpoint returned `{"ok":true,"deleted":0}` with secrets masked.
- `npx vercel@latest project inspect sanduqkin-api` shows `Root Directory services/api`.
- `npm audit --audit-level=moderate` still fails on the known Expo SDK transitive `postcss` and `uuid` advisories. The available force fix still jumps to `expo@56.0.8`, so no force fix was applied.

Remaining account-deletion work:

- Resend account is pending approval. Confirmation-email live verification is blocked until approval is complete.
- After Resend approval, configure Vercel production `RESEND_API_KEY` with a real Resend key.
- Verify `ACCOUNT_DELETION_EMAIL_FROM` is a Resend-verified sender/domain. Current configured sender is `Sanduqkin <support@sanduqkin.com>`.
- Live-verify authenticated `POST /account-deletion/request` using a test account after `RESEND_API_KEY` is configured.

### 2026-06-03 - RevenueCat Webhook Phase 1 Cleanup

Changed:

- Removed the production-path TODO from `services/api/src/webhooks/revenuecat.ts`.
- Refactored the RevenueCat webhook into `createRevenueCatWebhookHandler` for dependency-injected tests while keeping `revenueCatWebhookHandler` as the app route handler.
- Defined Phase 1 webhook behavior as validated acknowledgement only.
- Valid webhook events now return `{ "ok": true, "entitlementSync": "deferred_phase_1" }`.
- Added `docs/revenuecat-operations.md` documenting that entitlement persistence is intentionally deferred and Phase 1 vault access must not be subscription-gated.

Verification:

- Test-first red check:
  - `webhooks/revenuecat` initially failed because the webhook was not injectable and valid events did not return the deferred entitlement-sync marker.
- `npm run test --workspace @vault/api -- webhooks/revenuecat.test.ts` passes: 1 file, 3 tests.
- `npm run test --workspace @vault/api` passes: 8 files, 16 tests.
- `npm run typecheck --workspace @vault/api` passes.
- `rg -n "TODO|FIXME|XXX" services apps packages docs HANDOFF.md` now shows only historical handoff references until this handoff refresh removes them; no production code TODO remains.
- Production health is reachable at `https://sanduqkin-api.vercel.app/health`.
- Production `POST /webhooks/revenuecat` currently returns 503 because `REVENUECAT_WEBHOOK_SECRET` is not configured in Vercel yet.

Remaining RevenueCat work:

- Keep RevenueCat as payment foundation only until Phase 1 DoD is green.
- When payment scope resumes, add idempotent entitlement persistence with retry/event-order handling before using webhooks to affect product access.

### 2026-06-03 - Phase 1 DoD Guard

Changed:

- Added `npm run check:phase1` as a repeatable guard for BRD Phase 1 production-source hygiene.
- The guard scans `apps`, `services`, `packages`, and `scripts` source files.
- It fails on production launch markers, files over 500 lines, and function bodies over 100 lines.
- It ignores test files and documentation so historical handoff notes do not block production hygiene.

Verification:

- Test-first red check:
  - `node --test scripts/phase1-dod-check.test.cjs` initially failed because `scripts/phase1-dod-check.cjs` did not exist.
- `node --test scripts/phase1-dod-check.test.cjs` passes: 2 tests.
- `npm run check:phase1` now runs and fails only on existing `function-line-limit` violations.
- Current scan result: no production launch markers, no production source files over 500 lines, 24 production functions/components over 100 lines.

Recommended next refactor targets:

- Start with the largest Phase 1-auth files before vault/payment foundation files:
  - `apps/mobile/src/features/vault/components/dynamic-asset-form.tsx`
  - `apps/mobile/src/features/vault/components/recently-deleted-list.tsx`

### 2026-06-03 - Reset Password Panel Size Refactor

Changed:

- Split `apps/mobile/src/features/auth/components/reset-password-panel.tsx` into smaller local components and submit helpers.
- Kept the public `ResetPasswordPanel` export and route usage unchanged.
- Added a focused guard test proving `reset-password-panel.tsx` no longer violates the BRD 100-line function limit.

Verification:

- Test-first red check:
  - `node --test scripts/phase1-dod-check.test.cjs` failed because `reset-password-panel.tsx` was still reported by `function-line-limit`.
- `node --test scripts/phase1-dod-check.test.cjs` passes: 3 tests.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run check:phase1` still fails on existing function-size debt, but `reset-password-panel.tsx` is no longer in the report.
- Current scan result: no production launch markers, no production source files over 500 lines, 23 production functions/components over 100 lines.

### 2026-06-03 - Email Password Auth Form Size Refactor

Changed:

- Split `apps/mobile/src/features/auth/components/email-password-auth-form.tsx` into smaller local components and auth-flow helpers.
- Preserved the signed-in Supabase client handoff for returning-user vault unlock.
- Added a focused guard test proving `email-password-auth-form.tsx` no longer violates the BRD 100-line function limit.

Verification:

- Test-first red check:
  - `node --test scripts/phase1-dod-check.test.cjs` failed because `email-password-auth-form.tsx` was still reported by `function-line-limit`.
- `node --test scripts/phase1-dod-check.test.cjs` passes: 4 tests.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run test --workspace @vault/mobile -- email-password-auth-form.test.ts durable-audit-wiring.test.ts` passes: 2 files, 4 tests.
- `npm run check:phase1` still fails on existing function-size debt, but `email-password-auth-form.tsx` is no longer in the report.
- Current scan result: no production launch markers, no production source files over 500 lines, 21 production functions/components over 100 lines.

Operational note:

- GitHub pushes currently auto-trigger Vercel production deployments for `sanduqkin-api`; continue checking `npx vercel ls sanduqkin-api` after pushes and verify the newest deployment reaches `Ready`.

### 2026-06-03 - Forgot Password Panel Size Refactor

Changed:

- Split `apps/mobile/src/features/auth/components/forgot-password-panel.tsx` into smaller local components and a submit helper.
- Kept the public `ForgotPasswordPanel` export and route usage unchanged.
- Added a focused guard test proving `forgot-password-panel.tsx` no longer violates the BRD 100-line function limit.

Verification:

- Test-first red check:
  - `node --test scripts/phase1-dod-check.test.cjs` failed because `forgot-password-panel.tsx` was still reported by `function-line-limit`.
- `node --test scripts/phase1-dod-check.test.cjs` passes: 5 tests.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run test --workspace @vault/mobile -- forgot-password-view-model.test.ts` passes: 1 file, 1 test.
- `npm run check:phase1` still fails on existing function-size debt, but `forgot-password-panel.tsx` is no longer in the report.
- Current scan result: no production launch markers, no production source files over 500 lines, 20 production functions/components over 100 lines.

### 2026-06-03 - Re-Auth Panel Size Refactor

Changed:

- Split `apps/mobile/src/features/auth/components/re-auth-panel.tsx` into smaller local components and submit helpers.
- Kept the public `ReAuthPanel` export and route usage unchanged.
- Added a focused guard test proving `re-auth-panel.tsx` no longer violates the BRD 100-line function limit.

Verification:

- Test-first red check:
  - `node --test scripts/phase1-dod-check.test.cjs` failed because `re-auth-panel.tsx` was still reported by `function-line-limit`.
- `node --test scripts/phase1-dod-check.test.cjs` passes: 6 tests.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run test --workspace @vault/mobile -- re-auth-view-model.test.ts` passes: 1 file, 1 test.
- `npm run check:phase1` still fails on existing function-size debt, but `re-auth-panel.tsx` is no longer in the report.
- Current scan result: no production launch markers, no production source files over 500 lines, 19 production functions/components over 100 lines.

### 2026-06-03 - Edit Asset Config Size Refactor

Changed:

- Split `apps/mobile/src/features/vault/edit-asset-config.ts` into a short public dispatcher plus `edit-asset-config-builders.ts`.
- Kept the public `getEditAssetConfig(assetType)` API unchanged.
- Added a focused guard test proving `edit-asset-config.ts` no longer violates the BRD 100-line function limit.

Verification:

- Test-first red check:
  - `node --test scripts/phase1-dod-check.test.cjs` failed because `edit-asset-config.ts` was still reported by `function-line-limit`.
- `node --test scripts/phase1-dod-check.test.cjs` passes: 7 tests.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run test --workspace @vault/mobile -- asset-payload.test.ts bank-account-form.test.ts investment-form.test.ts property-form.test.ts insurance-form.test.ts crypto-form.test.ts pension-form.test.ts subscription-form.test.ts document-location-form.test.ts contact-form.test.ts other-form.test.ts` passes: 11 files, 33 tests.
- `npm run check:phase1` still fails on existing function-size debt, but `edit-asset-config.ts` is no longer in the report.
- Current scan result: no production launch markers, no production source files over 500 lines, 18 production functions/components over 100 lines.

### 2026-06-03 - Vault Session Context Size Refactor

Changed:

- Split `apps/mobile/src/features/vault/vault-session-context.tsx` into smaller provider state, lifecycle, and asset-action hooks.
- Kept the public `VaultSessionProvider` and `useVaultSession` exports unchanged.
- Preserved the authenticated Supabase client handoff for persisted asset loading.
- Added a focused guard test proving `vault-session-context.tsx` no longer violates the BRD 100-line function limit.

Verification:

- Test-first red check:
  - `node --test scripts/phase1-dod-check.test.cjs` failed because `vault-session-context.tsx` was still reported by `function-line-limit`.
- `node --test scripts/phase1-dod-check.test.cjs` passes: 8 tests.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run test --workspace @vault/mobile -- vault-session-context.test.ts vault-session.test.ts` passes: 2 files, 11 tests.
- `npm run check:phase1` still fails on existing function-size debt, but `vault-session-context.tsx` is no longer in the report.
- Current scan result: no production launch markers, no production source files over 500 lines, 17 production functions/components over 100 lines.

### 2026-06-03 - Profile Basics Panel Size Refactor

Changed:

- Split `apps/mobile/src/features/auth/components/profile-basics-panel.tsx` into smaller local header, fields, submit button, and submit-flow helpers.
- Kept the public `ProfileBasicsPanel` export and signup progress behavior unchanged.
- Preserved validation through `createProfileBasics`, signup progress persistence, and routing to `/auth/setup-totp`.

Verification:

- Test-first red check:
  - `npm run check:phase1` failed because `profile-basics-panel.tsx` was still reported by `function-line-limit`.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run test --workspace @vault/mobile -- profile-basics` passes: 2 files, 5 tests.
- `npm run check:phase1` still fails on existing function-size debt, but `profile-basics-panel.tsx` is no longer in the report.
- Current scan result: no production launch markers, no production source files over 500 lines, 16 production functions/components over 100 lines.

### 2026-06-03 - Android Debug Build Verification

Changed:

- No source changes were required.
- Verified the existing Android native project can produce a local debug APK from Gradle.

Build command:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'; $env:PATH="$env:JAVA_HOME\bin;$env:PATH"; .\gradlew.bat assembleDebug
```

Verification:

- Initial build attempt failed before compilation because machine-level `JAVA_HOME` points to missing `C:\Program Files\Android\Android Studio\jbr`.
- Rerun with process-local `JAVA_HOME=C:\Program Files\Java\jdk-21` succeeded.
- `.\gradlew.bat assembleDebug` result: `BUILD SUCCESSFUL in 3m 56s`.
- Output APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
- APK size: 172,450,890 bytes.

Notes:

- Android command-line tooling emitted SDK XML compatibility warnings.
- CMake emitted Windows path-length warnings for generated `react-native-ssl-public-key-pinning` object paths.
- Gradle emitted deprecation warnings for future Gradle 9 compatibility.
- None of those warnings blocked the debug APK build.

### 2026-06-03 - Expanded MVP Asset Categories Wired

Changed:

- Added these 7 MVP asset categories to shared/mobile asset type validation:
  - `card`,
  - `vehicle`,
  - `loan_debt`,
  - `medical_care`,
  - `dependent_pet`,
  - `business_interest`,
  - `digital_account`.
- Added generic encrypted form config/routes for the 7 expanded categories.
- Updated dashboard add links, asset labels, detail labels, recently deleted labels, and edit config wiring.
- Added Supabase migration `20260603125545_expand_vault_asset_categories.sql` to expand `vault_assets.asset_type`.
- Applied the migration to the linked remote Supabase project.

Verification:

- Test-first red checks failed as expected before implementation:
  - mobile asset payload validation rejected new categories,
  - schema test could not find `'card'` in the migrations,
  - mobile typecheck rejected new asset types.
- `npm run test --workspace @vault/mobile -- asset-payload.test.ts supabase-schema vault-dashboard-view-model recently-deleted-view-model` passes: 4 files, 15 tests.
- `npm run test --workspace @vault/mobile` passes: 78 files passed, 1 skipped; 285 tests passed, 1 skipped.
- `npm run typecheck` passes across mobile, shared packages, and API.
- `supabase db push --linked` applied `20260603125545_expand_vault_asset_categories.sql` successfully.
- `supabase migration list --linked` shows remote migration `20260603125545`.
- Remote schema dump confirms live `vault_assets_asset_type_check` includes all 17 MVP categories.
- No plaintext category-specific Supabase columns were added; category details remain inside encrypted `ciphertext`.

### 2026-06-03 - Live Supabase Encrypted Asset Smoke

Changed:

- Added skipped-by-default live smoke test `apps/mobile/src/features/vault/encrypted-vault-live-supabase-smoke.test.ts`.
- The smoke signs in with a verified Supabase test account, creates a `card` vault asset through the app encryption/session/repository path, reads the raw `vault_assets` row, asserts plaintext sentinels are absent, and deletes the test asset row.

Verification:

- Initial signup-based smoke was blocked because Supabase email confirmation does not return a session for new users.
- Rerun with verified test credentials passed.
- Raw Supabase row summary from the passing smoke:
  - columns: `id`, `user_id`, `asset_type`, `ciphertext`, `nonce`, `created_at`, `updated_at`, `deleted_at`,
  - `asset_type`: `card`,
  - `ciphertextLength`: 303,
  - `nonceLength`: 32,
  - `hasTitlePlaintext`: false,
  - `hasIssuerPlaintext`: false,
  - `hasAccountNumberPlaintext`: false,
  - `hasNotesPlaintext`: false.
- `npm run test --workspace @vault/mobile -- encrypted-vault-live-supabase-smoke.test.ts` passes.
- `npm run typecheck --workspace @vault/mobile` passes.

### 2026-06-03 - Local PDF Export And Encrypted Storage Preview

Changed:

- Added local-only readable PDF export from unlocked in-memory vault assets.
- Added PDF export route at `/vault/export` and dashboard link.
- Added Expo-native local PDF/share dependencies: `expo-print` and `expo-sharing`.
- Added encrypted storage preview as a transparency feature, not a backup.
- Added safe audit event `vault_pdf_export_created` with no asset names, notes, file paths, or field values.
- Added Supabase migration `20260603190000_add_pdf_export_audit_event_type.sql` so durable audit persistence accepts the PDF export event.
- Kept generated PDFs off Supabase, backend services, and email flows.

Verification:

- `npm run test --workspace @vault/mobile -- supabase-schema.test.ts vault-export-model.test.ts vault-pdf-template.test.ts vault-pdf-exporter.test.ts encrypted-storage-preview.test.ts` passes: 5 files, 14 tests.
- `npm run test --workspace @vault/mobile` passes: 82 files passed, 2 skipped; 292 tests passed, 2 skipped.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npx expo-doctor` from `apps/mobile` passes: 17/17 checks.
- `npm audit --audit-level=moderate` still fails with 17 moderate Expo SDK transitive `postcss` and `uuid` advisories; `npm audit fix --force` still proposes breaking `expo@56.0.8`, so no force fix was applied.

### 2026-06-03 - Real Encrypted Storage Preview Wiring

Changed:

- Exposed cloned encrypted vault records from the active vault session.
- Threaded encrypted records through `VaultSessionProvider` and into `/vault/export`.
- Updated the export preview to show real encrypted record samples when assets exist, while keeping decrypted titles, fields, and notes out of the preview model.
- Added focused guard tests for session plaintext exclusion, context wiring, and export-route handoff.

Verification:

- `npm run test --workspace @vault/mobile -- vault-session.test.ts vault-session-context.test.ts export.test.ts encrypted-storage-preview.test.ts` passes: 4 files, 15 tests.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run test --workspace @vault/mobile` passes: 83 files passed, 2 skipped; 295 tests passed, 2 skipped.

### 2026-06-03 - Emergency Access Foundation Schema And Crypto

Changed:

- Added approved Slice 1 design spec at `docs/superpowers/specs/2026-06-03-emergency-access-foundation-design.md`.
- Added Supabase migration `20260603210500_emergency_access_foundation.sql`.
- Migration creates RLS-protected `emergency_contacts`, `emergency_key_grants`, and `emergency_release_requests`.
- Emergency grant storage is ciphertext/nonce/salt/KDF/status metadata only; no raw emergency code, plaintext MEK, recovery phrase, PDF, or vault plaintext fields are stored.
- Added client-side high-entropy emergency access code generation and normalization.
- Added sealed emergency code MEK wrapping/unwrapping using Argon2id-derived wrapping keys and XChaCha20-Poly1305.
- Added pre-authorized kin MEK wrapping/unwrapping against a supplied 32-byte kin wrapping key placeholder; future slices still need the kin account/keypair exchange UX.

Verification:

- `npm run test --workspace @vault/mobile -- emergency-access-code.test.ts emergency-key-wrapping.test.ts supabase-schema.test.ts` passes: 3 files, 17 tests.
- `npm run typecheck --workspace @vault/mobile` passes.
- `npm run test --workspace @vault/mobile` passes: 85 files passed, 2 skipped; 304 tests passed, 2 skipped.
- `npx expo-doctor` from `apps/mobile` passes: 17/17 checks.

## Pending Tech Debt

- Resend account approval is pending, so production account-deletion confirmation email cannot be live-verified yet.
- `REVENUECAT_WEBHOOK_SECRET` is not configured in Vercel production yet; `POST /webhooks/revenuecat` returns 503 until that secret is set.
- `npm run check:phase1` currently fails on 16 existing functions/components over the BRD 100-line function limit.
- Machine-level `JAVA_HOME` points to a missing Android Studio JBR path; use `C:\Program Files\Java\jdk-21` for local Android Gradle builds or fix the user environment variable.
- `npm audit --audit-level=moderate` still fails on Expo SDK transitive `postcss` and `uuid`; force fix proposes a breaking Expo 56 upgrade and has not been applied.
- Real Supabase MFA remains launch-deferred because it is a paid Supabase feature; placeholder factor ids must not ship to production.
- iOS native dev-client verification remains blocked in this Windows environment.

## Commands To Run Before Claiming Completion

From repo root:

```powershell
npm run test --workspace @vault/mobile
npm run typecheck
npm run check:phase1
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
Partner, read HANDOFF.md first. We finished Android native dev-client verification for returning-user unlock, biometric cached-key unlock, durable audit persistence, and account-deletion queue/processor hardening. Android supports signed-in biometric enable/disable from Settings, cached-key unlock avoids unauthenticated Supabase vault repository calls, and cold-start biometric unlock routes to the Vault screen with `Your vault is ready.` Durable audit persistence is wired to Supabase `audit_events` with plaintext vault metadata guards. Account deletion now queues through the deployed API at `POST /account-deletion/request`, which validates the Supabase bearer session, creates the deletion request server-side, and sends a confirmation email through Resend when `RESEND_API_KEY` is configured. Resend account approval is currently pending, so live email verification is externally blocked. The processor explicitly deletes `vault_assets` and `vault_key_material`, anonymizes retained audit rows, then soft-deletes due Supabase Auth users with service-role credentials outside mobile. Seven-year anonymized audit retention automation is implemented and live-verified via `POST /internal/audit-retention/process`; manual GitHub workflow run `26824120201` returned `{"ok":true,"deleted":0}`. RevenueCat webhook TODO debt is cleared: the webhook now validates and acknowledges events with `entitlementSync: "deferred_phase_1"` and does not gate Phase 1 vault access. The API is deployed to Vercel production at `https://sanduqkin-api.vercel.app`; health, unauthorized processor rejection, authenticated processor invocation, manual GitHub scheduler dispatch, and unauthenticated deletion-request rejection are live-verified. Migrations through `20260601141825_add_account_deletion_processing_state.sql` are applied remotely and live RLS/column verification passed. On 2026-06-01, iOS native dev-build verification was attempted but blocked because this Windows environment has no Xcode/xcrun/iOS simulator. MFA remains intentionally on hold until launch because it is a paid Supabase feature.

Start the next Windows/Android slice: emergency access and PDF export must be handled as a critical, staged security design/build, not one large feature. Keep the zero-knowledge vault model: Sanduqkin/Supabase must not decrypt user vault data directly and must not email plaintext vault information. Emergency access should release permission plus encrypted/wrapped key material only after verification; kin decrypts locally in the app/web flow. Support two user choices: pre-authorized kin as the highly recommended path, and sealed emergency access code as an opt-in backup path. PDF export should decrypt locally in the app and save/share from the device only. If Resend is approved, account-deletion email verification can remain a separate pending hardening slice. If working on a Mac instead, run iOS native dev-client verification for returning-user unlock and biometric unlock.
```

Current next-slice checklist:

- Critical emergency-access/PDF work must be done in small gated slices:
  - Slice 0 - Write and review the security design:
    - document the exact key-release model before schema or UI changes,
    - cover pre-authorized kin, sealed emergency access code, release verification, local decryption, local PDF export, encrypted storage preview, audit logging, and failure cases,
    - explicitly state that Sanduqkin/Supabase never sees vault plaintext, emergency codes, recovery phrases, MEKs, or generated PDFs,
    - stop after the design document and get founder approval before implementation.
  - Slice 1 - Data model and crypto primitives:
    - add Supabase schema for emergency contacts, release policies, sealed packages, release requests, and audit state without plaintext vault fields,
    - add local crypto helpers for wrapping/unwrapping MEK for pre-authorized kin and emergency-code sealed packages,
    - generate emergency codes client-side with high entropy and human-readable formatting,
    - store only salts, nonces, encrypted key material, release metadata, and status values server-side,
    - verify tests prove no plaintext secret/code/MEK/vault data is persisted or logged.
  - Slice 2 - User setup UX:
    - add the emergency access choice screen,
    - show `Pre-Authorized Kin` first with a `Highly recommended` badge and transparent security explanation,
    - show `Sealed Emergency Code` as a backup option with clear loss/theft risk copy,
    - require acknowledgement before sealed-code creation,
    - allow viewing/regenerating/revoking emergency access configuration safely.
  - Slice 3 - Release request and kin access UX:
    - add kin request intake and verification state screens,
    - release only wrapped key material after approved verification,
    - require kin local decrypt using either their pre-authorized key or the user-provided emergency access code,
    - never send decrypted data by email and never decrypt on the backend.
  - Slice 4 - Local PDF export:
    - add readable PDF export from already-decrypted in-memory vault data only,
    - show a strong warning before export,
    - use native save/share from the device,
    - never upload generated PDFs to Supabase and never email them.
  - Slice 5 - Encrypted storage preview:
    - add a transparency view showing representative encrypted stored records/ciphertext,
    - label it as a storage/security preview, not a user backup,
    - explain that Sanduqkin stores encrypted text and non-sensitive metadata, not readable account details.
  - Slice 6 - End-to-end hardening:
    - add tests for release state transitions, crypto unwrap success/failure, sealed-code loss/failure, revocation, local-only PDF generation, and plaintext guards,
    - run mobile tests, typecheck, phase guard, Expo doctor, and audit checks,
    - update this handoff after each completed slice.
- Keep account deletion/server-side retention hardening pending:
  - after Resend approval, configure `RESEND_API_KEY` and live-verify confirmation email.
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

Current implementation status:

- Current Supabase `vault_assets.asset_type` check constraint and mobile `AssetType` enum include all 17 recommended MVP categories.
- The original 10 BRD categories have specialized mobile forms and encrypted payload builders.
- The 7 expanded MVP categories use generic encrypted form routes with category-specific labels and fields.
- No plaintext category-specific Supabase columns were added; structured category fields remain inside encrypted JSON payloads.

Sensitive-field UX rule:

- Default to minimal identifiers: name, country, location, provider, contact, document location, and last 4 digits.
- Full account numbers, policy numbers, seed phrases, passwords, PINs, MFA backup codes, and private keys should not be encouraged.
- If full sensitive values are allowed, the UI must require an explicit warning/confirmation and store them only inside the encrypted payload.

Future kin-access decision:

- The existing vault is user-encrypted and cannot be decrypted by Supabase alone.
- The agreed product direction is to keep zero-knowledge vault storage and build emergency access as a key-release system.
- Do not build a flow where Sanduqkin/Supabase decrypts vault data server-side, exports plaintext server-side, or emails plaintext to kin.
- Emergency access must support two transparent user choices:
  - `Pre-Authorized Kin` - the highly recommended path.
  - `Sealed Emergency Code` - an opt-in backup path for users whose kin cannot set up an account in advance.
- `Pre-Authorized Kin` UX requirements:
  - show this option first with a `Highly recommended` badge,
  - explain that the trusted person verifies their account in advance,
  - explain that Sanduqkin can release access only after emergency review is approved,
  - explain that the vault remains encrypted and Sanduqkin cannot read the user's saved information,
  - allow the user to remove or replace the trusted person.
- `Sealed Emergency Code` UX/security requirements:
  - generate the code client-side from cryptographically secure random bytes,
  - format it as a human-readable high-entropy code, not a JWT or normal short OTP,
  - use it as secret key material to derive a wrapping key for a sealed emergency package,
  - never store, log, email, or send the raw code to Sanduqkin/Supabase,
  - store only KDF salt, nonce, encrypted/wrapped key material, release policy metadata, and status server-side,
  - tell the user clearly that Sanduqkin cannot recover the code if lost,
  - tell the user clearly that someone with the code may be able to access the vault after emergency approval,
  - require an acknowledgement before creating the sealed code,
  - advise the user to give the code to next of kin or keep it with important papers, not send it through email/chat.
- The app should create a kin-specific or sealed-code-specific wrapped MEK/decryption capability in advance.
- If the user dies, is in coma, or is unable to communicate, kin submits a verified access claim.
- After the release policy is satisfied, the system releases only encrypted/wrapped key material/decryption capability to the kin flow.
- Decryption should happen client-side in the kin/user app experience, not in a server email job.
- Any Supabase schema for kin access must avoid plaintext vault fields; expected server-visible metadata is limited to ids, status, verification/release state, timestamps, and wrapped encrypted key material.

Local PDF export decision:

- Users should be able to download a readable PDF of their vault from inside the app after local decrypt.
- PDF generation should happen on-device from already-decrypted vault data in memory.
- Do not upload generated PDFs to Supabase.
- Do not email generated PDFs.
- Show a clear warning that the PDF contains sensitive information and should be stored safely.
- Suggested label: `Download readable PDF`.
- Suggested warning: `Creates a readable PDF from your unlocked vault on this device. Sanduqkin does not receive or email this file. Store it safely.`
- Add a separate transparency feature for encrypted storage preview:
  - label it `View encrypted storage preview`,
  - do not present it as a normal downloadable backup unless a restore/import flow is intentionally designed,
  - show representative encrypted ciphertext/non-sensitive metadata so users understand what Sanduqkin stores,
  - explain that Sanduqkin stores encrypted text like this, not readable account details.
