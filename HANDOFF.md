# Sanduqkin Current Handoff

Archived full prior handoff:

- `docs/handoff/archive/HANDOFF-2026-06-08-pre-archive.md`

## Next Session Opener

Start here:

> We are in Phase 1 foundation / integration hardening. The last completed slice live-verified Android encrypted-vault-item continuity through recovery reset against Supabase: setup phrase, reset to a temporary password, add encrypted item, restore the shared test password, and confirm the item still decrypts. Next slice should move to one of the remaining external Phase 1 blockers. Keep slice discipline: implement/test/confirm/update this handoff before moving on.

Do not move to Phase 2 beneficiary/activation work yet. Do not continue Phase 3 payments work until Phase 1 verification and hardening gaps are closed.

## Source Of Truth

- Repository: `C:\Projects\GitHub\Sandoq Kin`
- Product/app name: Sanduqkin
- BRD: `Vault_BRD_v1.0.md`, version shown in file: 1.1
- Active scope: Phase 1 - Core Single-User Vault
- Current handoff refresh: 2026-06-11
- Current branch: `main`
- Current working tree has uncommitted QA slice changes. Do not discard them.

## Product Guardrails

- Sanduqkin is a secure information organizer, not a financial service, estate-planning product, legal service, investment product, or estate executor.
- Phase 1 is single-user only.
- Phase 1 excludes beneficiaries, activation flow, witnesses, document upload, production notifications, web app, and payments.
- User-facing copy must avoid forbidden financial/legal positioning from the BRD.
- Normal vault storage must remain zero-knowledge: Sanduqkin/Supabase must not store or expose plaintext vault content, raw emergency codes, passwords, seed phrases, private keys, or raw MEK.
- Emergency access direction is key release, not server-side plaintext export.
- Vault UX/data redesign must preserve zero-knowledge storage. Normalize safe metadata only; do not add plaintext asset-detail columns such as bank names, account digits, contact details, document locations, notes, or family instructions to Supabase tables.
- Delete means hard delete for vault records. User-facing copy must clearly state that deleted encrypted records cannot be recovered and Sanduqkin cannot restore them.

## Stack Snapshot

- Monorepo with npm workspaces.
- `apps/mobile`: Expo React Native app, Expo Router, TypeScript.
- `packages/shared-types`: shared asset types.
- `packages/shared-validation`: shared Zod validation.
- `services/api`: Hono API scaffold.
- Mobile dependencies include Supabase, libsodium, SecureStore, Local Authentication, RevenueCat, Zod, and `expo-screen-capture`.
- Supabase CLI is installed and linked to project ref `pxwtexjjttpgtairpepz`.
- Docker Desktop is installed and running; Docker was used with `postgres:16-alpine` to send PostgREST schema reload notifications.

## Built And Verified

- Phase 1 Supabase persistence foundation exists for encrypted vault assets, wrapped MEK key material, audit events, account deletion requests, and emergency access foundations.
- Returning-user unlock with wrapped MEK has passed live Supabase verification.
- Android native-dev-client unlock and vault access has been manually verified.
- Durable audit persistence and account deletion/retention foundations exist.
- Vault supports MVP categories including expanded category set.
- Local readable PDF export exists and must stay on-device; generated PDFs are not uploaded or emailed.
- Password reset recovery now re-wraps the phrase-derived MEK with the new password and saves updated wrapped key material.

## Last Completed Slice: Android Sealed Emergency Code Setup

Completed on 2026-06-08:

- Android emulator launched fresh.
- Sign-in and vault unlock succeeded.
- Settings > Emergency access loaded.
- One-time sealed emergency code creation succeeded.
- The screen showed: `Write this code down now. Sanduqkin cannot show it again after you confirm.`
- After confirmation, the screen showed `Emergency code active`.
- After confirmation, the screen showed: `Sanduqkin no longer has the raw code. Regenerate if you need a new copy.`
- Android UI tree after confirmation no longer contained the raw one-time code.
- Direct Supabase verification showed one active `sealed_emergency_code` row with encrypted/wrapped metadata only:
  - `wrapped_mek_ciphertext`
  - `wrapped_mek_nonce`
  - `wrapping_algorithm`
  - `kdf_algorithm`
  - `kdf_salt`
  - `kdf_params`
  - status/timestamps/ids
- Supabase table has no `raw_code`, `emergency_code`, or plaintext code column.

## Changes In Current Uncommitted Slice

These files are intentionally changed and should be carried forward:

