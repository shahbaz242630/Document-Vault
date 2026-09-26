# Slice 6I — claimant camera QR scanner

Proposed on 2026-09-26, after Slice 6H merged through PR #98 at `18e451f`. Approved by the owner on 2026-09-26, including the native camera dependency and both decisions below. This is the next step named in the 6H spec and in the 6F–6H session close.

## Gap

The owner can now print an emergency sheet whose QR code carries the `SKQ2.` payload (6H). The claimant screen, `app/claim/offline-code`, still takes that payload as pasted text (6E). Nobody can paste it, though: the payload exists only inside the printed QR code. The printed locator and secret are shown for reference, and they cannot rebuild the sheet, because the KDF profile and the record binding are only in the QR. So the claimant route has no real way in until the app can scan the QR with the camera.

## Scope

1. **Dependency.** Add `expo-camera` `~56.0.8`, the SDK 56 line (MIT). Its `CameraView` scans barcodes on the device through the platform scanner, so no image is uploaded or saved. Its only dependency is `barcode-detector` (with `zxing-wasm`), which is used on web only. On Android it bundles Google ML Kit barcode scanning; on iOS it uses AVFoundation. Because it is a native module, a new native build is needed.

2. **App config** (`app.json` plugins):
   ```json
   ["expo-camera", {
     "cameraPermission": "Allow Sanduqkin to use the camera to scan the QR code on an emergency sheet.",
     "microphonePermission": false,
     "recordAudioAndroid": false
   }]
   ```
   The app asks for the camera only. No microphone or audio permission is added on either platform. The probe builds inherit the plugin, and no probe code imports the camera.

3. **Scan handler** (`src/features/claimant-journey/claim-sheet-scan.ts`). This is pure logic with no React or camera import, so it can be tested directly.
   - It accepts QR results only. Other barcode types are ignored.
   - It **locks on the first QR that starts with `SKQ2.`**. Later frames are ignored until the flow returns to `sheet_not_recognised`, so a camera held over the sheet cannot trigger two claims.
   - A QR that does not start with `SKQ2.`, or is longer than the codec's 4,096-character limit, is dropped without a message and scanning continues. This stops an unrelated QR code on the table from flashing an error.
   - It passes the raw string straight to `flow.submit` and keeps no copy. The string is never logged, stored, put on the clipboard or shown on screen.

4. **Scanner view** (`src/features/claimant-journey/claim-sheet-scanner.tsx`). This is the only file that imports `expo-camera`.
   - It uses `CameraView` with `barcodeScannerSettings: { barcodeTypes: ["qr"] }`, the back camera and no capture, recording or photo API.
   - **Permission.** It asks for the camera only when the claimant taps "Scan the QR code", never on app start. If permission is refused, the screen explains how to allow it and offers an "Open Settings" button (`Linking.openSettings`). Nothing else changes.
   - **Mounted only while useful.** The camera is mounted only while the flow is `ready` or `sheet_not_recognised`, the app is in the foreground and the screen is focused. It is unmounted as soon as one sheet is read and stays unmounted during `checking` and after any result, so the camera light goes off straight away. This also matters because `CameraView` keeps its last scan event in memory for de-duplication; unmounting releases it.
   - **Screen protection.** The claim screen blocks screenshots and screen recording through `expo-screen-capture`, as the 6H owner screen does. The camera preview shows the sheet, and the sheet holds the secret.

5. **Claim screen** (`claim-flow-panel.tsx` and `claim-flow-view-model.ts`).
   - The paste field is replaced by the scanner: a "Scan the QR code" button, then the camera view with a framing guide and one line of help ("Hold the emergency sheet flat, with the QR code inside the frame.").
   - New view states for the camera: `needs_permission` and `permission_denied`. The claim flow's own states are unchanged.
   - `sheet_not_recognised` keeps its current message and offers "Scan again". The camera does not reopen by itself, so a bad code held in view cannot loop.
   - In the normal app the handle is still null. The screen shows "Claiming with an emergency sheet isn't available yet", no camera is mounted and **no permission prompt can ever appear**.

6. **Static isolation.** A new check, `check:claimant-sheet-scanner-isolation`, is wired into security CI. It requires:
   - `expo-camera` imported only by `claim-sheet-scanner.tsx`, and that file imported only by `claim-flow-panel.tsx`;
   - no photo, recording or capture API (`takePictureAsync`, `recordAsync`, `launchScanner`, media library), no clipboard, storage or logging in the scanner, handler or panel;
   - the scanned value reaching nothing except `flow.submit`;
   - the microphone and audio-recording permissions switched off in the plugin config;
   - the paste field removed.

   No earlier check covered the claim screen's contents, so none needed changing.

