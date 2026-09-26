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