- `HANDOFF.md`
- `docs/handoff/archive/HANDOFF-2026-06-08-pre-archive.md`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/settings/emergency-access.tsx`
- `apps/mobile/package.json`
- `apps/mobile/app.json`
- `apps/mobile/tsconfig.json`
- `apps/mobile/src/features/auth/components/email-password-auth-form.tsx`
- `apps/mobile/src/features/auth/components/forgot-password-panel.tsx`
- `apps/mobile/src/features/auth/components/reset-password-panel.tsx`
- `apps/mobile/src/features/auth/password-reset-service.ts`
- `apps/mobile/src/features/auth/password-reset-service.test.ts`
- `apps/mobile/src/features/vault/supabase-emergency-grant-repository.ts`
- `apps/mobile/src/features/vault/supabase-emergency-grant-repository.test.ts`
- `apps/mobile/src/features/vault/vault-session-context.tsx`
- `apps/mobile/src/features/vault/vault-session-context.test.ts`
- `apps/mobile/src/shared/api/supabase-schema.test.ts`
- `apps/mobile/src/shared/api/supabase-client.ts`
- `apps/mobile/src/shared/api/supabase-client.test.ts`
- `apps/mobile/src/shared/runtime/buffer-polyfill.ts`
- `apps/mobile/src/app-route-tests/emergency-access-route.test.ts`
- `apps/mobile/src/app-route-tests/vault-export-route.test.ts`
- `package-lock.json`
- `package.json`
- `patches/react-native-libsodium+1.7.0.patch`
- `services/api/package.json`
- `supabase/migrations/20260608200000_add_sealed_emergency_code_audit_event_types.sql`

Files intentionally removed from the Expo Router app tree:

- `apps/mobile/app/settings/emergency-access.test.ts`
- `apps/mobile/app/vault/export.test.ts`

Reason: Expo Router bundled `.test.ts` files under `apps/mobile/app`, causing Metro to try loading Node-only imports such as `node:fs`.

## Backend / Supabase State

Remote Supabase migrations are aligned through:

- `20260612121500_enforce_vault_asset_active_record_limit.sql`

Migrations applied during the final slice:

- `20260603190000_add_pdf_export_audit_event_type.sql`
- `20260603210500_emergency_access_foundation.sql`
- `20260608200000_add_sealed_emergency_code_audit_event_types.sql`
- `20260612120000_harden_emergency_access_table_grants.sql`
- `20260612121500_enforce_vault_asset_active_record_limit.sql`

PostgREST schema reload was notified after migration pushes with:

```powershell
docker run --rm -e PGPASSWORD='<db-password>' postgres:16-alpine psql "host=aws-1-eu-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.pxwtexjjttpgtairpepz sslmode=require" -c "NOTIFY pgrst, 'reload schema';"
```

Connection verification on 2026-06-19: the current database password authenticated successfully through the session pooler on port `5432`. The transaction-pooler endpoint on port `6543` rejected the same credential, and the direct database host was unavailable from this environment. Keep credentials outside the repository and use the session-pooler endpoint for database administration from this machine.

Do not write Supabase passwords or tokens to repo files.

## Testing Credentials

- Current shared Android/Supabase QA account email: `shahbaz.malik@hotmail.co.uk`
- Do not store the test account password, recovery phrase, raw emergency codes, Supabase tokens, database passwords, or other secrets in this repo or handoff.
- The project owner should keep the test password and recovery phrase in an external password manager. Codex can use them transiently during a live QA session when provided in chat.

## Bugs Found And Fixed In Last Session

- Metro bundling blocker: `.test.ts` files under `apps/mobile/app` were treated as Expo Router input. Fixed by moving route tests to `apps/mobile/src/app-route-tests`.
- Native render crash: `Cannot read property 'from' of undefined`. Root cause was detaching Supabase client's `from` method, losing `this` binding. Fixed repository to call `client.from(...)` directly and added regression coverage.
- Live backend missing table/schema cache: `public.emergency_key_grants` was missing remotely or stale in PostgREST schema cache. Fixed by applying emergency access migration and notifying schema reload.
- Audit constraint mismatch: sealed-code audit events were not allowed by `audit_events_event_type_check`. Fixed with `20260608200000_add_sealed_emergency_code_audit_event_types.sql`.
- RLS insert failure on `emergency_key_grants`: emergency route created a fresh unauthenticated Supabase client. Fixed vault context to retain the authenticated Supabase client from sign-in and use it for emergency grant repository creation.
- Native recovery phrase crash: `bip39` needed global `Buffer` in React Native. Fixed by adding the `buffer` dependency and importing `@/shared/runtime/buffer-polyfill` before recovery phrase code can run.
- RLS insert failure on `vault_key_material` during recovery phrase setup: auth state was lost when route components created fresh Supabase clients. Fixed `createSupabaseClient()` to reuse the default app client so the session survives route changes while preserving injectable test clients.

## Verification Commands Already Run

Focused test sets passed:

```powershell
npm run test --workspace @vault/mobile -- emergency-access-route.test.ts vault-export-route.test.ts
npm run test --workspace @vault/mobile -- supabase-emergency-grant-repository.test.ts emergency-access-route.test.ts vault-export-route.test.ts
npm run test --workspace @vault/mobile -- supabase-schema.test.ts supabase-emergency-grant-repository.test.ts sealed-emergency-code-service.test.ts emergency-access-route.test.ts vault-export-route.test.ts
npm run test --workspace @vault/mobile -- vault-session-context.test.ts emergency-access-route.test.ts supabase-emergency-grant-repository.test.ts sealed-emergency-code-service.test.ts supabase-schema.test.ts
```

Typecheck passed repeatedly:

```powershell
npm run typecheck --workspace @vault/mobile
```

Supabase migration status verified:

```powershell
supabase migration list --linked
```

Android manual QA passed on emulator for sealed-code creation and post-confirmation hiding of raw code.

## Android QA Startup Notes

Working local Android QA path on Windows:

1. Clear stale repo-owned Metro/test worker processes if needed, but leave Codex/MCP processes alone:

```powershell
$targets = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Where-Object {
    $_.CommandLine -like '*expo\bin\cli* start --dev-client*' -or
    $_.CommandLine -like '*npm-cli.js*run start:dev-client*' -or
    $_.CommandLine -like '*jest-worker*processChild.js*'
  }
