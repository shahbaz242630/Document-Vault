# Slice 6I verification — claimant camera QR scanner

Date: 2026-09-26. Branch: `claude/handoff-review-72h2i9`, based on `main` at `18e451f` (PR #98). Scope: `docs/superpowers/specs/2026-09-26-claimant-slice-6i-camera-qr-scanner.md`, approved by the owner on 2026-09-26 with both decisions (remove the paste field; add `jsqr` for tests only).

## What changed

- **Dependencies.**
  - `expo-camera` `~56.0.8` in `@vault/mobile`. It pulls in `barcode-detector` and `zxing-wasm` for web only.
  - `jsqr` `1.4.0`, exact version, as a dev dependency of `@vault/api` (tests only).
  - The lockfile was written with npm 11.4.2, the version CI's Node 24.3.0 ships.
- **App config.** The `expo-camera` plugin now has its own camera explanation, with `microphonePermission: false` and `recordAudioAndroid: false`. Expo's introspected config confirms:
  - iOS gains `NSCameraUsageDescription` only, with no microphone string;
  - Android gains `android.permission.CAMERA` only, with no `RECORD_AUDIO`;
  - the library's own manifest declares only `CAMERA`.
- **Mobile.** Four files in `src/features/claimant-journey/`:
  - `claim-sheet-scan.ts` is the one-shot scan handler: QR only, `SKQ2.` only, at most 4,096 characters, closable.
  - `claim-sheet-scanner-view-model.ts` covers the permission and focus stages.
  - `claim-sheet-scanner.tsx` is the only `expo-camera` importer. It uses `CameraView` with the back camera, QR only and muted, and asks for permission only once mounted, after the tap. If refused for good, it shows "Open Settings". It closes the handler on unmount.
  - `claim-flow-panel.tsx` / `claim-flow-view-model.ts`: the paste field is gone. The screen offers "Scan the QR code", or "Scan again" after `sheet_not_recognised`. It unmounts the scanner the moment a sheet is read, and blocks screen capture. The status store now has a server snapshot, so server rendering works.
- **Isolation.** `scripts/claimant-sheet-scanner-isolation-check.cjs` and its test are wired into `package.json` and security CI. The check was confirmed to fail when `recordAudioAndroid` is turned on, and when screen-capture blocking is removed from the panel.

## Evidence

- **Acceptance: printed sheet to started claim** (`claimant-runtime-reconciliation-acceptance.test.ts`, Slice 6I block):
  1. The 6H `renderOwnerSheetHtml` prints the synthetic vector sheet.
  2. `decodePrintedSheetQr` draws the printed SVG squares into a bitmap and decodes it with `jsqr`.
  3. Three camera frames go through the scan handler into the real claim flow, over the real 6A bootstrap handle, and on to the actual portal-session, challenge, proof and handoff routes.
  4. The result is exactly one submission and statuses `checking → claim_started`.
  5. The wire order is `activate, assert, challenges, proofs, issue, complete`, all returning 200, with one case and one handoff signature.
  6. No request body and no snapshot contains the secret or the scanned payload.
- **Acceptance: owner flow to claimant proof** (`offline-code-v2-owner-registration-acceptance.test.ts`, Slice 6I block):
  1. The real 6H owner flow generates, registers through the 6G route and prints a sheet.
  2. The printed HTML is decoded from its QR image and scanned: three frames produce one value, equal to the sheet payload.
  3. The claimant challenge finds the registered record, and the proof verifies through the actual proof route.
- **QR fixture self-test:** round-trip decode through the same renderer and library, plus failure on a missing or damaged QR.
- **Unit tests:**
  - the scan handler ignores other barcodes, numeric types, foreign QR codes, over-long and non-string values, repeat frames and anything after close;
  - a double scan starts one claim, with one handoff signature;
  - a malformed `SKQ2.` value reaches `sheet_not_recognised` with no adapter call;
  - the scanner view model covers each permission and focus stage;
  - the claim view model offers scanning only in `ready` and `sheet_not_recognised`, and has no text-entry field.
- **Component tests** (server-rendered with a mocked `CameraView`, because the repo has no DOM test environment):
  - the normal app shows "unavailable", never calls the permission hook and renders no camera;
  - a live handle shows a scan button and no camera until tapped;
  - the scanner renders `CameraView` only when access is granted and the screen is focused and in the foreground, with exactly the props `active, barcodeScannerSettings{qr}, facing back, mute, onBarcodeScanned, style`;
  - refused access shows "Open Settings" and no camera.

## Local gates (all passed)

- `npm run typecheck`, `npm run lint` (zero warnings).
- `npm test --workspaces`: **1,665 passed, 3 established skips**. By workspace:
  - mobile: 907 passed, 3 skipped;
  - the other four: 171, 151, 42 and 394 passed.
- `npm run test:coverage` for mobile and API: thresholds met.
- `check:security`, `check:github-actions-security`, `check:mobile-secrets`, `check:phase1`, `check:production-dependencies` (no high or critical advisories).
- Every `node --test` batch in security CI: **279 script tests**, all passed.
- Expo Doctor: 21/21 checks passed.
- `next build` for the web app.

## Not covered here

- **Android and iOS native compiles** run in CI only; this environment has no Android SDK or Xcode.
- **Physical-device scanning** needs an internal build on real phones, pointed at a synthetic staging backend with the claimant switches on only in that build. It is owner-held and belongs to the first staging wiring phase.
- **Launch controls.** Everything stays synthetic, and all launch controls remain false/false/engaged. There was no deployment, hosted change, real data or activation.
