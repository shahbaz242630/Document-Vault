# Slice 1C App Attest Contract Evidence

Date: 2026-08-04 (Asia/Dubai)

## Result

The runtime-disconnected App Attest registration/assertion contract, deterministic synthetic binding vector, strict validators, mobile/API consumers, and isolation guards are implemented. No Apple entitlement, DeviceCheck call, Apple network request, native key, endpoint, database state, invitation acceptance, deployment, or external runtime was added.

## Enforced Boundary

- Registration binds claimant, portal session, key-ID digest, App ID hash, environment, bundle/category expectations, timestamps, and nonce.
- Enrollment assertions additionally bind the immutable native-enrollment challenge digest, claimant key/version/fingerprint, invitation/version, and exact API audience.
- App Attest key IDs are canonical 32-byte standard Base64; their server authority is a separate domain-labeled digest.
- Challenges are UUIDv4, single-use by design, and exactly 300 seconds.
- Distributed TestFlight/App Store categories require production environment.
- Client responses cannot assert counter, validity, receipt, certificate, RP ID, AAGUID, claimant public key, or private material.
- The vector reproduces canonical client data, SHA-256 hashes, and the key-ID digest and changes the hash for every bound field.
- Opaque objects are explicitly synthetic and never represented as Apple-issued evidence.
- Normal mobile runtime has no App Attest entry point; the contract flag is fixed to `false`, and isolation rejects DeviceCheck/runtime method tokens.

## Review Classification

This is internally reviewed engineering evidence, not Apple integration evidence or independent native/security approval. A future server must implement Apple's full CBOR/certificate/nonce/RP-ID/AAGUID/extension/signature/counter validation and atomic state transitions. A future native adapter must implement App Attest availability, key registration, attestation, assertion, key loss, and environment handling with no fail-open fallback.

## Source Fingerprint

- Base commit: `887abd0459197c5123b8972e1b8c5bed14ec5528`, plus the authoritative in-progress claimant working tree.
- Fifteen-file contract/vector/consumer/isolation aggregate SHA-256: `a7bf764d6e4d1cc44175fadde533d73237e198b6e6680b8915b2b833306515cf`.
- Algorithm: sort the fifteen code/vector/test/isolation paths ordinally; hash each complete file with SHA-256; serialize each as `<lowercase-sha256><two spaces><path>` joined by LF; SHA-256 the UTF-8 serialization. Documentation is excluded to avoid a recursive hash.

## Verification

- Focused App Attest shared suite: 7 tests across 2 files passed.
- Focused mobile consumer: 2 tests passed.
- Focused API consumer: 2 tests passed.
- Full mobile suite: 422 passed and 3 existing skipped across 117 files.
- Full web suite: 150 passed across 43 files.
- Full shared-types suite: 126 passed across 22 files.
- Full shared-validation suite: 42 passed across 2 files.
- Full API suite: 81 passed across 21 files.
- All workspace typechecks and full repository lint passed.
- Repository security, GitHub Actions security, mobile secret, claim-vector reproducibility/isolation, claimant-custody isolation, and `git diff --check` passed.
- Database suites were not rerun because Slice 1C adds no migration, database adapter, RPC, route, or persistence behavior.

## Remaining Gates

- The combined independent-review packet, exact manifest, and verified private ZIP are ready and supplied to the owner for external review; no independent decision is recorded.
- Independent native/security approval of the complete App Attest and possession-proof binding.
- Approved production App ID/environment/category/bundle policy and Apple credential/receipt/counter lifecycle.
- Separate native adapter, server verifier, persistence, endpoint, and atomic-consumption slices.
- Apple development/TestFlight evidence for attestation, assertions, counter/replay handling, key loss, reinstall/restore, and unsupported-device failure.
- Invitation/privacy delivery-retention decisions and paid-plan hosted MFA before external access.