$targets | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
```

2. Start the emulator with the SDK emulator binary because `emulator.exe` may not be on PATH:

```powershell
Start-Process -FilePath "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList @("-avd", "Pixel_7", "-no-snapshot-load") -WindowStyle Hidden
adb wait-for-device
while ((adb shell getprop sys.boot_completed).Trim() -ne "1") { Start-Sleep -Seconds 2 }
adb devices -l
```

3. Start Metro from the repository root with root `.env` loaded into the process. This matters because the Expo app is under `apps/mobile`, while the configured Supabase/RevenueCat env file currently lives at the monorepo root:

```powershell
Get-Content ".env" | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
  }
}
Set-Location "C:\Projects\GitHub\Sandoq Kin\apps\mobile"
npx expo start --dev-client --port 8081
```

With local npm 11, forwarding Expo CLI flags through `npm run ... -- --port 8081` is not reliable: npm consumes `--port` and passes `8081` as a positional project root. Invoke Expo directly as shown above. Add `--clear` only when cache invalidation is actually needed.

4. Build the current Android debug APK with the valid Android Studio JBR path. `C:\Program Files\Android\Android Studio\jbr` exists locally but does not contain `bin\java.exe`; use `Android Studio1`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio1\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Set-Location "C:\Projects\GitHub\Sandoq Kin\apps\mobile\android"
.\gradlew.bat app:assembleDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeDevServerPort=8081 '-PreactNativeArchitectures=x86_64,arm64-v8a' --console=plain
```

5. Install and launch:

```powershell
Set-Location "C:\Projects\GitHub\Sandoq Kin"
adb install -r "apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
adb shell am start -n com.sanduqkin.mobile/com.sanduqkin.mobile.MainActivity
```

6. In the Expo dev launcher, select `http://10.0.2.2:8081`. If the app says `Supabase is not configured yet`, Metro was started without the root `.env`; restart Metro with step 3.

## Recommended Next Slice

Current product/UX direction agreed on 2026-06-12:

- Add a Phase 1 vault records UX/data hardening track before Phase 2 work.
- Separate saved-record browsing from record creation:
  - `Vault` is the saved secure records page.
  - `Add <asset class>` pages focus on creating one record.
  - After saving, show the relevant category/list view with the saved card and a clear `+ Add another <asset class>` action.
- Support multiple records for every asset class, with a maximum of 20 active records per user per asset class.
- Each saved record card should expose a two-dot/overflow menu with `Edit` and `Delete permanently`.
- Delete is hard delete only, with an explicit irreversible confirmation. No restore flow for vault records.
- Bulk actions should be available on saved-record/category views: select records, delete selected, and delete all in category, each with clear confirmation.
- Keep the database zero-knowledge:
  - Supabase may store safe metadata such as user id, asset category/type, timestamps, ciphertext, nonce, and audit/event metadata.
  - Actual asset details stay encrypted in the payload before reaching Supabase.
  - Do not redesign into plaintext normalized asset-detail tables unless the zero-knowledge requirement is intentionally revisited.
- Database hardening/verification required:
  - Verify RLS on every user-owned table.
  - Verify users can only select/insert/update/delete rows where `user_id = auth.uid()`.
  - Verify no public/anon access to vault tables.
  - Verify indexes support the real list/category queries.
  - Add DB-level enforcement for the 20-active-records-per-category limit if practical.
  - Use migration files for all DB changes; do not edit remote schema manually without a migration.
  - Use Supabase backups/platform capabilities where applicable; do not store database passwords or tokens in repo files.
  - Supabase handles connection pooling for hosted usage; verify configuration before adding custom pooling.
- UI direction:
  - Use a restrained glass-inspired design language for cards, menus, and action surfaces.
  - Because the app is Expo/React Native, do not depend on iOS-only Liquid Glass APIs.
  - Provide robust fallbacks for old Android/iOS devices and low-end phones; avoid fragile blur-heavy UI that can break or perform poorly.
  - Inputs must handle real-world names and text safely, including apostrophes and punctuation.
  - Web/Safari compatibility matters only for future web surfaces; Phase 1 remains mobile-first.
- Work in small slices: implement one narrow behavior, test it, live-check if needed, update this handoff, then move to the next slice.

Recommended next vault UX/data slices:

1. Write/approve a short design spec and implementation plan for the vault records UX/data hardening track.
2. Add DB verification tests/scripts for existing RLS, grants, indexes, and zero-knowledge columns.
3. Add/verify migration for category metadata and 20 active records per user/category, if not already covered by existing `vault_assets`.
4. Refactor navigation so `Vault` shows saved records and `Add <asset class>` pages are creation-only.
5. Add saved-record cards with overflow menu, edit, and hard-delete confirmation for one asset class first, likely bank accounts.
6. Extend the card/list/add-another pattern to remaining asset classes.
7. Add bulk select/delete selected/delete all in category.
8. Apply glass-inspired UI polish with old-device fallbacks and run Android QA.

