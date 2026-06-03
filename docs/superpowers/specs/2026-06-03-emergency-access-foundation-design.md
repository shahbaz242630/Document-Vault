# Emergency Access Foundation Design

## Status

Approved direction for Slice 1 implementation. This slice covers schema and pure crypto foundations only.

## Goal

Create the zero-knowledge foundation for future emergency access without building kin onboarding screens, release approval screens, or server-side decryption.

## Security Rules

- Sanduqkin/Supabase never receives vault plaintext, plaintext MEKs, raw emergency codes, recovery phrases, generated PDFs, or decrypted kin data.
- Emergency access releases encrypted/wrapped key material only.
- Decryption must happen client-side in a future kin app/web flow.
- Raw emergency codes are generated client-side, shown to the user, and never persisted.
- Wrong emergency code or wrong kin wrapping key must fail with a generic decrypt error.

## Data Model

Add RLS-protected tables:

- `emergency_contacts`
  - user-owned contact/release configuration metadata.
  - stores contact label and optional contact email hash, not raw invitation secrets.
- `emergency_key_grants`
  - stores encrypted MEK grant material for `pre_authorized_kin` or `sealed_emergency_code`.
  - stores ciphertext, nonce, optional KDF salt/params, grant status, and timestamps.
- `emergency_release_requests`
  - stores future emergency release request state.
  - stores request status, verification/release timestamps, and safe metadata only.

No table stores plaintext vault fields, plaintext MEKs, raw emergency codes, recovery phrases, or generated PDFs.

## Crypto Model

### Sealed Emergency Code

The app generates a high-entropy human-readable code such as:

`K7Q9-M2XD-8V4P-ZR6T-AL3N`

The app derives a 32-byte wrapping key with the existing Argon2id helper and a random salt. That key wraps the user's MEK using XChaCha20-Poly1305 with dedicated associated data.

Serialized package stores:

- grant type,
- wrapped MEK ciphertext,
- wrapped MEK nonce,
- KDF salt,
- KDF metadata.

Serialized package does not store the raw emergency code.

### Pre-Authorized Kin

For this slice, pre-authorized kin wrapping accepts a supplied 32-byte kin wrapping key. Later slices will decide the exact kin account/keypair exchange flow.

Serialized package stores:

- grant type,
- wrapped MEK ciphertext,
- wrapped MEK nonce,
- wrapping algorithm metadata.

## Tests

Add tests proving:

- emergency codes are generated in the approved grouped format,
- normalize/validate accepts equivalent lower-case/no-space input,
- sealed code unwrap succeeds with the correct code,
- sealed code unwrap fails with the wrong code,
- kin key unwrap succeeds with the correct 32-byte key,
- kin key unwrap fails with the wrong key,
- serialized emergency packages exclude raw emergency code and plaintext MEK,
- migrations contain emergency tables and do not contain plaintext vault columns or raw code columns.

## Out Of Scope

- Kin invite UI.
- Release request UI.
- Manual review workflow.
- Email sending.
- Public/private keypair exchange.
- Applying the migration to remote Supabase.
