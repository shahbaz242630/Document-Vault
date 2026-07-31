# Biometric Unlock Observation

Date: 2026-07-31 (Asia/Dubai)

Status: Android repair verified; physical-iOS build 6 verification failed and remains under diagnosis.

## Scope

Observe the current Android emulator behavior when the vault is locked and the user presses `Unlock`. Preserve enough evidence to distinguish a missing handler, a native biometric failure, and an unavailable app/device state.

## Environment

- AVD: `Pixel_7`
- Android API: 36
- Package: `com.sanduqkin.mobile`
- Client: freshly rebuilt debug development client from current `main`
- Account: disposable authenticated test account; no credentials retained in this record

## Starting State

- The authenticated Settings page displayed `Biometric unlock`.
- Its status text was `No biometrics are enrolled on this device.`
- Android `dumpsys fingerprint` reported fingerprint enrollment count `0`.
- Android `locksettings get-disabled` returned `true`.
- The Settings biometric title/status was not a clickable control.
- Because `available && enrolled` was false, the component did not render `Enable biometric unlock`.

## Controlled Reproduction

1. Pressed the vault footer `Lock` action.
2. Confirmed the lock overlay displayed `Sanduqkin is locked`.
3. Cleared Logcat immediately before the unlock attempt.
4. Pressed the lock overlay `Unlock` button once.
5. Captured the post-tap UI, Metro event count, and filtered Android logs.

## Observed Result

- The tap reached the JavaScript lock handler.
- The UI immediately displayed:

  `Biometric unlock is not enabled. Please sign in again.`

- Metro recorded zero new events during the attempt.
- Logcat recorded no `BiometricPrompt`, fingerprint authentication, `expo-local-authentication`, keystore authentication, or app-specific native biometric activity.
- No native prompt was attempted.

## Current Diagnosis

This Android attempt is not failing inside the native biometric prompt. The handler stops at the app-local prerequisite:

1. `AppLockOverlay.handleUnlock()` calls `biometricStorage.isEnabled()`.
2. `isEnabled()` reads the SecureStore key `biometric_unlock_enabled`.
3. The key is not `true`, so the handler sets the visible error and returns.
4. `biometricStorage.getKey()` is never called, so the authenticated SecureStore read and native biometric prompt never begin.

The emulator app data was deliberately cleared while repairing the stale development-client session before this observation. That reset removed the app-local biometric-enabled flag and cached biometric MEK. Separately, the current AVD reports no enrolled fingerprint and has its lock screen disabled. These conditions explain the Android result and prevent this run from reproducing the reported iOS regression.

## Code References

- `apps/mobile/src/features/auth/components/app-lock-overlay.tsx`
  - `handleUnlock()` checks the enabled flag and returns before reading the cached key.
- `apps/mobile/src/features/auth/biometric-storage.ts`
  - `BIOMETRIC_ENABLED_KEY = "biometric_unlock_enabled"`
  - `MEK_KEY = "biometric_mek_cache"`
  - the cached key requires authentication.
- `apps/mobile/src/features/auth/components/biometric-preferences-panel.tsx`
  - `canEnable` requires both hardware availability and biometric enrollment.
  - the enable button is omitted when `canEnable` is false.

## Conclusion And Stop Point

The Android behavior currently observed is expected for a device with no enrolled biometric and an app whose biometric SecureStore state was reset. It does not yet establish the cause of the physical iOS no-prompt regression.

No code, device biometric enrollment, SecureStore flag, or cached biometric key was changed as part of this diagnosis.

## Follow-Up Implementation And Verification

Later on 2026-07-31, the owner authorized the biometric repair.

### Root defects repaired