Remaining external Phase 1 blockers still exist:

- macOS/Xcode/iOS simulator verification.
- Resend approval / production account-deletion confirmation email verification once available.
- `npm run check:phase1` known function-size debt.

Code/test progress on 2026-06-09:

- Route recovery now loads the active sealed-code grant on settings entry.
- If an active grant exists with the pending-confirmation marker, the route shows `interrupted`.
- If an active grant exists without the pending-confirmation marker, the route shows `active`.
- Route regression tests assert that SecureStore stores only the interruption marker, not the raw one-time code.
- Focused tests passed:

```powershell
npm run test --workspace @vault/mobile -- emergency-access-route.test.ts
npm run test --workspace @vault/mobile -- supabase-emergency-grant-repository.test.ts sealed-emergency-code-service.test.ts emergency-access-route.test.ts
npm run test --workspace @vault/mobile -- vault-session-context.test.ts emergency-access-route.test.ts supabase-emergency-grant-repository.test.ts sealed-emergency-code-service.test.ts supabase-schema.test.ts
npm run typecheck --workspace @vault/mobile
```

Android manual QA on 2026-06-09:

- Started Android emulator `Pixel_7` and Metro dev client with root `.env` loaded.
- Signed in and opened `sanduqkin://settings/emergency-access`.
- Verified starting state showed `Emergency code active` plus `Sanduqkin no longer has the raw code. Regenerate if you need a new copy.`
- Regenerated from active state and verified a one-time code panel appeared.
- Left the one-time code page before confirmation, reopened emergency access, and verified the screen showed `Setup interrupted`.
- Verified the interrupted screen did not show the raw one-time code and offered `Regenerate code` / `Revoke unusable code`.
- Regenerated from interrupted state and verified a different one-time code panel appeared.
- Confirmed the regenerated code and verified the screen returned to `Emergency code active` with raw-code hiding copy.
- Revoked the active code and verified the setup panel returned with no raw code visible.
- Created and confirmed a fresh code so the test account ended in active state.

Direct Supabase verification after Android QA:

- Test user has one active `sealed_emergency_code` grant and three revoked sealed-code grants.
- Latest grant rows contain encrypted/wrapped metadata only: wrapped MEK ciphertext/nonce lengths, wrapping algorithm, Argon2id KDF salt/params, status, ids, and timestamps.
- `information_schema.columns` check found no suspicious plaintext columns on `public.emergency_key_grants` matching raw/code/secret/password/plain.

Password reset/recovery code progress on 2026-06-09:

- `createPasswordResetService(...).resetWithRecoveryPhrase` now derives the MEK from the recovery phrase, derives a new KEK from the new password and fresh salt, wraps the MEK, increments the stored recovery version when existing key material is available, and saves updated `vault_key_material`.
- `ResetPasswordPanel` now wires the authenticated Supabase client into `createSupabaseKeyMaterialRepository`, so the recovery reset path persists the new wrapped MEK instead of only caching the recovered MEK locally.
- `createSupabaseClient()` now reuses the default app Supabase client, preserving auth session continuity across route-created repositories.
- Added a React Native `Buffer` polyfill for `bip39` recovery phrase generation.
- Regression coverage asserts recovered key material is saved without plaintext MEK/password fields in the payload.
- Focused tests and typecheck passed:

```powershell
npm run test --workspace @vault/mobile -- password-reset-service.test.ts
npm run test --workspace @vault/mobile -- password-reset-service.test.ts recovery-phrase-flow.test.ts returning-user-unlock-flow.test.ts supabase-key-material-repository.test.ts
npm run typecheck --workspace @vault/mobile
```

Android/Supabase live reset verification on 2026-06-09:

- Disposable test account sign-in succeeded.
- Initial state correctly reported missing vault key material.
- Recovery phrase setup initially exposed two native/live issues: missing global `Buffer`, then unauthenticated `vault_key_material` insert from a route-created client.
- After fixes, recovery phrase setup completed on Android and reached biometric setup.
- Biometric setup was skipped on the emulator, and the app reached the vault welcome screen.
- Direct Supabase verification confirmed `vault_key_material` exists for the test account with wrapped ciphertext/nonce/salt metadata only; no plaintext password, recovery phrase, or MEK was queried or written.
- Recovery reset completed on Android and showed `Sanduqkin recovered`.
- Direct Supabase verification showed `recovery_version` incremented from `1` to `2`.
- Sign-in with the temporary reset password succeeded and unlocked the vault.
- A second recovery reset restored the shared test password and incremented `recovery_version` to `3`.
- Final sign-in with the restored shared password succeeded and landed in the vault.

Android encrypted-vault-item continuity QA progress on 2026-06-10:

