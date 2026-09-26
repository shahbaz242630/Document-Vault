# Claimant 6F–6H session close — 2026-09-25

This is the current checkpoint and the opener for the next session. It supersedes `2026-09-25-claimant-6c-6e-session-close.md`.

## Delivered and merged

- **PR #95 (`a6e15b5`): Slice 6F.** A generator that creates the owner's emergency sheet on the device (literal-false, synthetic-only).
- **PR #96 (`3c68b57`): Slice 6G.** Owner routes to register and revoke a sheet:
  - `POST /owner/offline-code/v2/locators`;
  - `POST /owner/offline-code/v2/locators/:locatorRecordId/revoke`.

  They require a fresh AAL2 owner session and take the owner ID from that session only. The server recomputes the locator commitment and the record-binding digest with that owner. The locator-index digest now comes from one module shared with the claimant challenge route.
- **PR #98 (`18e451f`): Slice 6H and a release environment fix.**
  - **6H, the owner emergency-sheet screen.**
    - The sheet is generated through `VaultSession.createOfflineCodeEmergencySheet`; the vault key never leaves the session.
    - A self-check re-derives the wrap key from the printed material alone and confirms the wrap opens to the vault key.
    - The sheet is registered through 6G, with a TOTP step-up.
    - It is printed as a QR sheet through `expo-print` `printAsync` only, using `qrcode-generator` 2.0.4.
    - An unconfirmed sheet is revoked automatically.
    - The feature is hidden behind two literal-false constants.
  - **Release environment fix.** Expo inlines `EXPO_PUBLIC_*` values only for literal `process.env` reads. Three readers used other forms, so in release builds these values were empty: the API URL (account deletion never reached the API), the RevenueCat keys, and the SSL pinning pins, which left **certificate pinning silently off**. All three are fixed. A regression test runs Expo's production Babel transform over them.

Every PR's head was verified as an ancestor of `main`, with all CI green, including the Android and iOS native builds.

## Owner decisions this session

- Build 6G first. Take the reviewer decision before go-live.
- Keep revocation in 6G.
- For 6H: add `qrcode-generator`, print only (no PDF or share option), and automatically revoke unconfirmed sheets.

## Still open

1. **The reviewer decision** (needed before go-live): two human reviewers, or a single owner reviewer with safeguards (cooldown, dispute window, audit trail) built as its own slice.
2. **6I: the claimant camera QR scanner.** It needs a native dependency and a new build, and it is where the printed QR is first scanned by a real camera.
3. **A "my emergency sheets" list with revoke.** It needs a small owner list route; today only the sheet from the current session can be revoked.
4. **The 5A test vector.** Its `locator_digest` uses a different HMAC construction from the deployed boundary index. Reconcile the vector or retire that field.
5. **Grant IDs** are still not linked to a real release grant.
6. **Production readiness:** a production Argon2id KDF profile, physical-device printing and scanning evidence, and real-PostgreSQL acceptance (needs Docker).
7. **Owner-held items:** legal review of public documents, Supabase Pro (hosted MFA), EDGE-01 to EDGE-03, the production domain, an email provider, the App Store release, and the new public variable `EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN` plus the server variable `OFFLINE_CODE_V2_OWNER_ORIGIN`.

## Next-session opener

> Continue the Sanduqkin claimant work in `shahbaz242630/Document-Vault`. Read `docs/handoff/2026-09-25-claimant-6f-6h-session-close.md`, `CLAIM_HANDOFF.md`, and the 6F, 6G and 6H specs and verification records. Confirm `main` contains PR #98 (`18e451f`). Then propose the next slice. Recommended: 6I, the claimant camera QR scanner; or my reviewer decision if I have made it; or the "my emergency sheets" list. Write its spec for my approval before coding. Use a PR watcher for CI rather than polling.
