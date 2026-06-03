# Local PDF Export Design

## Status

Draft for founder review. This spec covers only the PDF/export slice. It does not implement pre-authorized kin access, sealed emergency access codes, or release-request workflows.

## Goal

Give a signed-in user a local device export of their already-unlocked vault, while preserving Sanduqkin's zero-knowledge promise.

The export feature must make two ideas clear:

- `Download readable PDF` creates a sensitive human-readable file for the user's own records.
- `View encrypted storage preview` shows how Sanduqkin stores vault records as ciphertext and non-sensitive metadata.

## Non-Negotiable Security Rules

- PDF generation happens only after the vault is unlocked and decrypted locally in the mobile app.
- Sanduqkin/Supabase never receives the generated PDF.
- Sanduqkin never emails the generated PDF.
- Generated PDFs are not uploaded to Supabase Storage.
- The app must not log decrypted vault fields while building the PDF.
- The app must not put decrypted vault fields in analytics, audit metadata, crash metadata, route params, or remote logs.
- The encrypted storage preview is not a backup or restore artifact.

## User Experience

Add an export entry point from the vault/settings area after the user has unlocked the vault.

The screen shows two choices:

1. `Download readable PDF`
   - Primary useful export.
   - Copy: `Creates a readable PDF from your unlocked vault on this device. Sanduqkin does not receive or email this file. Store it safely.`
   - Before generating, show a confirmation warning:
     `This PDF will contain sensitive information from your vault. Anyone with the file may be able to read it. Store it safely and delete it when no longer needed.`

2. `View encrypted storage preview`
   - Trust/transparency feature.
   - Copy: `This shows the kind of encrypted data Sanduqkin stores. Without your key, it cannot be read by Sanduqkin or someone with database access.`
   - Show representative fields such as asset type, ciphertext sample, nonce sample, and timestamps.
   - Do not call this a backup.

## Readable PDF Content

The readable PDF includes:

- Sanduqkin title and export timestamp.
- Short warning that the file contains sensitive information.
- Assets grouped by category.
- For each asset:
  - display title/name when present,
  - asset type label,
  - known user-provided fields,
  - notes if present,
  - created/updated date if useful.

The PDF must avoid adding product claims like financial advice, estate planning, wealth management, or legal instructions.

## Data Flow

Readable PDF:

1. User unlocks vault.
2. App reads decrypted in-memory vault assets from the existing vault session.
3. App converts assets into a printable/exportable local document model.
4. App generates a local PDF file on the device.
5. App opens the native share/save flow.
6. App records only a safe audit event such as `vault_pdf_export_created`, with no asset names, notes, field values, file path, or file contents.

Encrypted storage preview:

1. App uses the encrypted repository/codec layer or a local representation of the stored encrypted records.
2. App shows truncated ciphertext/nonce examples and safe metadata only.
3. App does not decrypt anything for this preview beyond what is already in the unlocked session.
4. App records only a safe audit event such as `encrypted_storage_preview_viewed`.

## Implementation Boundary

The implementation should be split into small units:

- `vault-export-model` maps decrypted assets into display-safe export sections.
- `vault-pdf-template` renders the export model into PDF-ready markup or document structure.
- `vault-pdf-exporter` owns local PDF generation and native share/save.
- `encrypted-storage-preview` owns display of ciphertext examples and safe metadata.
- A route/screen composes the UI and warnings.

The mobile app currently does not include PDF/share dependencies. The implementation slice should use Expo-compatible libraries for local PDF generation and device share/save, installed through Expo's supported install path for the current SDK. Do not add a backend PDF service.

## Failure Handling

- If the vault is locked, refuse export and ask the user to unlock first.
- If PDF generation fails, show a generic local failure message and log only non-sensitive error context.
- If native share/save is cancelled, treat it as a user cancellation, not an error.
- If encrypted storage preview cannot load live encrypted records, show a safe sample generated from local encrypted data shape, not plaintext.

## Tests

Add focused tests for:

- export model groups assets by category,
- export model includes expected decrypted fields only in local export output,
- audit metadata for export excludes vault plaintext,
- encrypted preview output contains ciphertext/nonce samples but not decrypted sentinels,
- locked-vault export is refused,
- PDF exporter failure path does not expose plaintext in errors.

Manual verification:

- On Android dev client, unlock vault, export readable PDF, confirm native share/save opens.
- Confirm no network call is made for generated PDF content.
- Confirm encrypted preview shows ciphertext-like values and no readable account details.

## Out Of Scope For This Slice

- Password-protected PDFs.
- Server-generated PDFs.
- Email delivery.
- Supabase Storage upload.
- Import/restore from PDF or ciphertext preview.
- Kin release flows.
- Web beneficiary export.
