# Claimant Slice 6F owner-side emergency sheet generator verification

Date: 2026-09-25 (Asia/Dubai)

## Result

Slice 6F passes local verification on `claude/claimant-slice-6f-owner-sheet-generator`, based on `main` at `1fcb816` (Slice 6E merged through PR #94).

## Delivered

- **Shared-types `formatOfflineCodePublicLocatorV2` and `formatOfflineCodeClientSecretV2`.** They reproduce the fixture's printed `SK2-L-` and `SK2-S-` values from their bytes, and reject the wrong byte length.
- **`offline-code-v2-sheet-generator.ts`.** A literal-false, synthetic-only owner generator for the `SKQ2.` sheet payload, the printed codes, and exactly the 5B registration inputs, apart from the server-keyed locator index. The vault key, root, seeds and wrap key are wiped and never returned.
- **`scripts/claimant-offline-code-v2-sheet-generator-isolation-check.cjs`** and its test, wired into `package.json` and security CI.

## Evidence

- With the vector's fixed bytes, the generator output equals the published synthetic vector byte for byte: locator, secret, KDF profile, record binding, binding digest, wrap nonce and ciphertext, and associated-data digest.
- The generated sheet, parsed and passed to the claimant proof producer, yields exactly the vector's possession proof.
- Fresh randomness yields distinct, valid sheets. Invalid IDs, a reused ID, a short key, bad expiries, non-canonical timestamps and misbehaving randomness all fail with one generic error.
- Workspace tests: 1,603 passed, with three established skips. Serial script tests: 295 passed.
- Typechecks and zero-warning lint pass. Security, Phase 1, mobile-secret and production-dependency checks pass, as do all claimant isolation checks, including the new one.
- Expo Doctor 21/21; the web build produces 24 routes.

No server route, migration, UI, persistence, hosted state or activation changed.