- Restarted `Pixel_7`, rebuilt the current Android debug APK, installed `com.sanduqkin.mobile`, and launched the Expo dev client.
- Found and fixed the local QA startup issue: Metro must be started with the monorepo root `.env` loaded, otherwise sign-in reports `Supabase is not configured yet`.
- Signed in to the shared test account on Android with Supabase configured.
- Added a bank-account test reference titled `QAResetItem0610`.
- Verified the vault screen showed `1 active items` and displayed `QAResetItem0610` as a `Bank account`.
- Direct Supabase verification showed one `public.vault_assets` row for the test account with `asset_type = bank_account`, ciphertext length `282`, nonce length `32`, and no suspicious plaintext columns matching plain/raw/secret/password/phrase/MEK.
- Direct Supabase verification before recovery reset showed `public.vault_key_material.recovery_version = 3`, wrapped MEK ciphertext/nonce metadata only, Argon2id KDF metadata, and no plaintext password/recovery phrase/raw MEK columns.
- The previous shared test account was blocked because its recovery phrase was not available. A new shared test account was created and is recorded above by email only; do not store its password or phrase in repo files.
- Recovery phrase setup completed on Android for the new test account. The phrase was used transiently for QA and must be stored externally by the project owner.
- Directly launching `sanduqkin://auth/reset-password?mode=recover` without an active in-app Supabase session showed `Could not recover vault. Check your recovery phrase.` The phrase was valid; signing in through the app first and then opening the reset route succeeded. For manual QA, reset through a real Supabase reset link/session or sign in first before opening the local recover route.
- Recovery reset to a temporary password succeeded and showed `Sanduqkin recovered`.
- Sign-in with the temporary password opened the vault.
- Added a bank-account test reference titled `QAResetItem0610C` while signed in with the temporary password.
- Direct Supabase verification showed one `public.vault_assets` row for the new test account with `asset_type = bank_account`, ciphertext length `272`, nonce length `32`, and no suspicious plaintext columns matching plain/raw/secret/password/phrase/MEK.
- Recovery reset restored the shared test password and showed `Sanduqkin recovered`.
- Final sign-in with the restored shared test password succeeded. The vault showed `1 active items` and displayed `QAResetItem0610C` as a `Bank account`, confirming encrypted item continuity through reset/restore.
- Direct Supabase verification after restore showed `public.vault_key_material.recovery_version = 3`, wrapped MEK ciphertext length `79`, wrapped MEK nonce length `32`, KEK salt length `22`, and Argon2id metadata only.

Additional focused tests passed during live-fix work:

```powershell
npm run test --workspace @vault/mobile -- recovery-phrase-service.test.ts password-reset-service.test.ts recovery-phrase-flow.test.ts
npm run test --workspace @vault/mobile -- supabase-client.test.ts recovery-phrase-flow.test.ts password-reset-service.test.ts
npm run typecheck --workspace @vault/mobile
```

Expo SDK audit hardening on 2026-06-11:

- Checked current Expo docs before changing versions. SDK 56 is the latest docs track and maps this app to Expo `~56.0.11`, React Native `0.85.3`, React `19.2.3`, and TypeScript `~6.0.3`.
- Updated the mobile Expo dependency set to SDK 56-compatible packages with `npx expo install` / `npx expo install --fix`.
- Updated root peer overrides to the SDK 56 React / React DOM / safe-area versions.
- Updated root Node engine to `^22.13.0 || >=24.3.0`; local Node `v24.2.0` still runs commands but produces EBADENGINE warnings because React Native/Metro SDK 56 packages require `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25.0.0`.
- Removed SDK 56-invalid app config keys from `apps/mobile/app.json`: top-level `newArchEnabled`, top-level `splash`, and `android.edgeToEdgeEnabled`.
- Moved iOS deployment target to built-in `ios.deploymentTarget: "16.4"` and removed the deprecated `expo-build-properties.ios.deploymentTarget` setting.
- Removed direct app dependency on `@expo/config-plugins`; patched `react-native-libsodium` to import config plugins from `expo/config-plugins`, matching Expo package guidance.
- Added TypeScript 6 `ignoreDeprecations: "6.0"` because `expo/tsconfig.base` still relies on `baseUrl`.
- Replaced direct `expo-router` `Router` type imports with local `ReturnType<typeof useRouter>` types because the SDK 56 router package no longer exports that type.
- Updated `services/api` Hono from `4.12.18` to `4.12.25`, clearing the Hono audit advisory.
- Cleared the previous critical `shell-quote` advisory by overriding `react-devtools-core` to `shell-quote@1.8.4`.
- `npm audit --workspaces --json` now reports 11 moderate vulnerabilities and 0 critical vulnerabilities. The remaining advisories are the upstream Expo config chain through `@expo/config-plugins -> xcode@3.0.1 -> uuid@7.0.3`; npm suggests downgrading to Expo 46-era packages, which is not an acceptable fix path for this SDK 56 app.
- Do not run `npm audit fix --force` for this blocker; it proposes unsafe/breaking Expo downgrades.

Validation after Expo SDK audit hardening:

```powershell
npm run typecheck --workspace @vault/mobile
npx expo-doctor
npm run test --workspace @vault/mobile -- vault-session-context.test.ts emergency-access-route.test.ts supabase-emergency-grant-repository.test.ts sealed-emergency-code-service.test.ts supabase-schema.test.ts
npm audit --workspaces --json
```

Results:

- Mobile typecheck passed.
- Expo Doctor passed 18/18 checks.
- Focused mobile tests passed: 5 files, 24 tests.
- Audit status improved from 19 advisories with 1 critical to 11 moderate advisories with 0 critical.

Vault records UX/data hardening planning and first DB guard slice on 2026-06-12:

