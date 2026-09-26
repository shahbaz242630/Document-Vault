# Staging wiring W2 — the emergency-sheet path on real phones against the claimant Preview

Proposed on 2026-09-26, after W1 merged through PR #103 at `53c3d40`. Awaiting owner approval.

## Why

W1 proved the owner and possession routes on the hosted Preview, driven from Node. Next the same path has to run on a real phone: an owner signs in, prints a real sheet and revokes one, and a phone camera scans a printed sheet and proves possession. W1 also left one gap. The owner routes require an active claimant session control, and the app has no way to create one.

## What the research found

- **Owner side: nearly ready.** Sign-in with password and TOTP exists (`app/auth/*`). The 6H print screen and the 6J list screen exist. They are closed by `OWNER_SHEET_FLOW_LAUNCH_APPROVED` and `OWNER_OFFLINE_CODE_SHEET_APPROVED`, and they need `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN`.
- **The missing owner step.** Nothing in the app activates the owner's claimant session control. The only route that does, `/claimant/session/activate`, needs the `registeredRecipient` capability, which stays off on Preview. Without it, every owner request gets 401.
- **Claim start on a phone is much bigger than it looked.** Scan → prove → start a claim passes through about 15 literal-false gates. It also needs three things that don't exist yet:
  1. **Claimant sign-in.** The app has none, and the handoff needs an AAL2 claimant portal session.
  2. **A real claim-screen runtime.** The bootstrap passes no runtime at all, so the claim screen is inert even with every gate open.
  3. **A handoff signer.** The server verifies the handoff with the Ed25519 key derived from the printed sheet. The `native-signing-boundary` expects a hardware key and no module implements it, so the signer has to use the sheet-derived key instead.

  The handoff routes also have no Preview override.
- **Phones can't reach the Preview today.** Vercel Authentication protects every `sanduqkin-api` preview except on custom domains. The API has no custom domain; production uses `sanduqkin-api.vercel.app`.
- **This session can't make phone builds.** There are no Expo, Apple or Google credentials here. `EXPO_TOKEN` exists only in the GitHub `Release` environment.

## Proposal: split W2

- **W2a (this spec): the owner on a phone, and the sheet proved from a phone.**
- **W2b (next spec): claim start.** It covers claimant sign-in, the claimant portal session, the claim-screen runtime, the sheet-key handoff signer, and the handoff routes on Preview.

## W2a scope

1. **Owner session activation route.** A new route, `POST /owner/session/activate`, sits next to the 6G/6J owner routes, behind the same gate: the approval constant or the claimant Preview, plus `offlineCodeV2`. It requires:
   - the exact owner origin and API origin;
   - a bearer token for a fresh AAL2 session with no recovery;
   - a UUID idempotency key;
   - an empty body.

   It calls the existing `claimant_activate_session` with the session's own user ID and session ID and its MFA time, so there is no schema change. The W1 acceptance switches from the service-only shortcut to this route.
2. **App calls it after MFA.** When a TOTP verification finishes, the app calls the route if the owner-sheet handle is available, in both of these places:
   - `verify-totp`;
   - the fresh-MFA step inside the print and list flows.

   Failure is silent and fail-closed: the sheet screens then show "unavailable".
3. **A separate Preview app, set at build time.**
   - **A new build target, `claimant_preview`, in `app.config.js`.** It has its own name ("Sanduqkin Preview"), bundle ID and package (`com.sanduqkin.mobile.claimantpreview`), and scheme, so it can never be uploaded as, or replace, the real app.
   - **The gate.** `isClaimantPreviewBuild()` is true only when `EXPO_PUBLIC_CLAIMANT_PREVIEW_BUILD=synthetic-only` was inlined at build time **and** the app runs under that bundle ID. The two owner gates become `CONST || isClaimantPreviewBuild()`, and the constants stay literal false.
   - **Build-time refusal.** `app.config.js` refuses to build if the variable is set under any other target, or under the `production` EAS profile.
