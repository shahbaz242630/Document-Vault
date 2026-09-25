# Slice 6H — owner emergency-sheet screen: generate, register, print

Proposed on 2026-09-25 after Slice 6G merged through PR #96 at `3c68b57`. Awaiting owner approval before coding. It is the next step named in the 6F and 6G specs. The reviewer decision stays open and is taken before go-live.

## Gap

The server can now register and revoke a sheet (6G), and the device can generate one (6F). The owner still has no way to do either from the app. Three pieces are missing:
- **No way to reach the vault key.** The vault key lives only inside `VaultSession`'s closure, and nothing passes it to the sheet generator.
- **No production crypto for sheets.** The generator's randomness and XChaCha20 wrap exist only in tests.
- **No QR code or print path.** The app has no QR library, no owner client for the 6G routes and no screen that prints a sheet.

## Scope

1. **Production sheet crypto.** Both proof-producer adapters gain the two primitives the generator adds: `randomBytes` and `xchacha20poly1305Encrypt`.
   - `offline-code-v2-proof-producer.ts` uses libsodium-wrappers-sumo.
   - `offline-code-v2-proof-producer.native.ts` uses react-native-libsodium, which exports `randombytes_buf` and `crypto_aead_xchacha20poly1305_ietf_encrypt`.
   - `crypto_aead_xchacha20poly1305_ietf_decrypt` is added as well, for the wrap self-check in step 3.
   - No new crypto dependency is needed.

2. **Vault session method** (`vault-session.ts`): `createOfflineCodeEmergencySheet(input)`. It follows the existing sealed-emergency-code pattern:
   - it passes the in-memory vault key straight into the generator;
   - the key never appears in the method's inputs, outputs or public types (`Omit<..., "mek">`);
   - it is guarded by a new literal-false constant, `OWNER_OFFLINE_CODE_SHEET_APPROVED`, and fails generically while that constant is false.

3. **Owner sheet flow controller** (`src/features/claimant-offline-code/owner-sheet-flow.ts`). This folder is already allowed to import the proof producer. It runs one sheet from start to finish:
   1. **Generate.** It generates through the vault session, with fresh `expo-crypto` `randomUUID()` values for the record and grant IDs and a 365-day validity.
   2. **Self-check.** It re-opens the wrap on the device with the derived wrap key and confirms that the vault key comes back unchanged. This is the check the 6G spec promised; a sheet that fails it is never registered or printed.
   3. **Register.** It registers through the owner client (step 4) with one idempotency key, and retries only with that same key.
   4. **Print.** It hands the sheet to the print step (step 5).
   5. **Confirm.** It waits for the owner to confirm the sheet printed correctly, then wipes the sheet from memory.
   - **If the flow is abandoned after registration and before confirmation** (the owner leaves, the app goes to the background or locks, or signs out), it revokes that sheet through the 6G revoke route, best effort, and wipes it from memory. An unconfirmed sheet must not stay live.
   - **States:** `idle → generating → registering → ready_to_print → printed → done`, plus `needs_fresh_mfa` and `failed`. Each failure shows one generic message.
   - **No storage and no logging.** The sheet, secret and payload are never stored in SecureStore, AsyncStorage or files, and never logged.

4. **Owner registration client** (`owner-offline-code-client.ts`).
   - It sends `POST` requests to the 6G register and revoke routes at `EXPO_PUBLIC_API_URL`, with:
     - the owner's Supabase access token as a bearer token;
     - `Content-Type: application/json`;
     - an `Idempotency-Key`;
     - the configured owner origin, a new `EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN`, as the `Origin` header.
   - It checks the response strictly (`locator_record_id`, `status`, `replayed`).
   - It maps 403 to `needs_fresh_mfa` and everything else to a generic failure.
   - It has a 15-second timeout and aborts when cancelled.

5. **Fresh MFA step-up.** The 6G route requires MFA from within the last 10 minutes. On `needs_fresh_mfa`, the screen asks for a TOTP code through the existing `totp-verify-service`, refreshes the session and retries registration with the same idempotency key. This is the first owner-side step-up in the app, so it is kept inside this flow.