- Agreed Phase 1 vault records UX/data direction:
  - `Vault` becomes the saved secure records page.
  - `Add <asset class>` pages become creation-only.
  - After saving, show the relevant category/list view with saved cards and `+ Add another <asset class>`.
  - Each saved record card should expose `Edit` and `Delete permanently`.
  - Delete is hard delete only, with irreversible confirmation copy.
  - Support up to 20 active records per user per asset class.
  - Bulk delete selected/delete all in category should be added later with explicit confirmation.
- Added design spec:
  - `docs/superpowers/specs/2026-06-12-vault-records-ux-data-hardening-design.md`
- Added implementation plan:
  - `docs/superpowers/plans/2026-06-12-vault-records-ux-data-hardening.md`
- Added schema guard coverage to assert every user-owned Phase 1 table:
  - has RLS enabled,
  - grants service-role access,
  - explicitly revokes `anon` and `public`,
  - uses owner policies based on `auth.uid() = user_id`.
- The new guard exposed that emergency access tables had RLS and owner policies but lacked explicit `anon`/`public` revoke statements.
- Added and pushed remote migration:
  - `supabase/migrations/20260612120000_harden_emergency_access_table_grants.sql`
  - revokes `anon` and `public` from `emergency_contacts`, `emergency_key_grants`, and `emergency_release_requests`.
- Remote migration status verified aligned through `20260612120000`.
- Verification passed:

```powershell
npm run test --workspace @vault/mobile -- supabase-schema.test.ts
npm run typecheck --workspace @vault/mobile
supabase migration list --linked
```

Vault hard-delete domain slice on 2026-06-12:

- Updated vault domain behavior so `permanentlyDeleteAsset(id)` can delete an active record directly.
- The in-memory vault store no longer requires a record to be soft-deleted before permanent deletion.
- Session persistence now calls repository hard delete directly for active records.
- Existing asset detail route now calls `permanentlyDeleteAsset` instead of `softDeleteAsset`.
- Existing asset detail delete button now uses a two-step irreversible confirmation:
  - first tap shows permanent-delete warning copy,
  - second tap confirms `Delete permanently`.
- User-facing confirmation copy states the encrypted record cannot be recovered and Sanduqkin cannot restore deleted encrypted vault records.
- Focused verification passed:

```powershell
npm run test --workspace @vault/mobile -- vault-store.test.ts vault-session.test.ts vault-session-context.test.ts permanent-delete-confirmation.test.ts
npm run typecheck --workspace @vault/mobile
```

Bank-account saved-record list slice on 2026-06-12:

- Added bank-account category list view model:
  - filters active assets to `assetType = "bank_account"`,
  - sorts records by title,
  - formats safe decrypted summaries locally after unlock,
  - exposes `count`, `limit = 20`, and `canAddMore`.
- Added bank-account saved-record route:
  - `apps/mobile/app/vault/bank-accounts.tsx`
  - shows `Bank accounts`, `N of 20 saved`, empty state, and `+ Add another bank account`.
- Updated `add-bank-account` to route to `/vault/bank-accounts` after save instead of returning to the mixed Vault dashboard.
- Added saved-record category list component:
  - fallback-safe glass-inspired card surfaces,
  - ASCII `...` overflow action trigger,
  - `Edit`,
  - two-step `Delete permanently` confirmation with irreversible copy,
  - no blur dependency.
- Added main Vault dashboard entry point for implemented bank-account category list.
- Android emulator sanity check passed by deep-linking to `sanduqkin://vault/bank-accounts`:
  - screen showed `Bank accounts`,
  - screen showed `0 of 20 saved`,
  - screen showed `No bank accounts saved yet.`,
  - screen showed `+ Add another bank account`.
- Live Android add/save/delete QA exposed a separate form/startup issue:
  - first form attempts showed the bank-account add screen could be hard to complete on Android because the shared centered screen layout did not give long forms reliable bottom scroll room to reach `Save reference`;
  - added `screenStyles.formContent` and applied it to `add-bank-account` with `keyboardShouldPersistTaps="handled"`;
  - focused typecheck and route/view-model tests still pass after the layout fix;
  - full live add/save/card/menu/delete QA remains blocked because the Expo dev client fell back to the launcher after force-stop and the restarted Expo CLI process stayed alive but did not bind to port `8081` after more than one minute.
- Focused verification passed:

```powershell
npm run test --workspace @vault/mobile -- vault-category-list-view-model.test.ts bank-account-category-route.test.ts vault-dashboard-view-model.test.ts vault-store.test.ts vault-session.test.ts permanent-delete-confirmation.test.ts
npm run typecheck --workspace @vault/mobile
```
- Remaining for this slice family:
  - add bulk delete selected/delete all in category.
- Added and pushed remote migration:
  - `supabase/migrations/20260612121500_enforce_vault_asset_active_record_limit.sql`
  - adds `public.enforce_vault_assets_active_record_limit()`
  - adds `vault_assets_active_record_limit_trigger`
  - enforces max 20 active `vault_assets` rows per `user_id` and `asset_type`
  - counts only rows where `deleted_at is null`
  - does not inspect or decrypt `ciphertext`
