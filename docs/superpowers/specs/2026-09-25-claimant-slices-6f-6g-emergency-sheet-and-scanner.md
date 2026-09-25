# Slices 6F and 6G — owner emergency-sheet generation and claimant QR scanner

Proposed on 2026-09-25 for owner approval. Not yet authorized for coding. It builds on Slice 6E (PR #94, merged at `1fcb816`), which added the `SKQ2.` sheet codec and the claimant screen `app/claim/offline-code`.

The work ships as two sequential PRs:
- **6F** lets the owner generate, register and print the emergency sheet.
- **6G** lets the claimant scan the sheet with the camera. It adds a native dependency, so it needs a new build.

## Starting point (what exists today)

- **No production code lets an owner create offline-code V2 material.** The full derivation exists only in the Node test-vector generator, `scripts/claim-vector-generator/offline-code-v2-vector.mjs`. It generates the locator, secret and salt, then derives the commitment, the Argon2id root, the Ed25519 proof key, the binding digest and the wrapped MEK.
- **The database can already register and revoke locators.**
  - The tables and functions exist: `claimant_register_offline_code_v2_locator` and `claimant_revoke_offline_code_v2_locator`.
  - They are callable only by the service role, only through a literal-false API service (`offline-code-v2-persistence-service.ts`), and no route is mounted for them.
  - The server must derive the locator index digest itself (an HMAC with a server key), so the owner's device cannot register directly.
- **Every layer accepts only the synthetic KDF profile** `argon2id-synthetic-test-v2`: the validators, the `production_approved: false` type, and the table and function checks.
- **No QR generator, camera library or camera permission exists in the app.** `expo-print` is already installed, but it is used only for the vault PDF export.
- **Owner emergency access today is the older V1 sealed code** (`app/settings/emergency-access.tsx`). The trusted-person screen says "Setup is not available yet".

Nothing in 6F or 6G makes the feature reachable for real users. Every new path follows the existing pattern: a literal-false approval flag, a route with no navigation entry, and an "unavailable" state in the normal app. Production activation stays with the later launch slice.

## Slice 6F — owner emergency sheet: generate, register, print

### 1. Owner sheet generator (mobile)

- **Location:** `apps/mobile/src/features/claimant-offline-code/owner-sheet/`. This path sits inside the existing offline-code isolation allowlist. The generator ships with its own literal-false flag, `OWNER_EMERGENCY_SHEET_APPROVED = false`.
- **Inputs:**
  - the unlocked vault MEK, through a narrow accessor on the vault session (the MEK itself is never passed around);
  - the owner user ID;
  - an injected crypto adapter backed by `react-native-libsodium`: Argon2id, HKDF-SHA256, Ed25519 seed keypair, XChaCha20-Poly1305 and random bytes.
- **Steps.** These mirror the vector generator exactly, and are pinned by the existing fixture vector:
  1. Generate a fresh locator (16 bytes), secret (24 bytes), KDF salt (16 bytes), `locator_record_id` (v4 UUID) and `grant_id` (v4 UUID).
  2. Derive the commitment, the Argon2id root, the proof keypair, the record binding and its digest, and the wrap key.
  3. Wrap the MEK with XChaCha20-Poly1305, using the canonical associated data.
- **Outputs.** There are exactly two:
  - a **registration request**, which holds only what the server stores: record ID, owner, commitment, grant, proof public key, binding digest, salt, wrap nonce, ciphertext, associated-data digest, validity window and an idempotency key;
  - the **`SKQ2.` sheet text**, from the 6E encoder.
- **Secret handling:**
  - The root, the proof private key, the wrap key and the secret are wiped from their byte buffers after use.
  - Nothing is persisted, logged or placed in state snapshots.
  - Errors are generic.
- **Acceptance:** a sheet generated with a deterministic test RNG must match the fixture vector byte for byte. It must also round-trip through the claimant's existing proof core, which must accept it.

### 2. Owner registration and revocation routes (API)

- **Routes:** `POST /owner/offline-code/v2/locators` and `POST /owner/offline-code/v2/locators/:recordId/revoke`.
- **Controller:** owner-authenticated, taking the owner ID from the verified session and never from the request body. It sits behind a new literal-false flag, `OWNER_OFFLINE_CODE_V2_REGISTRATION_APPROVED = false`.
  - While the flag is false, the routes are mounted but return the same generic "unavailable" response the other claimant routes use.
- **Register:**
  1. Validate the request strictly.
  2. Derive the locator index digest on the server with the existing boundary indexer.
  3. Call the existing `register` service method.
  4. Return only `{ locatorRecordId, expiresAt }`.
- **Revoke:** calls the existing revoke with reason `owner_revoked`, and only for the caller's own record.
- **One sheet per owner:** registering a new sheet revokes the previous active one in the same transaction.
  - This needs a small migration: a transactional "register and revoke previous" function, or a partial unique index on one active locator per owner. The approach will be chosen during implementation and recorded in the verification record.
- **No change** to the synthetic-only table checks or to the KDF profile.

### 3. QR rendering and print

- **QR encoder:** `qrcode-generator` 2.0.4 (MIT, no dependencies, pure JS), used to produce an inline SVG string.
- **QR settings:**
  - byte mode, error-correction level M;
  - the payload is about 1,632 characters, which gives roughly QR version 33 (about 149 modules);
  - print width at least 9 cm, so each module is about 0.6 mm, with a 4-module quiet zone.
- **Sheet HTML template.** Everything is escaped, and there is no external content. It contains:
  - the title and short instructions for the next of kin (install Sanduqkin, choose "I have an emergency sheet", scan the code);
  - the QR code;
  - the locator and secret, printed in grouped monospace for reference;
  - the creation date and the expiry date (at most 365 days, set by the database);
  - a "keep this safe — anyone holding this sheet can start a claim" warning.
- **Printing:**
  - Printing uses `Print.printAsync({ html })` only. The system print dialog also offers "Save as PDF" if the owner wants a file.
  - The app does not call `printToFileAsync` or the share sheet, so no PDF containing the secret is left in the app's cache.

### 4. Owner screen

- **Route:** `app/settings/emergency-sheet.tsx`, reached by direct route only, with no navigation entry.
- **Access:** it uses a narrow handle supplied through context, the same pattern as 6E. The screen does not name the V2 contract types, so the existing isolation checks hold unchanged.
- **States:** unavailable (always, in the real app), ready, generating, registering, ready to print, registration failed, and revoked.
- **Behaviour:**
  - A re-authentication step is required before generating, using the existing `settings/re-auth` flow.
  - `usePreventScreenCapture()` is active while the sheet preview is shown.
  - The sheet text is dropped from memory when the owner leaves the screen or the app goes to the background.
  - "Replace sheet" warns that the old sheet will stop working, then revokes it and registers a new one.
  - "Revoke sheet" is available on its own.

### 6F acceptance

- The generator matches the fixture vector. Its output is accepted by the claimant proof core, and the server can register it and complete a challenge and proof against it (the in-process database model from 6D).
- The routes are owner-authenticated. An owner ID in the request body is ignored. Cross-owner revoke is rejected generically. With the flag false, every route returns "unavailable".
- A second registration revokes the first.
- The print HTML is snapshot-tested: escaped, no external URLs, and the QR decodes back to the exact sheet text (decoded in tests with a dev-only decoder).
- The normal app shows "unavailable". The launch controls stay false/false/engaged.
- Standard gates:
  - workspace tests, typechecks and lint;
  - all claimant isolation checks, with any change limited to the new owner-sheet paths and flags;
  - security/audit, Expo Doctor, the web build and the API bundle;
  - CI on the exact head, using a PR watcher.

## Slice 6G — claimant camera QR scanner

### 1. Dependency and native configuration

- **Dependency:** `expo-camera` ~56.0.8, the SDK-56 line, maintained by Expo. It has built-in barcode scanning, so no separate scanner library is needed.
- **Config plugin, in `app.json`:**
  - iOS camera usage string: "Sanduqkin uses the camera to scan the QR code on an emergency sheet."
  - The microphone permission is disabled, and so is Android audio recording.
- **New native build:** prebuild, the Android compile gate, and the iOS and Android emulator smoke tests in `security-ci.yml`. The production audit and Expo Doctor must stay clean.

### 2. Scanner screen

- **Placement:** add a "Scan emergency sheet" step to `app/claim/offline-code`. It uses `CameraView` with `barcodeScannerSettings: { barcodeTypes: ["qr"] }`.
- **Scan handling:**
  - Scanning stops on the first result.
  - A result that does not start with `SKQ2.` is shown as "This isn't a Sanduqkin emergency sheet", and the text is discarded.
  - A valid-looking result goes straight to `flow.submit(text)`. It is never shown on screen, never stored in state and never logged.
- **Fallbacks:**
  - The existing paste field stays available on web, and when camera permission is denied (with a link to Settings).
  - A torch toggle helps with dense codes in low light.

### 3. App-state closing and permission prompts

The 6A bootstrap closes the claimant runtime for the rest of the session on `"inactive"` as well as `"background"`. On iOS, the camera permission prompt makes the app `"inactive"`, so the first scan attempt would close the flow permanently.

Proposed fix:
- Request camera permission **before** the claimant runtime is used. The scan step asks for permission while the flow is `ready`, when no secret is held and no request is in flight.
- The bootstrap then treats `"inactive"` as closing only while a claim step is in flight or claim state is held. `"background"` always closes, as it does today.

This is a narrow change to the 6A semantics. 6G adds fault-injection cases for it to the 6C suite.

### 6G acceptance

- Scanning a 6F-printed sheet on a physical iPhone and a physical Android device reaches "claim started" in a synthetic test build. This is recorded as device evidence in the verification record.
- The scan handler rejects non-`SKQ2.` codes generically and never displays or stores the payload.
- Denied permission falls back to the paste field.
- The permission prompt does not close an idle flow. Backgrounding closes it at every step. An `"inactive"` transition during an in-flight step still closes it.
- The normal app is unchanged: no handle, and the screen shows "unavailable".
- The same standard gates as 6F, plus the green native compile and smoke jobs.

## Decisions for the owner

1. **Approve the split** into 6F (owner sheet) and then 6G (scanner), as two PRs.
2. **One active sheet per owner**, with replacement revoking the old one. Recommended.
3. **Print only, no saved PDF inside the app.** Recommended; the system dialog still allows "Save as PDF".
4. **The 6A `"inactive"` change in 6G**: close on inactive only while a claim step is in flight. Recommended. The alternative keeps today's rule and has the scanner work around it, which gives a worse first-scan experience on iOS.
5. **Sheet expiry** stays at the database maximum of 365 days, with a later reminder to re-print. Recommended.

## Non-goals

These stay out of scope:
- a production KDF profile, and lifting the synthetic-only checks;
- navigation entries, and activation or launch-policy changes;
- hosted MFA, production native custody and signing;
- email or other reminders to re-print;
- other claimant screens, deployment and real data.

These are left to later slices, including the launch slice that turns everything on together.