6. **QR rendering and printing.**
   - **QR code.** A new dependency, `qrcode-generator` (2.0.4, MIT, no dependencies), renders the `SKQ2.` payload as an inline SVG string at error-correction level M.
   - **Printing.** `expo-print` `printAsync` prints an HTML sheet with no temporary PDF file. The sheet shows the QR code, the printed locator and secret for reference, the expiry date, and plain-language instructions for the next of kin.
   - **No file sharing.** `printToFileAsync` and the share sheet are deliberately not used, so the secret never lands in a PDF, in cloud storage or in another app.
   - **Screen protection.** The screen blocks screenshots through `expo-screen-capture`, as `emergency-access-screen.tsx` already does.

7. **Screen and entry point.**
   - A new route, `app/settings/emergency-sheet.tsx`, opened from a new "Print an emergency sheet" row on the existing Emergency access screen.
   - The row appears only when the flow handle is non-null. In the normal app the handle is null because of the literal-false constants, so the row is hidden and the route shows "Emergency sheets aren't available yet." This is the same inert pattern as 6E.

8. **Static isolation.**
   - **Sheet generator check.** Instead of "no importer at all", it allows exactly one importer: the vault session method.
   - **New 6H check**, wired into security CI. It requires:
     - the literal-false constants;
     - no storage, logging or `printToFileAsync` / `shareAsync` in the flow, client or screen;
     - the key never crossing the vault-session boundary;
     - the screen importing only the flow handle, never the generator, crypto or client.

## Acceptance

- **The owner's flow feeds the claimant.** With an approved synthetic handle and a fake server built on the real 6G routes and the 6G acceptance store, the flow generates, self-checks, registers and "prints" a sheet. The printed QR payload decodes to the same `SKQ2.` sheet, and the claimant proof producer's proof for it verifies through the actual challenge and proof routes.
- **Wrap self-check.** A deliberately corrupted wrap fails the self-check, and nothing is registered.
- **Step-up.** A 403 moves the flow to `needs_fresh_mfa`. After TOTP it retries with the same idempotency key.
- **Abandonment revokes.** Background, lock, sign-out or leaving the screen before confirmation each revoke the registered sheet and wipe it. The rendered HTML contains the secret only in the print call, never in state that outlives the screen.
- **No leaks.** The vault key never appears in any output, prop, log or request body. Requests carry no secret or payload.
- **Disabled by default.** The normal app hides the entry, the route shows "unavailable", and no crypto, network or print call is made.
- **Dependency.** `qrcode-generator` passes the production dependency audit.
- **Checks.** Workspace tests, typechecks, lint, security and all isolation checks, Expo Doctor and the web build pass, and CI is green (including the Android and iOS native builds, because the native crypto adapter changes).

## Decisions needed from the owner

1. **Approve adding `qrcode-generator`.** It is the only new dependency, has no dependencies of its own, and is pure JavaScript, so no native rebuild is needed for it.
2. **Print only, no PDF or share option.** This is recommended for secrecy. The cost is that the owner cannot save a copy to print elsewhere later.
3. **Auto-revoke an unconfirmed sheet.** This is recommended. The alternative is to leave it live and rely on the owner revoking it manually.

## Known limitations, recorded and not solved here

- **No list of existing sheets.** 6G has no list route, so the app can revoke only the sheet created in the current session. A "my sheets" list with revoke is a later slice that needs a small server route.
- **Everything stays synthetic.** The generator requires the synthetic KDF profile. Real use waits for an approved production Argon2id profile.
- **Grant IDs.** The grant ID is still not linked to a real release grant (carried over from 6G).
- **The `Origin` header is a configuration check, not a security boundary, for native clients.** The real authority is the fresh AAL2 owner session.

## Later slices

- **6I:** the claimant camera QR scanner (a native dependency and a new build).
- A "my emergency sheets" list with revoke, which needs a small owner list route.

## Non-goals

Server or migration changes, the claimant scanner, a production KDF profile, hosted MFA configuration, deployment, real data and activation.
