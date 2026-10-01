# Claimant Preview MFA fix session close — 2026-10-01

This is the current checkpoint and the opener for the next session. It supersedes `2026-09-29-claimant-w2a-phone-access-session-close.md`, which is still the reference for the Preview setup. The owner's laptop also has a local note, `2026-09-29-claimant-preview-local-setup-session-close.md`, which is not in the repository.

**Where this lives:** branch `claude/inspiring-fermat-bbdlaf`. It carries the code, the verification and these docs together, and also the 2026-09-29 close-out (`fb0077d`), which was not on `main` yet.

## What was wrong

The owner's emulator run of the Preview APK (EAS build `fd5ef07e-1719-406f-88a6-402fc2595053`, source `5edc637`) hit three problems:
- the sheet list never loaded;
- printing asked for a TOTP code the owner had no authenticator entry for;
- the app had never really enrolled a second factor. The enrolment screen was a placeholder (`placeholder-factor-id`), and password sign-in went straight to the vault at AAL1, so the owner claimant session was never activated.

On the hosted Preview, the sheet list returns 403 for a password-only session and 401 for an AAL2 session that was never activated. Details and evidence are in `docs/verification/2026-09-26-claimant-w2a-phone-preview.md`, under "MFA blocker fix".

## What changed (mobile only; no server, schema or approval change)

- **Sign-in:**
  - After the password, the app reads the account's MFA state.
  - A verified factor goes to TOTP verification with its real ID. No verified factor goes to a required enrolment. An unreadable state stops sign-in.
  - The vault opens only after TOTP passes. The unlock waits in memory only, for 10 minutes at most.
- **Enrolment:**
  - It uses the real `mfa.enroll`, draws the QR code on the device, and shows the setup key for typing by hand.
  - Screen capture is blocked.
  - The real factor ID is used throughout.
- **After every successful TOTP check,** the owner claimant session is activated with the session token that check raised.
- **Sheet list:**
  - A 403 or 401 asks for a TOTP step-up, which re-activates the session, then loads once more.
  - Failures now say which problem it is: the session, the connection, or the server.
- **Re-authentication** uses the real factor and never passes without one.
- **Sign-up resume** restarts an interrupted enrolment instead of using a placeholder factor.
- **Hosted acceptance** has a 12th check: the list's answer at each step of an owner's sign-in.

## Lockfile fix for newer npm (2026-10-01)

The owner's laptop could not run `npm ci`. Newer npm (11.21) requires every optional platform package in the lockfile, and the lockfile on `main` lists only two of rolldown's platform builds. It was also missing `fsevents` and the `@emnapi/*` packages they need. 17 entries were added, with no version changes and nothing removed; the extra `react-native-worklets` entry under `expo` was kept as npm 10 installs it. `npm ci` passes on a clean clone with npm 10.9.4, 11.4.2 and 11.21.0. Use Node 22.13 or later (CI and EAS builds use Node 24.3.0).

## Rebuild and test (owner)

1. **Get a build with this change. Either:**
   - **after merge:** Actions → "Claimant Preview app build" on `main`, choosing `android`, with the confirmation `claimant-preview`; or
   - **from the branch, on the laptop:**
     ```
     git fetch origin && git checkout claude/inspiring-fermat-bbdlaf
     cd apps/mobile && npx --yes eas-cli@21.0.0 build --platform android --profile claimant-preview
     ```
2. **Install it.** Uninstall the old Sanduqkin Preview APK from the emulator (`adb uninstall com.sanduqkin.mobile.claimantpreview`), then install the new APK from the Expo build page (`adb install <file>.apk`, or drag it onto the emulator).
3. **Sign in** with the same test account (email and password). What happens next tells you the account's server-side state:
   - **"Add your second lock"** with a QR code: the account has no verified factor (the expected case).
     1. Scan the QR code with an authenticator app on your phone, pointing it at the emulator window, or type the setup key into the app.
     2. Tap "I've added it", enter the current 6-digit code, and tap "Verify and open vault". The vault opens.
   - **"Second lock" asking for a code:** the account already has a verified factor. If you have no matching authenticator entry, stop there. Don't reset anything: tell Claude, and we'll pick a supported route.
4. **Emergency access → My emergency sheets** should load straight away, with an empty list or your sheets.
   - If it asks for a code instead, enter one. It should then load.
   - If it shows "couldn't be reached", the app can't reach the API (check the bypass variable in the EAS `preview` environment).
   - If it shows "session couldn't be confirmed", sign out and sign in again.
   - Note which message appears either way.
5. **Create and print sheet:**
   1. Enter a fresh code when asked.
   2. Print the sheet (or save it as a PDF), then confirm.
   3. Check that it appears in the list.
   4. Print and revoke a second one; the revoke asks for a fresh code.
6. **Optional, with a second device:** "Check an emergency sheet" with each sheet. The live one should say "valid"; the revoked one, "can't be used".
7. **Clean up afterwards:**
   - run the synthetic cleanup until it reports 0;
   - delete the "Sanduqkin Preview app" Vercel bypass and its EAS variable;
   - rotate the Supabase and Vercel tokens.

## Emulator rerun and next step (2026-10-01)

Owner-reported, on the emulator, from build `1b00c951` at `cf86de4`:
- the second lock and the vault both work;
- the sheet list loads;
- the first sheet saved as a PDF ended up Revoked, because the print flow revokes unconfirmed sheets;
- a second sheet is Active, and tapping it does nothing.

The full record is in the W2a verification file.

The owner asked for a PDF-first flow, with viewing and saving again later. The spec is `docs/superpowers/specs/2026-10-01-claimant-owner-sheet-pdf-first.md`. It was **approved with decisions 1–5 and built**; there is no server or schema change.

