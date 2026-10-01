# Owner emergency sheets — PDF first, view and save again

Proposed on 2026-10-01, after the owner's emulator rerun of the MFA fix (EAS build `1b00c951-8f04-4c02-b3e5-e09891d4650e`, commit `cf86de4`). **Status: awaiting owner approval. Nothing below is built yet.**

## Why

The owner wants the sheet to be a PDF they create and save. Printing becomes optional, and they want to open and save the same sheet again later. The emulator rerun, as reported by the owner, found:
- the screen is worded for printing;
- the first sheet the owner saved as a PDF later showed as **Revoked**;
- tapping an Active sheet does nothing;
- Revoke sits inside the sheet card.

## What the research found

- **Why the first sheet was revoked (confirmed in the code, not reproduced on the device).** `owner-sheet-flow.ts` revokes a registered sheet unless the owner confirms "printed" first. That happens when the owner leaves the screen, or when the app goes to the background outside the print dialog: `abandon()` and `handleAppState()`. Saving a PDF and moving on without that confirmation revokes the sheet.
- **A sheet can't be shown again today.** The sheet exists only in memory until it is printed. The server keeps registration data only: the commitment, the public key and a wrap. The list returns dates and status. So nothing can rebuild the QR payload or the printed secret, by design.
- **What a sheet contains.** The QR payload carries a release wrap of **the vault master key** (MEK), opened by the printed secret. So a copy of the sheet encrypted under a key derived from the MEK gives nobody anything they can't already decrypt. That makes it safe to keep inside the existing vault boundary.
- **Size.** A sheet copy is about 1.9 KB of JSON, or about 2.6 KB once encrypted. That is above the roughly 2 KB that `expo-secure-store` reliably holds, so the copy goes in an encrypted file instead (see decision 1).
- **Saving files.**
  - The app already makes PDFs with `expo-print`'s `printToFileAsync` and shares them with `expo-sharing` (the vault export, `vault-pdf-exporter.ts`).
  - On Android, the Storage Access Framework (`expo-file-system`, already in the lockfile at 56.0.11 through `expo`) lets the owner pick a folder such as Downloads, and the app writes the file there. The write is confirmed and the folder is known.
  - A share sheet on Android or iOS cannot prove the file was saved.
- **Today's isolation check forbids files, sharing and storage** for every owner-sheet module (`claimant-owner-emergency-sheet-isolation-check.cjs`). This proposal changes that deliberately, for two new modules only (decision 4).

## Proposed behaviour

### Creating a sheet ("Create emergency sheet")
1. **An explanation, and an acknowledgement:** "This PDF can unlock your vault for someone you trust. Keep it private."
2. **Generate** in memory, as today (6F/6H, unchanged).
3. **Register** with the server, asking for a fresh TOTP code when needed (unchanged, same idempotency key on retry).
4. **Store the encrypted copy on this device** (decision 1). A sheet is shown as ready only when both registration and the copy have succeeded. If the copy can't be stored, the sheet is revoked straight away and the owner sees "Sheet not created. Nothing was saved."
5. **Ready:** "Sheet 3F9A1C is active."
   - The primary action is **Save PDF**; **Print** is a secondary action.
   - From here, leaving the screen, backgrounding or locking **never revokes**: the sheet is active and can be opened again from the list.
   - The "QR code is sharp" check and the hidden print confirmation are removed.
6. **Saving:**
   1. Render the PDF to a temporary file in the app cache (`printToFileAsync`).
   2. Hand it to the save mechanism (decision 2), then always delete the temporary file.
   3. Show the outcome:
      - **saved:** "Saved as Sanduqkin-emergency-sheet-3F9A1C.pdf in Downloads", when Android confirms the folder;
      - **saved, location unknown:** "Save dialog closed. We can't confirm where it was saved. You can save it again any time.";
      - **cancelled:** "Not saved. Your sheet is still active.";
      - **failed:** "Couldn't save. Try again."
   4. Retrying a save **reuses the same sheet** and never creates a new one.
   5. The filename is fixed: `Sanduqkin-emergency-sheet-<REF>.pdf`.

### My emergency sheets
- Each sheet row shows **Ref, a status badge, the date created and the validity**, and has no Revoke button inside it.
- **Tapping a row opens the sheet's detail screen.** There is also an accessible "⋯" menu:
  - **Active, with a copy on this device:** View sheet · Save PDF · Print · **Revoke** (in a separate danger style).
  - **Active, no copy on this device:** "This device doesn't have a copy of this sheet." The menu offers **Revoke** only, and suggests revoking and creating a new sheet. Nothing is generated silently.
  - **Revoked or Expired:** status and dates only, with no view or save. The badge is grey or red, never the Active style.

