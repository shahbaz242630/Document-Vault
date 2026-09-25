# Slice 6F — owner-side emergency sheet generator

Selected and owner-approved on 2026-09-25 after Slice 6E merged through PR #94 at `1fcb816`. It follows the recommended next step from the 6C–6E close-out: owner-side emergency-sheet generation. Registration, printing and camera scanning are split into later slices so each stays reviewable.

## Gap

Slice 6E defined the `SKQ2.` emergency-sheet payload that claimants scan, but nothing on the owner side can create one. The database registration function (`claimant_register_offline_code_v2_locator`, Slice 5B) exists. However, no client derives the locator, secret, KDF profile, proof key, record binding and release wrap that it needs. Until now that material existed only inside the synthetic test-vector generator.

## Scope

1. **Shared-types formatters.** `formatOfflineCodePublicLocatorV2` and `formatOfflineCodeClientSecretV2` turn fresh bytes into the printed `SK2-L-` and `SK2-S-` values: Crockford base32 with a checksum. They are the exact inverse of the existing normalisers.
2. **Owner sheet generator** (`apps/mobile/src/features/claimant-offline-code/offline-code-v2-sheet-generator.ts`).
   - It is literal-false approved and synthetic-only.
   - Its injected crypto is the existing proof crypto interface, plus randomness and XChaCha20-Poly1305.
   - Given an owner ID, grant ID, locator record ID, the owner's 32-byte vault key and a validity window (at most 365 days), it follows the frozen 5A derivation:
     - the locator commitment;
     - the Argon2id root (synthetic profile only);
     - the record binding with its HKDF-derived Ed25519 proof key;
     - the binding digest;
     - the release wrap key and the XChaCha20 wrap of the vault key over canonical associated data.
   - It returns:
     - the `SKQ2.` sheet payload;
     - the printed locator and secret;
     - exactly the registration inputs the 5B database function takes. The server-keyed locator index is excluded, because the server computes it.
   - It never returns the vault key, root, seeds or wrap key, and it wipes them.
   - Every failure produces one generic error.
3. **Static isolation.** A dedicated check requires:
   - the literal-false constant and the synthetic controls;
   - no network, storage, auth, environment, logging, `Math.random` or dynamic imports;
   - exactly two imports (shared-types and the proof-core type);
   - no importer anywhere in `apps`.
   It is wired into security CI.

## Acceptance

- With the vector's fixed bytes, the generator reproduces the published vector byte for byte: locator, secret, KDF profile, record binding, binding digest, wrap nonce and ciphertext, and associated-data digest.
- The generated sheet, parsed and fed to the claimant proof producer, yields exactly the vector's possession proof. This is an owner-to-claimant round trip.
- Fresh randomness yields distinct, valid sheets.
- Invalid IDs, a reused ID, a short key, a bad expiry, a non-canonical timestamp or misbehaving randomness all fail generically.
- Secrets are wiped, and the vault key never appears in the output.
- Workspace tests, typechecks, lint, security and all isolation checks, Expo Doctor and the web build pass; CI is green.

## Later slices

- **6G:** an owner-authenticated registration API route. The server computes the locator index and calls the 5B function.
- **6H:** an owner screen that generates and prints the sheet (QR rendering).
- **6I:** the claimant camera QR scanner (a native dependency and a new build).

## Non-goals

A production KDF profile, server routes, migrations, UI, printing, the camera, persistence, deployment, real data and activation.
