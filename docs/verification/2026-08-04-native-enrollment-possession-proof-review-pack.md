# Native Enrollment Possession-Proof Review Pack Evidence

Date: 2026-08-04 (Asia/Dubai)

## Scope

This value-free record covers the second runtime-disconnected Slice 1B increment defined in `docs/superpowers/specs/2026-08-04-claimant-slice-1b-possession-proof-review-pack.md`.

The increment freezes the P-256 ECDH / HKDF-SHA-256 / HMAC-SHA-256 transcript, strict server-derived challenge bindings, unpadded Base64URL encoding, deterministic reference vector, invitation normalization/keyed-index rules, and server-ephemeral lifecycle for independent review. It adds no live endpoint, database state, native production alias, delivery, invitation acceptance, Supabase configuration, deployment, or external runtime.

## Source And Fingerprint

- Base commit: `887abd0459197c5123b8972e1b8c5bed14ec5528`, plus the existing local Phase 0-2 in-progress bundle.
- Original pre-review implementation/vector/test aggregate SHA-256: `c0d135abd6a53efb9df649dad9c86919645456335c0a4cbb757026bf024762ce`. This aggregate is superseded by the remediated fingerprint in `docs/verification/2026-08-04-slice-1b-internal-adversarial-review.md`.
- Fingerprint algorithm: sort the 14 implementation/vector/test paths listed by the review increment ordinally, calculate SHA-256 over each complete file, serialize each as `<lowercase-sha256><two spaces><path>` joined by LF, then SHA-256 the UTF-8 serialization. Documentation is excluded to avoid a recursive hash.

## Enforced Boundary

- The exact MAC transcript binds protocol, challenge, server-derived claimant, key/version, public-key fingerprint, device digest, eligibility version, invitation reference/version, policy pack/version, origin, issuance/expiry, nonce, KDF salt, and server-ephemeral public key.
- P-256 public keys use 65-byte ANSI X9.63 uncompressed representation encoded as unpadded Base64URL. Runtime point validation remains an explicit implementation/review gate.
- The client request carries no fingerprint authority; the server must validate the public point and derive the domain-separated fingerprint itself.
- The fingerprint, HKDF info, and MAC input use separate versioned labels with a zero-byte separator.
- The generated synthetic vector reproduces fingerprinting, canonical JSON, SHA-256, P-256 ECDH, HKDF-SHA-256, and HMAC-SHA-256 byte for byte.
- Hostile tests mutate every security-relevant challenge field and use a different claimant private key; all fail against the reference MAC.
- Shared/mobile/web/API strict consumers reject device rebinding, client-added address authority, and policy-version drift while all runtime flags remain false.
- Invitation rules replace client-authoritative/raw SHA-256 address digests with a server-derived narrow ASCII normalization and keyed HMAC index before any live route may exist.

## Verification

- Shared claimant types: 116 tests across 20 files passed.
- Mobile: 410 tests passed and 3 existing tests skipped across 114 files.
- Web: 150 tests across 43 files passed.
- API: 75 tests across 19 files passed.
- Shared validation: 42 tests across 2 files passed.
- All workspace typechecks and full repository lint passed.
- Repository security, GitHub Actions security, mobile secret, claim-vector reproducibility/isolation, claimant custody isolation, and `git diff --check` passed.

## Remaining Stop Gates

- The internal adversarial review completed with the remediations and remaining findings recorded in `docs/verification/2026-08-04-slice-1b-internal-adversarial-review.md`; it does not constitute independent approval.
- Obtain independent cryptographic approval of the transcript, point validation, constant-time handling, and server ephemeral wrapping/destruction design.
- Obtain independent native/security approval of App Attest binding or an approved equivalent; self-asserted capability metadata is insufficient.
- Obtain privacy/security approval of corrected exact-case `email-ascii-v1`, keyed address indexing, separate delivery-token exchange/expiry, notification retention, recovery, enumeration, and abuse controls.
- The disposable Apple compile and physical pass/cancel/retry/cleanup matrix passed. Production-adapter App Attest, invalidation, reinstall/restore, and derived-secret-clearing evidence remains open.
- Keep hosted claimant MFA parked on the Free plan without weakening fresh-AAL2 server enforcement; paid-plan hosted MFA remains mandatory before external claimant access.
- Do not add a live challenge route or call invitation acceptance until these gates close.