4. **A new EAS profile, `claimant-preview`.**
   - Internal distribution, EAS environment `preview`, Android APK plus iOS ad hoc.
   - It sets the build target, the gate variable, the API URL, the owner origin and the claimant origin.
   - It has no secrets: the Supabase URL and publishable key are already public app config.
5. **Claimant "check a sheet" on a phone (Preview build only).**
   - The existing 6I camera scanner is reused on a small Preview-only screen, "Check an emergency sheet". It scans the QR code, then runs the existing offline-code V2 client, which includes the challenge, the on-device Argon2id/Ed25519 proof, and the proof submission.
   - It shows only "This sheet is valid" or "This sheet can't be used". It starts no claim and stores nothing.
   - The existing literal-false gates on that client path get the same `|| isClaimantPreviewBuild()` form. The full claim screen stays closed until W2b.
6. **Reaching the Preview from a phone.** See decision 2.
7. **Checks and evidence.**
   - Isolation checks allow exactly the new gate form and pin:
     - the build-target and bundle-ID pairing;
     - the production refusal;
     - that the check screen never reaches the handoff.
   - The hosted acceptance gains the activation route.
   - Phone evidence (owner-run, with your help) goes in the verification record:
     1. install the Preview app on Android (and iOS if a device is registered);
     2. sign in as a synthetic owner with TOTP;
     3. print a real sheet;
     4. list it;
     5. revoke a second one;
     6. scan the printed live sheet on a second phone ("valid");
     7. scan the revoked one ("can't be used").
     8. Afterwards, the cleanup reports 0.

## Acceptance

- **Production app unchanged.** A `production` build, or any build without the Preview variable or under another bundle ID, keeps every gate closed. The build refuses the variable outside `claimant_preview`.
- **Activation route.**
  - It returns 404 everywhere except the activated Preview.
  - It rejects a stale MFA, AAL1, a recovery session or a wrong origin.
  - It binds the caller's own session only.
- **Hosted acceptance.** It passes using the real activation route.
- **Phone.** The evidence list in scope item 7 is complete, with screenshots that show no secret values.
- **Checks.** Workspace tests, typechecks, lint, the security and isolation checks, Expo Doctor and full CI all pass, including the Android and iOS native builds.

## Owner decisions (recommendations in bold)

1. **Split W2 into W2a (owner and sheet check on phones) and W2b (claim start).** Claim start needs claimant sign-in, a new runtime and a signer rework, and should be reviewed on its own. The alternative is one large W2.
2. **Reach the Preview through a custom domain:** for example, `preview-api.sanduqkin.com` attached only to the `claimant-preview` branch.
   - **Why it works.** Vercel protection already exempts custom domains, so phones connect with no secret in the app.
   - **What it exposes.** Everything outside W1/W2a still returns 404, and the owner routes need an MFA session.
   - **What it needs from you.** One DNS record at your registrar.
   - **The alternative** is to put the Vercel automation bypass into the internal build. That's simpler, but anyone with the APK could extract a secret that opens *every* `sanduqkin-api` preview.
3. **A separate "Sanduqkin Preview" app, not a flag in the real app.** It can't be shipped by mistake and sits next to the real app on a phone. The alternative is a flag in the normal app build.
4. **Builds: you run `eas build --profile claimant-preview` on your machine, or I add a manual GitHub workflow that uses the `EXPO_TOKEN` already in the `Release` environment.** I recommend the workflow, restricted to the `claimant-preview` branch. Either way, Android comes first. iOS needs your phone's UDID registered for ad hoc builds.
5. **The claimant "check a sheet" screen, in the Preview build only.** It proves the printed-sheet camera, KDF and proof path on a real phone now, without waiting for W2b. The alternative is to leave claimant phone evidence to W2b.

## Non-goals

- Claim start, claimant sign-in, the claimant portal session, the handoff routes and the signer. These are W2b.
- Any change to the production app, the production API or production variables.
- App Store or Play Store submission of the Preview app.
- Real owners, real claimants or real documents.
