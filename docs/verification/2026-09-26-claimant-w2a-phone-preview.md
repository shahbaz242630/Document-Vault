# Staging wiring W2a verification — the emergency-sheet path in the Sanduqkin Preview app

Date: 2026-09-26. Built on W1 (PR #103, `53c3d40`). Scope: `docs/superpowers/specs/2026-09-26-claimant-w2-phone-preview.md`. The owner approved it on 2026-09-26 with all five recommended decisions: split W2, a custom domain, a separate Preview app, a build workflow, and the sheet-check screen.

## What changed

- **Server.**
  - `POST /owner/session/activate` sits next to the owner routes, behind the same gate: the approval constant or the claimant Preview, plus `offlineCodeV2`. It requires:
    - the exact owner origin and API origin;
    - a bearer token for a fresh AAL2 session with no recovery;
    - a UUID idempotency key;
    - an empty body.
  - It calls the existing `claimant_activate_session` with the caller's own user ID, session ID and MFA time, and returns only `session_version` and `replayed`. A retry with changed input returns 409.
  - The owner-routes isolation check pins it.
- **Mobile owner side.**
  - `owner-offline-code-client.ts` gains `activateSession()`.
  - The app activates after the sign-in TOTP check (`totp-verify-panel.tsx` calls `activateOwnerClaimantSessionAfterMfa`) and after every fresh-TOTP step-up in the print and list flows. Failures are silent and fail-closed.
  - The owner gates live in `owner-sheet-launch.ts`: `OWNER_SHEET_FLOW_LAUNCH_APPROVED || isClaimantPreviewBuild()`. The sheet factory uses `OWNER_OFFLINE_CODE_SHEET_APPROVED || isClaimantPreviewBuild()`. Both constants are still `false as const`.
- **Preview app.**
  - The `claimant_preview` target in `app.config.js` has its own name ("Sanduqkin Preview"), scheme, bundle ID and package (`com.sanduqkin.mobile.claimantpreview`), and the `claimantPreviewBuild` marker.
  - `app.config.js` refuses `EXPO_PUBLIC_CLAIMANT_PREVIEW_BUILD` under any other target, and refuses the target under the `production` EAS profile.
  - `isClaimantPreviewBuild()` needs the inlined switch and the marker together. The marker is read from `expo-constants` in native code only; web and tests never have it.
  - The new EAS profile is `claimant-preview`: internal distribution, with an APK for Android and ad hoc for iOS, and no secrets.
- **Claimant sheet check.**
  - A Preview-only "Check an emergency sheet" screen (`app/claim/check-sheet.tsx`) reuses the 6I camera scanner.
  - It runs one possession check through the existing lifecycle, coordinator, transport and on-device proof. The chain's constants are unchanged; the Preview build passes `approved` in.
  - It shows only "This sheet is valid", "This sheet can't be used" or "Something went wrong, try again". It starts no claim and stores, logs or shows no sheet material.
  - The entry row on Emergency access appears only in the Preview app.
  - A new isolation check, `claimant-sheet-check-isolation-check.cjs`, pins all of this. Two existing checks each allow exactly this one new user: the lifecycle check allows `sheet-check-runtime.ts`, and the scanner check allows `sheet-check-panel.tsx`.
- **Hosting.**
  - `preview-api.sanduqkin.com` is attached to `sanduqkin-api` for the `claimant-preview` branch. It waits for the owner's DNS record.
  - The manual workflow `claimant-preview-build.yml` runs from `main` with the `Release` environment and only queues an EAS build.

## Evidence

- **Hosted acceptance, run from the session** against the claimant-preview deployment of commit `59a99cb`: 11 of 11 checks pass. Both synthetic owners are now activated through the real `/owner/session/activate` route, not the service-only shortcut. The rest is as in W1: print, list and revoke with fresh TOTP, owner isolation, the decoy, possession proof, and concealment. Cleanup then left 0 users, 0 sheets and 0 challenges.
- **Local:**
  - typecheck, lint and Expo Doctor are clean;
  - workspace tests: 1,744 passed, with the 3 established skips (mobile 953, API 427);
  - the security check, the Phase 1 size check and the GitHub Actions check pass;
  - every security-CI `node --test` set passes serially (217, 51, 8, 8 and the smaller sets).

## Pending (owner-held), then recorded here

1. **DNS.** At the registrar for `sanduqkin.com`, add a CNAME `preview-api` → `cname.vercel-dns.com`. Then switch `OFFLINE_CODE_V2_API_ORIGIN` for the `claimant-preview` branch to `https://preview-api.sanduqkin.com`, redeploy, and rerun the acceptance with `CLAIMANT_PREVIEW_API_ORIGIN` set to the same value.
2. **First build credentials.**
   - **Android:** run `eas credentials` once for `com.sanduqkin.mobile.claimantpreview`, because EAS won't create a keystore non-interactively.
   - **iOS:** register the test phone with `eas device:create`.
3. **Build.** Actions → "Claimant Preview app build" → run on `main`, choosing `android`, with the confirmation `claimant-preview`.
4. **Phone evidence:**
   1. Install the Preview app.
   2. Sign in with a synthetic owner and TOTP.
   3. Print a sheet.
   4. List it.
   5. Print and revoke a second one.
   6. On a second phone, "Check an emergency sheet" on the live sheet: "valid".
   7. Check the revoked sheet: "can't be used".
   8. Run the cleanup, which should report 0.

## Not covered, and why

- **Claim start (W2b).** Claimant sign-in, the claimant portal session, the claim-screen runtime, the sheet-key handoff signer, and the handoff routes on Preview.
- **The sheet check's network adapter** (`expo/fetch`, needed for streaming response bodies) and its outcome classification are proved with fakes and the real libsodium producer in tests. They still need the phone run above. A wrong claimant origin or a badly wrong phone clock would show "can't be used" rather than "try again".

## Follow-up fix (2026-09-29): device clock tolerance

- **Found by** the owner's first local acceptance run on a Windows laptop. Owner print, list, revoke, isolation and the decoy passed, but the claimant proof step failed with "Offline-code proof production is unavailable". After an NTP sync the laptop was still about 1 second behind (`w32tm` offset +0.975 s).
- **Cause.** The device-side checks in `offline-code-v2-proof-core.ts` (`bindChallenge`) and `offline-code-v2-coordinator.ts` (`time`) had zero tolerance. They refused a challenge whenever the device clock was even a millisecond before the server's `issued_at`. A claimant phone that runs slightly slow would therefore get "This sheet can't be used" for a valid sheet.
- **Fix.** Both checks now accept a device clock up to 2 minutes slow or fast (`OFFLINE_CODE_V2_CLIENT_CLOCK_SKEW_MS = 120_000`), and the coordinator's retry-expiry timer allows the same margin. The server still stamps and enforces the real 5-minute window, so security is unchanged.
- **Evidence.**
  - The hosted acceptance, run with this machine's clock shifted 5 seconds slow, **failed on the old code** at exactly the owner's step, after the same 7 passing checks. On the fixed code it **passed 11 of 11**.
  - With the clock 60 seconds fast, the run stopped earlier at the harness's own TOTP sign-in: the test tool derives its codes from the shifted clock, and Supabase rejects codes that far off. The fast-clock case is covered by unit tests instead.
  - New unit tests accept a device clock up to 2 minutes slow or fast, and still reject anything beyond that. They cover both the producer and the coordinator.
  - Existing boundary tests moved to the new limits.
  - Cleanup reported 0 leftovers.

## Owner's local rerun on Windows (2026-09-29, after PR #105)

Run by the owner on a Windows laptop against `main` at `d85ef55`, using the owner's own tokens. The laptop clock was still about 1 second behind the server, as in the failing run.

- Env guard: PASS (`sanduqkin-api`, `sanduqkin-web`).
- Hosted catalog: PASS (48 migrations applied; 0 catalog violations).
- **Hosted acceptance: PASS, 11 of 11:**
  1. `/health`;
  2. two synthetic owners with TOTP, activated through `/owner/session/activate`;
  3. two sheets registered through the 6H flow;
  4. both listed as active;
  5. revoke after a fresh TOTP;
  6. owner 2's isolation;
  7. a decoy for the revoked sheet;
  8. claimant possession proof;
  9. concealment on the Preview;
  10. concealment on another preview;
  11. concealment on Production.
- Cleanup dry run: 0 users, 0 sheets, 0 challenges.
- **Note:** `npm install` reported 8 moderate advisories. No audit fix was run. The production dependency audit in CI stays clean for high and critical findings, and the moderate ones are covered by Dependabot PR #97, which is waiting on the owner.

## Phone access correction (2026-09-29)

- **DNS is done.** The owner added the CNAME `preview-api` → `cname.vercel-dns.com` in Hostinger. Vercel verified the domain for `claimant-preview` and issued a certificate (`cert_ric5bcwytw9SJzVzvhGLfPK0`).
- **Still behind the login.** From the owner's laptop, `https://preview-api.sanduqkin.com/health` returned a 302 to the Vercel login: standard protection covers preview custom domains, and the Hobby plan has no exceptions.
- **Fix (owner decision): a dedicated bypass in the Preview build only.** The new `withClaimantPreviewBypass` is covered by tests: the header is added only in the Preview build with a well-formed value, and the original fetch is returned untouched otherwise. The isolation check pins its three users and that the value is never in `eas.json` or read anywhere else. The Preview app's API URL is now the branch alias.
- **Local checks:** typecheck, lint, 1,748 workspace tests (3 established skips), the security, mobile-secret and Phase 1 checks, and every security-CI script set pass.

## MFA blocker fix (2026-10-01)

**Found by** the owner's local run of the Android Preview build (EAS build `fd5ef07e-1719-406f-88a6-402fc2595053`, source `5edc637`, profile `claimant-preview`, Pixel 7 emulator on Android 16).
- Password sign-in and vault unlock worked, and Emergency access opened with the Preview options.
- "My emergency sheets" failed to load, including on retry.
- "Create and print sheet" reached the fresh-TOTP prompt, but the owner had no matching authenticator entry.

**Causes, confirmed in the code at `5edc637`:**
1. The enrolment screen was a placeholder. It drew no QR code, never called `mfa.enroll`, and moved on with the literal factor ID `placeholder-factor-id`. Re-authentication and the sign-up resume routes used the same placeholder.
2. Password sign-in returned `vault-unlock` without reading the MFA state. Every owner therefore stayed at AAL1, and the owner claimant session, which is activated only after a TOTP check, was never activated.
3. The sheet list turned every refusal into the same "Check your connection" failure.

**Sheet-list diagnosis on the hosted Preview.** It was run separately, through the app's own client, against the live `claimant-preview` deployment at `5edc637`, with a synthetic owner:
- with a password-only session (AAL1), the list returns **403**;
- with an AAL2 session whose claimant session was never activated, it returns **401**;
- after the TOTP check and `/owner/session/activate`, it returns **200**.

A password-only sign-in therefore cannot load the list. That matches the emulator, though the emulator's own requests were not captured. The tested account's server-side factor state was not read: reading account rows on the shared project is outside what these sessions do.

**What changed:**
- **Sign-in.** After the password, the app reads the assurance level and the factors. A verified factor sends the owner to TOTP verification with its real ID. No verified factor sends them to a required enrolment. The MFA state being unreadable stops sign-in. The vault unlocks only after TOTP passes: the unlock waits in memory only, for at most ten minutes, and is used once (`pending-sign-in.ts`).
- **Enrolment.** It uses the real `mfa.enroll`. The QR code is drawn on the device from the `otpauth` URI with the existing `qrcode-generator` package, and the setup key is shown for typing by hand. Screen capture is blocked. The real factor ID is passed on. An existing account goes straight to proving a code; sign-up keeps its order.
- **After every successful TOTP check** (sign-in, enrolment, step-up), the owner claimant session is activated with the session token that check raised (`completeTotpVerification` → `activateOwnerClaimantSession`).
- **Sheet list.** A 403 or 401 asks for a TOTP step-up, which also re-activates the session, then loads once more. A second refusal, an unreachable server and a server failure each show their own message.
- **Re-authentication** uses the real factor and never passes without one.

**Not changed:**
- MFA enforcement stays as it was: AAL2, fresh TOTP for printing and revoking, and session activation.
- Every claimant production approval constant is still literal false. No account factor was reset or removed.
- No setup key, otpauth URI, password or code is logged, stored or put in a route.

**Evidence (cloud session, 2026-10-01):**
- **Hosted acceptance PASS, 12 of 12**, including the new list-assurance check. Cleanup removed 3 synthetic users, and a dry run then reported 0.
- **Tests:** 1,776 workspace tests pass (3 established skips). The new ones cover:
  - sign-in routing;
  - enrolment, including a QR decode round trip with `jsqr`;
  - the pending unlock;
  - the verify → activate → unlock order;
  - the list step-up against a simulated server through the real runtime handle;
  - activation with the post-TOTP token.
- **Other checks:** lint, typecheck, coverage thresholds, Phase 1 size limits, the security, mobile-secrets and GitHub Actions checks, and every claimant isolation check pass.
- **Failing on `main` too, not caused by this change:**
  - `check:production-dependencies`: new advisories for `next` (critical), `minimatch` and `brace-expansion`, all through `apps/web`;
  - Expo Doctor: patch versions newer than the lockfile, `expo` 56.0.23 and `expo-constants` 56.0.27.

**Owner rerun:** rebuild the Preview APK from the merged `main`, then follow the steps in `docs/handoff/2026-10-01-claimant-preview-mfa-fix-session-close.md`.

## Owner emulator rerun after the MFA fix (2026-10-01): owner-reported

This was reported by the owner's local Claude Code session. It was **not observed independently** by the cloud session, and these are emulator results, not physical-device evidence.

- **Setup:** EAS build `1b00c951-8f04-4c02-b3e5-e09891d4650e` from commit `cf86de4`, profile `claimant-preview`, on a Pixel 7 emulator with Android 16.
  - `npm ci` passed locally on Node 24.19.0 with npm 11.17.0.
  - The old Preview app was uninstalled and the new APK installed; the APK checksum matched the downloaded build.
- **Second lock:** the owner added the authenticator and the PIN, and the unlocked vault dashboard appeared.
- **Sheet list:** "My emergency sheets" loaded, empty at first.
- **First sheet:** the owner generated a sheet and saved its PDF; the sheet later showed as **Revoked**. The code confirms a likely cause, not reproduced on the device: the 6H flow revokes any sheet that isn't confirmed as printed when the owner leaves or backgrounds the screen. The PDF-first spec addresses this.
- **Second sheet:** after repeating the flow, the list shows a new **Active** sheet and the earlier **Revoked** one. The PDF was saved in the emulator's Downloads folder.
- **Tapping the Active sheet** does not open it.
- **Still pending:**
  - an explicit revoke with a fresh TOTP;
  - the live and revoked sheet checks from a second device;
  - the second sign-in ("Second lock" with no QR code);
  - physical-device evidence;
  - the cleanup.

Next: `docs/superpowers/specs/2026-10-01-claimant-owner-sheet-pdf-first.md` (awaiting approval).