- Added schema guard coverage for the 20-active-record limit migration.
- Remote migration status verified aligned through `20260612121500`.
- Verification passed after the limit migration:

```powershell
npm run test --workspace @vault/mobile -- supabase-schema.test.ts
npm run typecheck --workspace @vault/mobile
supabase migration list --linked
```

All-asset category route slice on 2026-06-12:

- Added shared category configuration:
  - `apps/mobile/src/features/vault/vault-category-config.ts`
  - centralizes asset type, saved-list route, add route, title, empty copy, add label, and item label for every current vault asset class.
- Added reusable saved-category route wrapper:
  - `apps/mobile/src/features/vault/components/vault-category-route.tsx`
  - builds `VaultCategoryList` from the shared config and uses direct permanent delete.
- Added saved-record category routes for all current asset classes:
  - bank accounts, cards, investments, properties, vehicles, insurance, crypto, pensions, loans/debts, subscriptions, document locations, contacts, medical care, dependents/pets, business interests, digital accounts, and other records.
- Updated the Vault dashboard category section to link every populated category to its saved-record category page instead of only bank accounts.
- Updated post-save navigation:
  - standard add forms now route to their matching category page;
  - expanded add forms now use `getVaultCategoryConfig(assetType).routeHref`.
- Applied `screenStyles.formContent` and `keyboardShouldPersistTaps="handled"` to standard add forms and the expanded add-form wrapper to improve long-form scrolling on older Android/iOS screens.
- Generalized category summaries and replaced the mojibake delimiter with ASCII `" - "`.
- Added route/config tests:
  - every configured category has a saved route file;
  - every configured add route exists and either routes directly to the saved page or uses the expanded route wrapper.
- Verification passed:

```powershell
npm run test --workspace @vault/mobile -- vault-category-list-view-model.test.ts vault-dashboard-view-model.test.ts vault-category-routes.test.ts
npm run typecheck --workspace @vault/mobile
```

Android saved-record QA restart attempt on 2026-06-19:

- Preserved the existing uncommitted QA slice.
- Reproduced the Metro startup command issue under local Node `v24.2.0` / npm `11.5.2`.
- Confirmed `npx expo start --dev-client --port 8081` from `apps/mobile` binds successfully to port `8081`.
- Confirmed the failure through `npm run ... -- --port 8081` is npm argument forwarding: Expo receives `8081` as a project path and reports `Invalid project root: ...\\apps\\mobile\\8081`.
- Restored the missing Android toolchain from Google's official SDK repository: command-line tools 21.0, platform/build tools 36, platform-tools 37.0.0, emulator 36.6.11, the Android 36 Google APIs x86_64 system image, and NDK 27.1.12297006.
- Corrected the user-level `JAVA_HOME` to `C:\Program Files\Android\Android Studio1\jbr`, preserved `ANDROID_HOME=C:\Users\shahb\AppData\Local\Android\Sdk`, and added SDK command paths to the user PATH.
- Recreated the `Pixel_7` AVD and verified it completed first boot as an Android 16 `sdk_gphone64_x86_64` device with `adb` status `device` and `sys.boot_completed=1`.
- Installed the existing Expo SDK 56 debug dev-client APK, started Metro on port `8081`, bundled the current JavaScript successfully, and reached the Sanduqkin welcome screen on the emulator.
- Live add/save/card-menu/edit/delete QA used the shared QA account; keep its password transient and outside the repository/handoff.
- Completed live Android bank-account saved-record QA on 2026-06-19:
  - signed in to the shared QA account on the recreated `Pixel_7` emulator;
  - created `QALive0619` and verified the category list changed from `1 of 20 saved` to `2 of 20 saved`;
  - authenticated Supabase API verification showed the newest `bank_account` row stored a 276-character ciphertext value and 32-character nonce with `deleted_at = null`; no plaintext vault fields were selected or exposed;
  - opened the card overflow menu and verified `Edit` and `Delete` actions;
  - edited the title to `QALive0619Edited` and verified the detail screen showed the updated decrypted value locally;
  - verified the first delete action displayed irreversible copy stating that Sanduqkin cannot restore the deleted encrypted record;
  - confirmed `Delete permanently`, after which the list returned to `1 of 20 saved`;
  - final authenticated Supabase API verification returned zero rows for the deleted record id and one remaining active bank-account row, confirming a database hard delete rather than soft hiding.
- The Android 16 Google APIs emulator showed a persistent Gboard physical-keyboard toolbar even with Gboard's `Show toolbar` preference disabled. Disabled the Gboard package for emulator user 0 with `adb shell pm disable-user --user 0 com.google.android.inputmethod.latin`; the toolbar disappeared and hardware/ADB text input continued to work. Re-enable with `adb shell pm enable com.google.android.inputmethod.latin` if the software keyboard is needed later.
- Fresh automated verification passed:

```powershell
npm run test --workspace @vault/mobile -- vault-category-list-view-model.test.ts vault-dashboard-view-model.test.ts vault-category-routes.test.ts vault-store.test.ts vault-session.test.ts permanent-delete-confirmation.test.ts
npm run typecheck --workspace @vault/mobile
```

- Result: 6 test files passed, 28 tests passed, and mobile typecheck exited successfully.

## Vault Bulk Actions Slice Completed 2026-06-21