## Acceptance

- **Printed sheet to started claim.** An acceptance test builds on the 6H acceptance harness:
  1. The owner flow generates, registers and "prints" a sheet through the actual 6G routes.
  2. The test takes the QR module matrix from `qrcode-generator` (the same call the printed SVG uses), draws it as pixels and decodes it with a QR decoder.
  3. The decoded text goes through the scan handler into the real claim flow.
  4. The claimant proof verifies through the actual challenge and proof routes, and the flow ends in `claim_started` with the value-free draft.

  This proves that the QR actually printed is readable and carries a working sheet, with no hand-built payload anywhere in the chain.
- **Scan handler.**
  - A non-QR barcode, a foreign QR, an over-long QR and a second frame after a lock are each ignored.
  - A malformed `SKQ2.` value moves the flow to `sheet_not_recognised` and unlocks the handler.
  - The same sheet scanned twice in quick succession starts exactly one claim.
- **Camera lifecycle.** With a mocked `CameraView`, rendered on the server because the repo has no DOM test environment:
  - the camera is rendered only when access is granted and the screen is focused and in the foreground;
  - it scans QR codes only, with the back camera, and has no capture or recording props;
  - a scan event after the handler is closed does nothing.

  The panel unmounts the scanner as soon as a sheet is read, and the isolation check pins that line.
- **Permission.**
  - The camera is requested only after the tap.
  - When refused, the screen shows the Settings route and makes no network call.
- **Disabled by default.** With the normal inert bootstrap, the route shows "unavailable". No camera component is rendered and no permission request is made.
- **No leaks.** The scanned string appears in no log, storage call, snapshot, view model or request body except the existing proof request, which is unchanged from 6E.
- **Checks.** These all pass, and CI is green:
  - workspace tests, typechecks and lint;
  - the security audit and all isolation checks;
  - Expo Doctor and the web build;
  - the Android and iOS native builds, because a native module is added.

## Evidence that needs a phone (owner-held)

CI cannot point a camera at paper. After merge, the real test needs an internal development build on a physical iPhone and an Android phone, pointed at the synthetic staging setup, with the claimant switches on only in that build:
- print a synthetic sheet from 6H and scan it on paper, both in normal light and in dim light;
- scan it from a second phone's screen;
- scan it with the sheet at an angle.

An EAS build needs your go-ahead. This step belongs in the first staging wiring phase, not in this slice.

## Owner decisions (approved 2026-09-26)

1. **Remove the paste field. Approved.** No real claimant can use it, because the payload is never printed as text. It also invites people to paste the secret into chats or notes. The alternative is to keep it hidden as a developer-only fallback.
2. **Add a QR decoder as a dev-only dependency. Approved.** `jsqr` (Apache-2.0, no dependencies) is used in tests only and never ships in the app. It lets the acceptance test prove that the printed QR decodes, rather than trusting the encoder. Without it, the test hands the encoded string straight to the handler and skips that step.

## Known limitations, recorded and not solved here

- **A damaged or unreadable QR has no manual fallback.** The locator and secret on the sheet cannot rebuild the payload. A later option is to print the `SKQ2.` text in small type as a backup, for typing or for OCR. It is about 400 characters, so it is not practical to type. The practical fallback is for the owner to print a new sheet.
- **Everything stays synthetic.** The KDF profile is still the synthetic one; a production Argon2id profile is its own item.
- **Web.** The mobile web target gets the camera through the browser's `BarcodeDetector` polyfill. It is not a supported claimant surface, and the route shows "unavailable" there too.

## Later slices

- A "my emergency sheets" list with revoke, which needs a small owner list route (owner-approved, next).
- The reviewer-model slice. The owner confirmed on 2026-09-26: Shahbaz Malik is the only human who approves a release; Claude runs automated pre-checks that inform his decision but is never a reviewer or approver; one-human review is backed by a cooling-off period, a dispute window and a full audit trail.
- The wiring phases that move the claimant side from synthetic and offline to staging, and then to production.

## Non-goals

- Server or migration changes.
- A PDF or text fallback.
- A production KDF profile.
- EAS or TestFlight builds.
- Deployment, real data and activation.
