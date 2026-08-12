# iOS Secure Enclave Probe Harness Evidence

Date: 2026-08-04 (Asia/Dubai)

## Scope

This value-free record covers the hard-disabled probe harness defined in `docs/superpowers/specs/2026-08-04-claimant-slice-1b-ios-secure-enclave-probe-harness.md`.

The increment aligns the existing probe-only Expo module with the frozen native-enrollment V1 labels, canonical challenge, unpadded Base64URL P-256 public keys, domain-separated fingerprint, P-256 ECDH, HKDF-SHA-256, and HMAC-SHA-256 verification. It adds strict TypeScript result validation, creation/exercise fingerprint continuity, source isolation guards, and an explicit macOS CI compile-contract gate. It adds no application import, production alias, live route, persistence, hosted change, build submission, or external runtime.

## Source And Fingerprint

- Base commit: `887abd0459197c5123b8972e1b8c5bed14ec5528`, plus the existing local Phase 0-2 in-progress bundle.
- Implementation/test aggregate SHA-256: `1f9488878533a76ae9b63e8c81afc08c66b6ccb7c5ae9cf707be4e9b9e9c4046`.
- Fingerprint algorithm: sort the seven implementation/test paths ordinally, calculate SHA-256 over each complete file, serialize each as `<lowercase-sha256><two spaces><path>` joined by LF, then SHA-256 the UTF-8 serialization. Documentation is excluded to avoid a recursive hash.

## Enforced Boundary

- Runtime capability remains hard-disabled.
- The native module exposes exactly four no-input probe methods and uses only the V3 `probe-only` alias.
- Passcode-set, device-only accessibility and per-use private-key/user-presence access control are required.
- Public keys must be canonical 65-byte X9.63 points encoded as 87-character unpadded Base64URL; fingerprints are 32-byte unpadded Base64URL.
- Probe success requires the same public fingerprint at creation and exercise.
- Private key material, opaque key representation, ECDH results, proof keys, proof MACs, nonce, salt, and challenge bytes are not returned.
- The custody isolation guard rejects unexpected native methods, missing protocol labels/primitives, exposed sensitive result fields, runtime imports, and non-probe aliases.

## Verification

- Mobile: 412 tests passed and 3 existing tests skipped across 114 files; the focused custody set is 6/6.
- Mobile typecheck passed.
- Expo Doctor: 21/21 checks passed.
- Claimant custody isolation passed.
- GitHub Actions security regression: 23/23 passed.
- GitHub Actions security guard passed.
- Full repository lint, repository security guard, mobile secret scan, claim-vector reproducibility/isolation, and `git diff --check` passed.

## Evidence Limitation And Remaining Production Gate

This Windows workspace has no local Swift/Xcode toolchain. The separately isolated signed EAS internal probe build compiled successfully, and the owner-reported value-free physical-iPhone authenticated pass, cancellation/cleanup, and authenticated retry matrix passed. These results close only the disposable probe's compile and physical-behavior gate. A production enrollment adapter still requires independent native/cryptographic approval, App Attest integration, passcode-change/removal invalidation, reinstall/restore, and derived-secret-clearing evidence.