### Sheet detail
- **View sheet** shows the QR code and both codes on screen, behind a tap with a warning. Screen capture is blocked.
- **Save PDF** and **Print** re-render the same stored copy, so they show the same reference, QR payload and secret. Before rendering, the app checks that the server still lists the sheet as **Active**. A copy whose sheet is revoked or expired is deleted, not shown.
- **Revoke:**
  1. A confirmation: "Revoke sheet 3F9A1C? Anyone holding it will no longer be able to start a claim."
  2. A fresh TOTP code.
  3. The server revoke (the same idempotency key on retry, unchanged).
  4. The local copy is deleted, the list is refreshed, and other sheets are left unchanged.

### Access rules
- Viewing, saving and printing need the **unlocked vault**, because decrypting the copy needs the MEK, and an **AAL2 owner session** whose server list includes the sheet as Active.
- Locking the vault closes the detail screen and drops anything decrypted.
- Copies are keyed by owner user ID and record ID, and they are encrypted with that owner's MEK. Another account on the same device can neither decrypt nor list them.

## Owner decisions (recommendations in bold)

1. **Where the encrypted copy lives.**
   - **(A) On this device only:**
     - an encrypted file in the app's private files directory;
     - XChaCha20-Poly1305 under an HKDF subkey of the MEK, with the owner ID, record ID and version as associated data;
     - excluded from Android auto-backup in the Preview build (`allowBackup: false` for the `claimant_preview` target only).
     - It needs no server, schema or hosted change.
     - It doesn't survive an uninstall, and it isn't on other devices; the app says so honestly.
   - (B) In the server vault, as ciphertext: a new `owner_emergency_sheet_copies` table with RLS requiring AAL2. It is available on every device, but it needs a migration applied to the hosted Supabase (your separate authorisation), DB checks, and handling in account deletion and the synthetic cleanup.

   **(A) for the Preview now**, with (B) as a decision before production.
2. **How "Save PDF" works.**
   - **Android:** the Storage Access Framework. The owner picks a folder (Downloads is suggested each time) and the file is written there, so the result is a confirmed save with a known folder. "Share…" is offered as a second option.
   - **iOS:** the share sheet ("Save to Files"), reported as "location unknown".

   This adds `expo-file-system` (~56.0.11, already in the lockfile) as a direct dependency. **Recommended.** The alternative is the share sheet everywhere, as the vault export does, but then no save can ever be confirmed.
3. **When a sheet becomes Active, and when the app revokes it automatically.** **Active once registration and the encrypted copy both succeed. Auto-revoke only if registration succeeded but the copy failed, or the flow failed before that point. Never after it**, whatever the navigation, backgrounding or export outcome.
4. **Loosening the isolation check.** **Allow file and sharing APIs only in two new modules:**
   - `owner-sheet-copy-store.ts`, which may write only ciphertext and must never use `SecureStore`, `AsyncStorage` or logging;
   - `owner-sheet-export.ts`, which must delete the temporary file in a `finally`.

   Pin both, and keep every other owner-sheet module as strict as today.
5. **Existing sheets created before this change.** **Show them honestly as "no copy on this device".** The owner revokes them and creates a new one; there is no migration of old sheets.

## Tests

- **Create and save:** a successful save, with the exact filename and folder message.
- **Cancelled and failed saves:** retrying uses the same sheet, with no second registration or generation.
- **App restart:** the copy store is rebuilt from disk, and View and Save give the same QR payload and reference.
- **Owner isolation:** another owner's copy can't be decrypted or listed.
- **Locked vault:** no view or save, and anything decrypted is dropped.
- **Revoke:** confirmation, then a fresh TOTP, then revoke with the same idempotency key, then the copy is deleted and other sheets are unchanged.
- **Display:** Active, Revoked and Expired each get the right badge and actions; there is never view or save for revoked or expired sheets.
- **Missing copy:** the honest state; nothing is generated.
- **Clean-up and leakage:** the temporary PDF is deleted on success, cancel and failure. No secret, payload or PDF content in logs or state, and none in any storage except the ciphertext.
- **Lifecycle:** leaving after the copy is stored doesn't revoke; a failed copy store does revoke.
- **The isolation check** pins decision 4.
- **The hosted acceptance** keeps passing; the server is unchanged.

## Non-goals

- Server-side copies (decision 1B).
- Claim start (W2b).
- Production approval. All claimant approval constants stay literal false.
- Changing the sheet cryptography or the server routes.
- Any MFA factor change, or any hosted setting change.