1. The onboarding biometric screen authenticated the user and set `biometric_unlock_enabled`, but it never copied the current vault MEK into the authenticated `biometric_mek_cache` item. A device could therefore report biometric unlock as enabled while `Unlock` had no protected key item to read and no native prompt to invoke.
2. Startup called `getKey()` before the user pressed `Unlock`. Because that SecureStore item requires authentication, startup could request native interaction too early, create an apparent missing prompt on the button, or cause duplicate prompt behavior.
3. The lock overlay handled its own storage calls instead of the tested app-lock service and did not distinguish disabled, missing-key, cancellation, unavailable-native, storage-read, and unexpected authentication failures.
4. The lock screen told users to use a password but offered no password action.

### Changes

- Onboarding now uses `createBiometricPreferenceService` with `createMekStorage`, so it caches the current MEK before marking biometric unlock enabled.
- Startup now checks only the non-authenticated enabled flag. It sets the vault to locked and defers the authenticated key read until the explicit unlock press.
- The overlay now uses `createAppLockService`; the authenticated SecureStore read owns the single unlock prompt.
- Storage cancellation, biometric-unavailable, missing-key, settings-read, and generic failures map to actionable UI messages.
- The overlay checks for a live Supabase session before remote vault restoration.
- The lock screen now offers `Use password instead`, which clears the in-memory lock session and routes to sign-in.

### Android live verification

- Configured a secure emulator lock screen and enrolled one synthetic emulator fingerprint.
- Settings changed from `No biometrics are enrolled` to an enabled `Enable biometric unlock` action.
- Enabling biometric unlock completed and Settings reported `Enabled on this device.`
- Pressing `Lock` displayed the lock overlay without an early biometric prompt.
- Pressing `Unlock` displayed the native `Unlock Sanduqkin` fingerprint prompt.
- Emulator fingerprint authentication succeeded; Logcat recorded `onAuthenticated(true)` for `com.sanduqkin.mobile`.
- The encrypted dashboard and vault coverage restored successfully.
- The same in-process lock/unlock cycle passed again after password re-authentication.
- On a cold development-client process restart, no prompt appeared before the unlock press. Because the app intentionally does not persist a Supabase login session across that restart, remote restoration stopped with the password fallback rather than treating biometric possession as Supabase authentication.

### Automated verification

- Focused biometric/startup tests passed.
- Full mobile suite: 108 test files passed, 3 skipped; 400 tests passed, 3 skipped.
- Repository-wide typecheck passed.
- Repository-wide lint passed.

### Remaining platform gate

Android emulator verification is green. On 2026-07-31, the owner tested TestFlight build 6 on a physical iPhone and reported that biometric unlock still did not work. This falsifies the earlier working assumption that the merged repair plus a fresh native build would resolve the iOS regression.

The owner then clarified that the tapped control was the `Biometric unlock` row/card in Settings and that tapping it produced no error or transition. Source inspection confirms that the row is rendered as a plain `View` containing `Text`; it has no `onPress` handler and is not an accessibility button. Only the conditional `Enable biometric unlock` and `Disable biometric unlock` controls are pressable. A tap on the row therefore cannot invoke Face ID and intentionally produces no log or visible error under the current implementation.

This confirms a Settings interaction/affordance defect. It does not by itself prove that the protected-key unlock action on the lock screen fails on iOS. Physical-iOS Face ID verification remains incomplete until the user can enable the preference through an actionable control and then test `Lock` -> `Unlock`.

No physical-device console log has yet been captured. After the Settings interaction defect is repaired, the next diagnostic must distinguish these pre-prompt and post-prompt states before iOS biometric readiness is claimed:

1. `biometric_unlock_enabled` is absent or false;
2. `biometric_mek_cache` is absent or its authenticated Keychain read fails;
3. Face ID is not authorized/enrolled for Sanduqkin;
4. Face ID succeeds but the Supabase session has expired;
5. Face ID succeeds and session restoration begins, but vault initialization fails.

The Windows Android run cannot prove iOS Keychain/Face ID behavior. Claiming iOS biometric readiness remains blocked until a physical-device run captures the visible error and, where possible, an Xcode device-console trace.
