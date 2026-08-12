# Slice 1B Internal Adversarial Review

Date: 2026-08-04 (Asia/Dubai)

## Decision

Internal technical review is complete after remediation. The runtime-disconnected P-256 ECDH / HKDF-SHA-256 / HMAC-SHA-256 transcript is suitable to send to an independent cryptographic reviewer. The invitation-address design is suitable to send to privacy/security review after correcting local-part case folding and separating the stable invitation reference from delivery links.

This is not independent or specialist approval. No live challenge route, production enrollment alias, invitation acceptance, hosted Supabase change, deployment, or external claimant access is authorized.

## Remediated Findings

1. `P1` — Version fields accepted integers outside JavaScript's safe range. Validation now requires positive safe integers.
2. `P1` — The documented exact 300-second challenge lifetime was not enforced by the shared validator. Other lifetimes now fail.
3. `P1` — Base64URL shape checks allowed non-canonical trailing bits and did not fully constrain the decoded X9.63 prefix. Strict canonical encodings are now required; production crypto code must still perform full point validation.
4. `P1` — The internal invitation locator was documented as UUIDv4 but accepted other UUID versions. Invitation references now require UUIDv4.
5. `P0` — `email-ascii-v1` lowercased the local-part even though email local-parts are case-sensitive. V1 now preserves the ASCII dot-atom local-part exactly and lowercases only the validated DNS domain. A server-only implementation and fixed keyed-index vector enforce this behavior.
6. `P1` — The stable invitation reference could have appeared in a universal link. The design now requires a separate single-purpose 256-bit delivery token; the stable internal reference is never transported.
7. `P1` — The server-ephemeral wrapping profile was underspecified. The review contract now fixes AES-256-GCM, a fresh unique 96-bit nonce per wrapping-key version, a 128-bit tag, and canonical associated data. Key-management operations remain an external review and implementation gate.

## Confirmed Construction Properties

- Fingerprint, HKDF-info, and MAC-input domains remain distinct and versioned with an unambiguous zero-byte separator.
- HKDF uses the raw 32-byte P-256 ECDH result as input key material, a 32-byte independent public salt, transcript-bound info, and a 32-byte output.
- HMAC binds every immutable challenge field; hostile tests change each field independently and reject a different claimant key.
- The local HKDF implementation now also reproduces RFC 5869 SHA-256 test case 1 independently of the generated claimant vector.
- The runtime crypto-library test rejects the uncompressed all-zero/off-curve P-256 point.
- Challenge identifiers, claimant/key bindings, invitation/key/policy/eligibility versions, API audience, timestamps, nonce, salt, server ephemeral key, and device-context digest are transcript-bound.
- A proof never supplies server authority: every repeated response field must match immutable server state, and proof success alone cannot accept an invitation.

## Remaining Blocking Findings

1. `P0` — Self-reported `secure_enclave` capability does not prove app or hardware provenance. Runtime-disconnected Slice 1C now defines the required Apple App Attest registration/assertion binding under `docs/superpowers/specs/2026-08-04-claimant-slice-1c-app-attest-contract.md`, but production still requires independent approval plus separate native/server implementation and Apple evidence. The device-context digest remains non-authoritative.
2. `P0` — The live server implementation does not exist. Independent review must approve full P-256 point validation, constant-time MAC comparison, AES-GCM wrapping/AAD, wrapping-key custody/rotation/usage limits, atomic consumption, destruction, and race handling before implementation is enabled.
3. `P1` — Privacy/operations must choose the exact delivery-token lifetime and raw notification-address/provider retention, then approve recovery/address-change, enumeration, telemetry-redaction, and abuse controls.
4. `P1` — The future production adapter still needs App Attest, passcode-change/removal invalidation, reinstall/restore, and derived-secret-clearing evidence. The disposable physical probe does not close those production gates.
5. Hosted claimant MFA remains parked on the Free plan. Paid-plan enrollment/challenge/recovery/displacement and fresh-assurance evidence remains mandatory before external access.

## Source Fingerprint

- Base commit: `887abd0459197c5123b8972e1b8c5bed14ec5528`, plus the authoritative in-progress claimant working tree.
- Ten-file contract/vector/server-conformance aggregate SHA-256: `4abdfb3230f96ada853f3ae096c28e8efc282cf5fbadf99e41d081a6780d3100`.
- Algorithm: sort the ten code/vector/test paths ordinally; hash each complete file with SHA-256; serialize each as `<lowercase-sha256><two spaces><path>` joined by LF; SHA-256 the UTF-8 serialization. The ten individual paths and hashes are retained in the review command evidence for this working session.

## Verification

- Shared native-enrollment contract/vector suite: 9 tests passed across 2 files.
- API invitation-address conformance: 4 tests passed.
- Full mobile suite: 420 passed and 3 existing skipped across 116 files.
- Full web suite: 150 passed across 43 files.
- Full shared-types suite: 119 passed across 20 files.
- Full shared-validation suite: 42 passed across 2 files.
- Full API suite: 79 passed across 20 files.
- All workspace typechecks and full repository lint passed.
- Repository security, GitHub Actions security, mobile secret, claim-vector reproducibility/isolation, claimant-custody isolation, and `git diff --check` passed.
- Database suites were not rerun because this review changed no migration, database adapter, RPC, or route behavior.

## External Reviewer Checklist

- Confirm the P-256 point-validation and invalid-curve failure behavior of every production crypto library.
- Reproduce the deterministic vector and RFC 5869 reference without reusing repository helper code.
- Review transcript completeness, domain separation, one-sided key confirmation, replay behavior, and constant-time comparisons.
- Review App Attest attestation/assertion validation, app/environment binding, public-key/challenge binding, counter storage, fallback policy, and unsupported-device behavior.
- Review AES-256-GCM nonce uniqueness, associated data, wrapping-key separation/rotation, ciphertext destruction, crash recovery, and sweeper/concurrent-consumer races.
- Review exact-case local-part handling, domain folding, unsupported internationalized/quoted addresses, reissue behavior, keyed-index rotation, and constant-time matching.
- Approve the separate delivery-token TTL/exchange, raw-address retention, provider records, recovery/address change, enumeration resistance, layered rate limits, and value-free telemetry.
