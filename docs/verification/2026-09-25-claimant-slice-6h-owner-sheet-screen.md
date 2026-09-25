# Claimant Slice 6H owner emergency-sheet screen verification

Date: 2026-09-25 (Asia/Dubai)

## Result

Slice 6H passes local verification on `claude/busy-franklin-xv1jah`, based on `main` at `3c68b57` (Slice 6G merged through PR #96). Scope: `docs/superpowers/specs/2026-09-25-claimant-slice-6h-owner-sheet-screen.md`.

The owner approved the spec and all three decisions:
- add `qrcode-generator`;
- print only, with no PDF or share option;
- automatically revoke a sheet the owner has not confirmed.

## Delivered

- **Production sheet crypto.** Both proof-producer adapters now provide `randomBytes` and XChaCha20-Poly1305 encrypt and decrypt, exported as `offlineCodeV2PlatformSheetCrypto`. The native adapter passes associated data as a string, as the existing vault crypto does, and refuses anything that is not ASCII. The canonical JSON used here is always ASCII, so both platforms work on identical bytes.
- **`checkOfflineCodeV2ReleaseWrap`** (proof core, literal-false approved). It works from the printed material alone, as a claimant would:
  - it re-derives the root;
  - it confirms the sheet's proof key comes from its own secret;
  - it re-derives the wrap key and checks the associated-data digest;
  - it opens the wrap and compares the result with the expected vault key in constant time.

  It returns only a boolean and wipes every derived secret.
- **`owner-offline-code-sheet-factory.ts`.** It is literal-false approved and is now the only importer of the 6F generator. It generates a sheet valid for 365 days, runs the wrap self-check, and returns the sheet and registration inputs without the owner ID or any key.
- **`VaultSession.createOfflineCodeEmergencySheet`.** It passes the in-memory vault key straight to the factory. The key is never part of its inputs, outputs or context types.
- **`owner-offline-code-client.ts`.** It calls the 6G register and revoke routes with:
  - the owner's bearer token;
  - an `Idempotency-Key`;
  - `Origin` set from `EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN`;
  - strict response checks, a 15 s timeout and cancellation.

  It maps 403 to `fresh_mfa_required` and everything else to a generic failure.
- **`owner-sheet-flow.ts`.** A state machine:
  - `idle → generating → registering → ready_to_print → printing → printed → done`;
  - `needs_fresh_mfa` and `verifying_mfa` for step-up, which retries with the same idempotency key;
  - `failed`.

  The sheet stays inside the controller. The exposed state holds only the status, the expiry and two flags. Late results after an abandon are ignored.
- **Automatic revocation.** Any sheet whose registration was attempted is revoked, best effort, and dropped from memory when:
  - the owner leaves the screen, backgrounds the app or locks the vault before confirming;
  - generation or registration fails after a registration attempt.

  JavaScript strings cannot be zeroed, so "wiped" here means every reference is dropped.
- **`owner-sheet-html.ts`.** It uses `qrcode-generator` 2.0.4 (MIT, no dependencies; the production audit is clean) to render an inline SVG QR code of the `SKQ2.` payload at error-correction level M. Around it:
  - the printed locator and secret for reference, with HTML escaped;
  - the expiry date;
  - next-of-kin steps that name the claimant screen's actual title;
  - a warning to keep the sheet safe.

  There are no scripts and no external resources.
- **`owner-sheet-runtime.ts`.** A literal-false launch constant makes the handle null before anything is created. Public variables are read as literal `process.env.EXPO_PUBLIC_*` so that Expo inlines them. Step-up uses the owner's verified TOTP factor through the existing `totp-verify-service`, then refreshes the session. Printing uses `expo-print` `printAsync` only.
- **`owner-sheet-view-model.ts` and `owner-emergency-sheet-panel.tsx`.** The panel blocks screen capture. It requires two confirmations: one before creating a sheet, and a print check before confirming the print. It handles abandonment on unmount, app-state changes and vault lock.
- **New route `app/settings/emergency-sheet.tsx`, plus a "Printed Emergency Sheet" card on the Emergency access screen.** The card renders only when the handle is non-null. In the normal app it is hidden and the route shows "Emergency sheets aren't available yet."
- **Isolation.**
  - The sheet-generator check now allows exactly the factory as an importer.
  - A new `scripts/claimant-owner-emergency-sheet-isolation-check.cjs`, with its test, is wired into `package.json` and security CI. It requires:
    - both literal-false constants;
    - the self-check, screen-capture blocking and abandonment;
    - that the vault session passes its own key and is the only caller of the factory.

    It forbids:
    - storage, files, sharing, `printToFileAsync`, the clipboard, logging and `Math.random` in any 6H module;
    - vault-key names in the flow, client, HTML, runtime, view model and panel;
    - app routes reaching past the handle.

## Deviation from the spec, recorded

The spec said backgrounding abandons the sheet. On Android the system print dialog backgrounds the app, and the owner must switch to an authenticator app to read a TOTP code. Either would cancel a sheet mid-flow. So backgrounding abandons in every state except `printing`, `needs_fresh_mfa` and `verifying_mfa`, and even then only the app-state trigger is skipped. A long absence still locks the vault, a lock always abandons, and leaving the screen always abandons. This is covered by tests.

## Evidence

- **Factory: 5 tests.**
  - Disabled by default; no IDs are drawn.
  - A real self-checked sheet re-opens from the printed material, and a different vault key does not open it.
  - A corrupted wrap is refused, and so is a proof key not derived from the sheet's own secret.
  - A short vault key and an invalid owner ID are refused.
- **Flow and client: 11 tests.**
  - The whole path runs, and the state never contains `SK2-` or `SKQ2`.
  - Step-up keeps the same idempotency key.
  - Abandonment revokes from every live state, including an in-flight registration whose late result is ignored.
  - A generation failure registers nothing, a registration failure revokes, a print error allows a retry, and a revoke failure is swallowed.
  - The app-state rule holds.
  - The client sends exactly the registration with the right headers, and nothing else. It sends an empty revoke body, maps 403 and every other failure correctly, and handles timeout and cancellation.
- **Presentation and composition: 6 tests.**
  - The printed QR SVG equals `qrcode-generator`'s rendering of exactly the payload, and the payload does not appear as text.
  - Text is escaped.
  - The view covers every state.
  - The handle is null by default and when configuration is missing.
  - TOTP step-up rejects a bad code format, an unverified factor and a failed verification, and refreshes the session only after success.
- **API acceptance: 2 new tests** (5 in the file).
  - The real owner flow (factory, self-check, client, flow, HTML) registers through the actual 6G route. The claimant finds the sheet by its printed locator, and the claimant proof producer's proof verifies through the actual proof route.
  - Abandoning after printing but before confirmation revokes through the actual route, and the claimant then receives only a decoy.
- **Mutation checks.** Setting launch approval to true, adding a `console.` call to the flow, and importing the client from a route each failed the new isolation check. All were reverted.
- **Workspace tests:** 1,639 passed, with three established skips (6G's 1,615 plus 24 new). **Serial script tests:** 297 passed.
- **Other checks.** Typechecks, zero-warning lint and coverage thresholds pass. Security, Phase 1, mobile-secret and production-dependency checks pass, as do all claimant isolation checks, including the new one. The web build passes.
- **Expo Doctor.** In this sandbox, Doctor fails three checks with "unexpected error" because `npm explain` fails here. It fails identically on untouched `main`, so 6H did not cause it. CI runs Doctor on a clean runner.
- **Phase 1 fix.** The flow controller was split into an internal core and its public methods to meet the 100-line function limit. Behaviour is unchanged, and every test passes after the split.

## Not verified here

- **A phone camera scanning the printed QR code.** The printed QR is shown to be the library's exact encoding of the payload, but no QR decoder was run on it. Camera scanning arrives with 6I, which is where a real scan belongs.
- **Printing on a physical device.** It needs a native build with the feature enabled.

## Known limitations carried forward

- There is no list of existing sheets, so only the sheet from the current session can be revoked. A "my emergency sheets" slice needs a small owner list route.
- The generator requires the synthetic KDF profile.
- The grant ID is not yet linked to a real release grant.
- The `Origin` header is a configuration check, not a security boundary, for native clients.