- Added a page-level three-dot category menu with `Select records` and `Delete all` while preserving each card's existing Edit/Delete menu.
- Selection mode shows the selected count, `Cancel`, accessible record selection controls, and `Delete selected` only when at least one record is selected.
- Card-level menus and add-record actions are hidden during selection mode so record taps only toggle selection.
- `Delete selected` and `Delete all` require a second explicit `Delete permanently` action and state the exact record count, category where applicable, irreversibility, and that Sanduqkin cannot restore the encrypted records.
- Added safe partial-failure handling: successful and failed ids are collected without error text or vault payloads; failed ids remain selected and the UI does not claim full success.
- Added pure test coverage in `apps/mobile/src/features/vault/vault-bulk-selection.test.ts` for selection transitions, deterministic unique ids, confirmation copy, partial failures, and shared UI wiring.
- Split record-card rendering into `apps/mobile/src/features/vault/components/vault-category-record-card.tsx` so the bulk slice did not add a second function-size violation to the Phase 1 guard.
- Android `Pixel_7` QA with the shared test account passed:
  - created two disposable bank records;
  - entered selection mode, selected both, canceled, and verified normal card navigation/actions returned;
  - selected both again, verified `2 selected` and exact irreversible confirmation, then permanently deleted only those two records;
  - confirmed the retained bank record remained and the list returned to `1 of 20 saved`;
  - created two disposable Other records, verified `Delete all 2 records in Other permanently?`, confirmed, and reached the `0 of 20 saved` empty state.
- Authenticated Supabase API verification queried safe metadata only and confirmed one retained `bank_account` row with ciphertext/nonce metadata and zero `other` rows. The disposable rows were hard-deleted; no plaintext vault fields, credentials, tokens, or ciphertext were recorded in this handoff.
- Direct Supabase session-pooler verification on 2026-06-21 confirmed the complete bulk QA audit sequence: four `asset_created` events and four matching `asset_permanently_deleted` events for the same disposable record ids. All four tested ids had zero rows remaining in `vault_assets`. Audit metadata keys were limited to `assetId` and `assetType`; selection/cancel UI state was intentionally not persisted as an audit event.
- Fresh verification passed:

```powershell
npm run test --workspace @vault/mobile -- vault-bulk-selection.test.ts permanent-delete-confirmation.test.ts vault-category-list-view-model.test.ts vault-category-routes.test.ts vault-session-context.test.ts
npm run typecheck --workspace @vault/mobile
```

- Result: 5 test files passed, 15 tests passed, and mobile typecheck exited successfully.
- `npm run check:phase1` still fails only on tracked function-size debt. After extracting the record-card functions it reports 19 functions over the 100-line limit, including the pre-existing shared `VaultCategoryList` violation; no new second violation remains in that file.

## Critical Remaining Phase 1 Gaps

- Real Supabase MFA remains launch-deferred because it is paid. Placeholder TOTP/factor-id paths are not production-valid.
- iOS native verification is blocked in this Windows environment. Needs macOS/Xcode/iOS simulator verification.
- Password reset/recovery MEK rotation and re-wrapping is implemented, unit-verified, and Android/Supabase live-verified for key material and encrypted-asset continuity.
- Resend account approval is pending, so production account-deletion confirmation email cannot be live-verified.
- `npm run check:phase1` still fails on known pre-existing function-size debt.
- Expo SDK audit blocker is mitigated as far as current SDK 56 packages allow: no critical advisories remain, and the residual moderate advisories are upstream `xcode -> uuid` through Expo config tooling.

## Known Technical Debt / Risks

- Emergency access is still Phase 1 foundation UI and storage only. Full beneficiary/claim/release workflow is future Phase 2 and must preserve zero-knowledge design.
- Biometric cached-key startup intentionally does not create unauthenticated Supabase repositories; remote operations require authenticated client handoff from sign-in.
- Route tests must not live under `apps/mobile/app`.
- Avoid logging raw emergency codes, MEK, ciphertext, credentials, Supabase secrets, or raw vault payloads.
- Keep audit metadata free of plaintext vault fields.
- Do not add server-side plaintext vault export/email jobs.
- Do not add plaintext normalized asset-detail tables for vault records while zero-knowledge storage is a product guardrail.
- Metro/Android launch after Expo SDK 56 can be slow when started with `--clear`; avoid clearing cache unless needed. Local Node `v24.2.0` is below the repo engine range `^22.13.0 || >=24.3.0` and should be upgraded for more reliable tooling.

## Session Start Checklist

1. Run `git status --short` and preserve the current uncommitted QA slice.
2. Run focused tests before editing:

```powershell
npm run test --workspace @vault/mobile -- vault-session-context.test.ts emergency-access-route.test.ts supabase-emergency-grant-repository.test.ts sealed-emergency-code-service.test.ts supabase-schema.test.ts
npm run typecheck --workspace @vault/mobile
```

3. For Android QA, start emulator and Metro dev client with the startup notes above. If testing recovery reset by deep link, sign in first or use a real Supabase reset link/session.
4. Continue with one of the remaining external blockers.
5. Update this handoff after every slice.
6. For the vault UX/data hardening track, start from the 2026-06-12 agreed direction above and preserve zero-knowledge storage while improving saved-record UX.
