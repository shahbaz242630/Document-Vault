# Claimant Key Custody And Client Boundary Decision

Last updated: 2026-07-28 (Asia/Dubai)

## Status

The owner approved this design direction and its runtime-disconnected feasibility slice on 2026-07-28. Production protocol approval remains blocked on the feasibility findings, physical-device evidence, and independent security review. This document does not authorize claimant authentication, production key registration, invitations, migrations, API routes, evidence intake, notifications, release packaging, or claimant decryption.

The current registered-recipient V1 X25519 vector remains valid test infrastructure, but it is not recommended as the production hardware-custody profile. If this decision is approved, production registered-recipient work must use a new versioned hardware-backed profile and retain V1 only as a reference and compatibility test.

## Decision Requested

Approve the following product and security boundary:

1. The public claimant website and future web portal explain the process and may later host account, case, evidence, and status workflows.
2. Claimant private-key generation, custody, proof of possession, grant opening, and released-vault decryption occur only in an approved native Sanduqkin client.
3. The existing Sanduqkin mobile application gains a strictly isolated claimant mode instead of launching a separate claimant application for the MVP.
4. Production registered-recipient keys are device-bound, non-exportable P-256 keys generated through Apple Secure Enclave or Android Keystore.
5. Production registered-recipient grants use a new `registered_recipient_v2` profile. V1 X25519 sealed boxes are not silently reinterpreted as hardware-backed.
6. Unsupported devices cannot enroll for the registered-recipient route. There is no software-key fallback presented as equivalent security.
7. The MVP has no automatic server recovery of claimant private keys. Device loss requires a new claimant key and explicit owner re-finalization while the owner is still able to act.
8. Cross-device recovery, portable encrypted key backup, multi-device grants, and hardware-token support are separate future protocols.

## Existing Mobile Foundation

The current app already provides:

- native libsodium for client cryptography;
- Expo SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`;
- optional per-read device authentication for the biometric MEK cache;
- biometric/passcode prompts;
- device lifecycle locking and key cleanup;
- an iOS 16.4 minimum deployment target; and
- one existing mobile binary that can host owner and claimant route stacks.

This is a useful foundation, but it does not prove non-exportable claimant-key custody:

- `expo-secure-store` protects stored values, but reading a stored Curve25519 private key returns its bytes to the application process.
- The current general MEK storage does not require authentication, while the separate biometric cache does.
- The current native libsodium key pairs are software keys and are not generated inside Secure Enclave or Android Keystore.
- Existing recovery phrases recover the owner's vault MEK. They must not implicitly recover or derive a claimant private key.

## Platform Findings

### Apple

- `ThisDeviceOnly` Keychain accessibility prevents migration to a different device.
- `WhenPasscodeSetThisDeviceOnly` is stricter than the current `WhenUnlockedThisDeviceOnly`: it requires a device passcode and removes the item if the passcode is removed.
- Keychain access control can require user presence for each use.
- Apple Secure Enclave hardware key agreement supports P-256. Secure Enclave does not provide hardware-backed X25519 private keys.
- CryptoKit Curve25519 private keys do not have a native `SecKey` representation and are stored as generic Keychain passwords, meaning their bytes must be available to the client process when used.

### Android

- Android Keystore keys can be non-exportable and can enforce cryptographic purpose and user authentication.
- The app can inspect whether a key is backed by a trusted execution environment or StrongBox.
- StrongBox's broadly documented asymmetric subset includes P-256, not X25519.
- Android platform XDH support begins on newer API levels, and Curve25519 KeyMint support depends on OS and hardware versions. It cannot be the cross-device MVP baseline.
- P-256 hardware-backed ECDH is the supportable common profile, with enrollment restricted to devices that report an accepted security level and support the required key-agreement purpose.

### Feasibility finding after approval

The runtime-disconnected probe found a material Android limitation:

- The current Android 36 toolchain supports `PURPOSE_AGREE_KEY` and compiles hardware-backed P-256 ECDH.
- Android's platform `BiometricPrompt.CryptoObject(KeyAgreement)` constructor is documented as added in platform version 36.1. It is not available to the repository's current Android 36 compile target.
- A per-use authenticated ECDH key can therefore be created, but the current client cannot complete a transaction-bound biometric `KeyAgreement` operation without weakening the approved guarantee to an authentication time window.
- The probe reports Android as ineligible and does not claim that a separate biometric prompt or timed authorization window is equivalent.

This finding blocks the proposed cross-platform production profile until one of the following is independently reviewed and approved:

1. raise the Android platform/device baseline to a version that provides transaction-bound `KeyAgreement`;
2. approve a different hardware-backed Android protocol with equivalent binding; or
3. explicitly weaken the guarantee to a narrowly bounded authentication window and accept the resulting threat-model change.

The deterministic V2 reference profile and Android native source compile passed. No physical Android device was connected, and iOS native compilation and physical Secure Enclave evidence require an Apple build environment and physical device.

## Options Considered

| Option | Security | Reliability | Protocol impact | Decision |
| --- | --- | --- | --- | --- |
| Browser-stored private key | Violates the current browser-persistence boundary | Browser/profile loss is likely | Keeps V1 | Reject |
| X25519 bytes in SecureStore | Encrypted at rest but private bytes enter the app process | Broad device support | Keeps V1 | Reject as production hardware custody |
| X25519 wrapped by a hardware AES key | Stronger at rest, but unwrapped X25519 bytes enter the process | Broad Android support; custom iOS handling | Keeps V1 with a new custody wrapper | Defer as a documented fallback study, not MVP default |
| Native non-exportable P-256 key | Best common iOS/Android hardware boundary | Device-bound; loss requires replacement | Requires registered-recipient V2 | Recommend |
| Server-held encrypted claimant-key backup | Could be zero knowledge only with a separate claimant recovery secret | Better recovery but materially expands attack and support scope | Requires a new recovery protocol | Future only |
| External hardware token/passkey-style custody | Strong custody and portability potential | Additional hardware and operational complexity | New protocol and support matrix | Future only |

## Recommended Client Boundary

### Public website

`sanduqkin.com/claim` remains static and informational. It does not accept secrets, identity documents, or claimant credentials.

### Claimant web portal

`app.sanduqkin.com` may later host:

- claimant authentication and MFA;
- policy acceptance;
- application creation;
- safe evidence status and uploads to the approved quarantine;
- case status, holds, requests, and decisions; and
- a prompt to continue cryptographic operations in the native app.

The web portal never creates, imports, stores, unwraps, or uses a claimant private key. It never decrypts released vault records.

### Sanduqkin native app

The existing mobile binary hosts an isolated claimant mode responsible for:

- device capability and security-level checks;
- device-bound key generation;
- public-key registration and possession proof;
- key fingerprint display;
- key replacement and local deletion;
- opening a claimant-addressed grant after authorized release;
- validating the signed release manifest and bindings; and
- memory-only, read-only released-vault decryption.

Owner and claimant modes may coexist for the same authenticated person, but their navigation, local key aliases, repositories, authorization capabilities, and decrypted state must remain separate. Claimant mode must never obtain an owner-vault repository merely because the same account is also an owner.

## Registered-Recipient V2 Cryptographic Direction

This section defines the boundary required for prototyping and independent review. Final primitive details require a focused cryptographic review before runtime implementation.

### Recipient key

- Algorithm: P-256 ECDH/key agreement.
- Generation: native platform keystore only.
- Private key: non-exportable and device-bound.
- Public key: compressed or uncompressed ANSI X9.63 representation under one canonical encoding rule.
- Access: user presence required for every private-key operation.
- iOS: Secure Enclave with `WhenPasscodeSetThisDeviceOnly` and user-presence access control.
- Android: Android Keystore with key-agreement purpose, per-use user authentication, invalidation on lock-screen removal or relevant biometric change, and accepted `TRUSTED_ENVIRONMENT` or `STRONGBOX` security level.

### Registration possession proof

1. The server issues a single-use, expiring challenge and an ephemeral P-256 public key.
2. The claimant device performs hardware-backed ECDH with the server ephemeral public key.
3. Both parties derive a challenge MAC key using versioned HKDF-SHA-256 labels and canonical context bindings.
4. The device returns a MAC over the canonical challenge.
5. The server consumes the challenge atomically and records only the claimant public key, key version, safe device/security metadata, and proof result.

This proves possession of the private key without exporting it or requiring a signing-capable second key.

### Owner grant

1. The unlocked owner client validates the recipient public key, version, fingerprint, and replacement state.
2. The owner client generates an ephemeral P-256 key pair.
3. It performs ECDH with the registered recipient public key.
4. A versioned HKDF-SHA-256 profile derives the MEK-wrap key.
5. XChaCha20-Poly1305 encrypts the canonical grant plaintext with associated data binding the protocol, owner, recipient, recipient key, grant, ephemeral public key, and creation time.
6. The envelope stores only public bindings, the owner ephemeral public key, nonce, ciphertext, and version metadata.
7. The claimant native client later performs hardware-backed ECDH, derives the same wrap key, opens the grant locally, and verifies every inner and outer binding.

The owner ephemeral private key exists only for grant creation and is zeroized after use. This protocol is not a libsodium sealed box and therefore must use a new version and new vectors.

## Device Eligibility

### iOS

Enrollment remains blocked. A future eligible implementation requires:

- Secure Enclave availability;
- a device passcode;
- user-presence access control;
- successful creation and retrieval of the public key;
- successful local possession-proof round trip; and
- physical-device testing. Simulators cannot establish the production custody claim.

### Android

Enrollment requires:

- an Android version and provider supporting Keystore P-256 key agreement;
- a secure lock screen;
- per-use user authentication;
- `KeyInfo` reporting `TRUSTED_ENVIRONMENT` or `STRONGBOX`;
- successful local possession-proof round trip; and
- physical-device testing across representative manufacturers.

If any requirement fails, enrollment is unavailable. The app provides an accurate explanation and does not downgrade to a software key.

## Loss, Replacement, And Recovery

- The private key is intentionally not transferable in the MVP.
- App deletion, device reset, passcode removal, biometric invalidation, hardware failure, or device loss may make the key permanently unavailable.
- A claimant may register a replacement key only with fresh `aal2`.
- Replacement revokes the old key and every unconsumed grant addressed to it.
- The owner must unlock the vault and explicitly finalize a new grant.
- During an active claim, replacement moves the claim to `on_hold`, invalidates decisions and packages, and restarts the applicable owner-protection and review controls.
- Password reset never reconstructs a claimant private key.
- Support cannot recover, replace, or bypass a claimant key.
- Product copy must disclose the device-loss risk before enrollment and after successful setup.

Before a live pilot, product review must decide whether this single-device limitation is acceptable or whether multi-device enrollment or a claimant-held recovery kit becomes mandatory.

## Threats And Required Tests

- Export attempt: native APIs must never return private-key bytes.
- Software fallback: unsupported hardware/provider/security levels fail closed.
- Key substitution: altered public keys, versions, fingerprints, or ephemeral keys fail binding validation.
- Challenge replay: expired, consumed, cross-account, cross-origin, and modified challenges fail.
- Authentication bypass: private-key use without current user presence fails.
- Enrollment change: passcode removal or relevant biometric change invalidates or blocks the key as designed.
- Cross-mode access: claimant mode cannot initialize or query another owner's vault repository.
- Cross-account access: one claimant cannot register, replace, prove, or use another claimant's key.
- Stale grant: replaced/revoked keys cannot open a current release path.
- Device loss: new-device registration does not silently restore the old key or grant.
- App lifecycle: derived secrets, opened MEKs, and plaintext records clear on background, lock, timeout, sign-out, displacement, and fatal error.
- Backup/restore: device-bound keys do not migrate; restored application state cannot claim the key still exists.
- Platform downgrade: OS/provider changes that remove the required security guarantee disable cryptographic claimant operations.

## First Bounded Implementation Slice After Approval

### Objective

Build a native, runtime-disconnected custody capability probe and deterministic registered-recipient V2 reference suite. Do not register a real key or connect to claimant authentication, Supabase, APIs, invitations, or release behavior.

### Deliverables

1. A typed cross-platform custody interface with:
   - capability inspection;
   - synthetic key creation under a test-only alias;
   - public-key export only;
   - local possession-proof exercise;
   - authenticated local ECDH exercise;
   - key deletion; and
   - structured, value-free result classes.
2. Native iOS and Android proof-of-concept modules isolated from production routes.
3. A `registered-recipient-v2` deterministic software reference vector for canonical encoding, HKDF, ECDH, wrapping, and binding validation.
4. Native tests that consume the public/reference vector while keeping the hardware private key non-exportable.
5. Physical-device evidence containing only device model, OS version, security level class, app build, and pass/fail.
6. A guard proving that no claimant capability, API route, database path, or hosted configuration can activate the probe.

### Non-goals

- No claimant registration or invitation acceptance.
- No production key alias.
- No public-key upload.
- No server challenge endpoint.
- No database migration, RLS policy, or Storage bucket.
- No owner grant finalization.
- No claim creation, evidence, review, notification, release package, or viewer.
- No software-key fallback.
- No cross-device recovery.

### Acceptance

- iOS physical-device probe confirms Secure Enclave P-256 key agreement, device-only/passcode-required storage, per-use user presence, public-key-only export, and deletion/invalidation behavior.
- Android physical-device probe confirms P-256 key agreement, secure-lock requirement, per-use authentication, accepted hardware security level, public-key-only export, and deletion/invalidation behavior.
- Private-key bytes are never available to TypeScript, logs, screenshots, crash artifacts, tests, or fixtures.
- The same canonical V2 reference envelope validates across native, shared reference, mobile test, web test, and API test consumers.
- Unsupported devices and emulators fail closed with accurate result classes.
- Standard repository, security, secret, native-build, and physical-device checks pass.

### Rollback

Remove or revert the isolated native probe, test alias, V2 reference contracts, and fixtures. Because there is no registration, persistence, API, database, or runtime route, rollback has no user or hosted-data migration.

### Stop gate

Record value-free evidence, delete every test alias, confirm claimant capabilities remain disabled, update the handoffs, and stop for owner and independent security review before selecting registered-recipient runtime preparation.

The implementation is currently stopped at this gate. The Android transaction-bound authentication requirement is unresolved, no physical-device evidence has been recorded, and no runtime preparation is authorized.

## Open Decisions

- Accept or reject the hybrid web/native claimant boundary.
- Accept or reject the protocol move from X25519 V1 to hardware-backed P-256 V2.
- Decide whether one existing mobile binary is acceptable or a separate claimant binary is required.
- Decide the minimum supported Android version and accepted hardware security levels.
- Decide whether per-use device credential fallback is acceptable or strong biometrics are mandatory.
- Decide whether the single-device loss model is acceptable for the MVP.
- Decide whether multi-device enrollment or a claimant-held recovery protocol is required before pilot.
- Obtain independent review of P-256 ECDH, HKDF, canonical encoding, possession proof, and envelope binding.

## Primary References

- Expo SecureStore: https://docs.expo.dev/versions/unversioned/sdk/securestore/
- Apple Keychain accessibility: https://developer.apple.com/documentation/Security/restricting-keychain-item-accessibility
- Apple biometric Keychain access: https://developer.apple.com/documentation/localauthentication/accessing-keychain-items-with-face-id-or-touch-id
- Apple Secure Enclave keys: https://developer.apple.com/documentation/Security/protecting-keys-with-the-secure-enclave
- Apple CryptoKit Keychain storage: https://developer.apple.com/documentation/cryptokit/storing-cryptokit-keys-in-the-keychain
- Android Keystore: https://developer.android.com/privacy-and-security/keystore
- Android hardware-backed Keystore: https://source.android.com/docs/security/features/keystore
- Android key attestation: https://developer.android.com/privacy-and-security/security-key-attestation