## PDF-first rebuild and rerun (owner, emulator)

The hosted acceptance (12 of 12) and the tests already cover the server side:
- creating a sheet without it being revoked;
- a revoke from the sheet's screen after a fresh TOTP;
- the live and revoked claimant checks;
- owner isolation.

What's left needs the app on the emulator.

1. **Build:**
   ```
   git fetch origin && git checkout claude/inspiring-fermat-bbdlaf && git merge --ff-only origin/claude/inspiring-fermat-bbdlaf
   npm ci
   cd apps/mobile && npx --yes eas-cli@21.0.0 build --platform android --profile claimant-preview
   ```
2. **Install:** `adb uninstall com.sanduqkin.mobile.claimantpreview`, then `adb install <apk>`. Uninstalling removes any old sheet copies; the old Active sheet then shows "no copy on this device".
3. **Sign in.** It should show "Second lock" with a code and no QR code; this is the pending second sign-in check.
4. **Settings → Emergency access → "Create an emergency sheet":**
   1. Tick the acknowledgement, then tap "Create emergency sheet", and enter a code if asked.
   2. It should show "Sheet XXXXXX is active…".
   3. Tap "Save PDF", pick **Downloads**, and confirm. Expect "PDF saved — Saved as Sanduqkin-emergency-sheet-XXXXXX.pdf in Download".
   4. Cancel the picker once: expect "Not saved. Your sheet is still active." with no new sheet.
   5. Leave the screen. The sheet must stay Active.
5. **My emergency sheets:**
   - The old sheets show their status badges.
   - Tap the new sheet, then "View sheet": the QR code and both codes appear.
   - "Save PDF" saves the same file again.
   - Force-stop the app (`adb shell am force-stop com.sanduqkin.mobile.claimantpreview`), reopen it, sign in, and view and save again. It must be the same reference and QR code.
6. **The old Active sheet** (made before this change) should say "This device doesn't have a copy". Use the "⋯" menu, then "Revoke sheet…", then confirm, then enter a fresh code. It shows Revoked, and the new sheet stays Active.
7. **Optional, with a second device:** "Check an emergency sheet" on the new PDF should say valid; on a revoked one, "can't be used".
8. **Record the results** in the W2a verification file as owner-reported.


## Session close (2026-10-01, evening): where we stopped

- **Code:**
  - Branch `claude/inspiring-fermat-bbdlaf` at `96c3a35`, pushed. It holds every commit of this session: the MFA fix `20859a6`, the lockfile fix `cf86de4`, the spec and the rerun record `662b45f`, and PDF-first sheets `96c3a35`.
  - **No PR is open yet.** `main` and `claimant-preview` are still at `5edc637`, so the hosted Preview runs the old server code. That's fine: no server change was needed.
- **Build:** the owner started the `claimant-preview` Android build of `96c3a35` from the laptop. It is **queued on EAS** because the plan's build limit was reached, and should finish overnight. Its build ID isn't recorded yet.
- **Installed on the emulator:** still build `1b00c951` (`cf86de4`, the MFA fix), with one Revoked and one Active sheet from the old print flow. Neither old sheet has a copy on the device.
- **Hosted state:** the synthetic cleanup reported 0 after the last acceptance run. No hosted setting changed this session.
- **Owner-held:**
  1. When the build finishes, run "PDF-first rebuild and rerun" above (the laptop session has the full message).
  2. Then send the results to the cloud session.
  3. Cleanup and token rotation only when the owner says testing is finished.
- **Open decisions for the owner:**
  - whether to fix the two checks that are red on `main` (dependency advisories, Expo patch versions) in this PR or separately;
  - then the PR itself (auto-merge when green, as before).

## Open items

- **CI on `main` is red for two reasons this change doesn't cause:**
  - `check:production-dependencies` reports new advisories for `next` (critical), `minimatch` and `brace-expansion`, all through `apps/web`;
  - Expo Doctor wants `expo` 56.0.23 and `expo-constants` 56.0.27.

  Both need the owner's go-ahead (dependency bumps; Dependabot PR #97 is held on the owner's word). Until then the auto-merge-when-green rule can't fire.
- **Suggested separately (security):**
  - the vault tables' RLS doesn't require AAL2, so MFA is enforced only by the app;
  - the backup-code screen shows fixed sample codes.
- **Carried forward:** W2b claim-start spec; iOS device registration; Supabase Pro; EDGE-01 to EDGE-03; the email provider; legal review; the App Store.

## Next-session opener

> Continue the Sanduqkin claimant work in `shahbaz242630/Document-Vault` on branch `claude/inspiring-fermat-bbdlaf`, which should be at `96c3a35` or later. Read `docs/handoff/2026-10-01-claimant-preview-mfa-fix-session-close.md`: "Session close (2026-10-01, evening)" first, then "PDF-first rebuild and rerun". Also read `docs/superpowers/specs/2026-10-01-claimant-owner-sheet-pdf-first.md` and the last two sections of `docs/verification/2026-09-26-claimant-w2a-phone-preview.md`.
>
> The PDF-first Preview APK was queued on EAS overnight. Ask me for its build ID and the laptop's emulator results:
> - the second sign-in;
> - create and Save PDF to Downloads, including a cancelled save;
> - view and save again after a force-stop;
> - the revoke with a fresh code;
> - the optional second-device check.
>
> Record them as owner-reported and fix anything that failed. Then ask whether to fix the dependency advisories and the Expo patch versions in this PR, and open the PR with auto-merge when green. After that comes the W2b claim-start spec.
