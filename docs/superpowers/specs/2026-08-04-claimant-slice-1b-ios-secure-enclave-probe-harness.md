# Claimant Slice 1B iOS Secure Enclave Probe Harness

Date: 2026-08-04 (Asia/Dubai)

Status: implemented and passed; signed internal iOS Build 1 compiled successfully and the owner-reported physical-iPhone pass/cancel/retry/cleanup matrix passed.

## Purpose

This bounded harness makes the frozen native-enrollment V1 cryptographic profile compileable and physically testable in the existing Expo local module without creating a production claimant key path. It is evidence infrastructure only.

## Hard Boundary

- `CLAIMANT_CUSTODY_PROBE_ENABLED` remains a literal `false as const`.
- Application routes and ordinary mobile source may not import the claimant custody feature or native module.
- The module exposes exactly four probe methods: capability inspection, disposable key creation, protocol exercise, and deletion.
- Every operation is restricted to `com.sanduqkin.claimant-custody.probe-only.v3`. No production alias exists.
- The module accepts no invitation, claimant, challenge, server, API, Supabase, evidence, release, or persistence input.
- It returns only capability/result classes, the canonical public key and its public fingerprint, protocol profile, and probe-only marker. It never returns a private key, opaque key representation, ECDH result, proof key, proof MAC, salt, nonce, or canonical challenge.
- Cleanup runs on every TypeScript coordinator exit path. The report passes only when capability, creation, protocol exercise, matching creation/exercise fingerprint, and cleanup all pass.

## iOS Probe Operation

1. Confirm Secure Enclave availability and device-owner authentication availability.
2. Delete any stale V3 probe alias.
3. Create a Secure Enclave P-256 key-agreement private key using `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` and access-control flags `.privateKeyUsage` plus `.userPresence`.
4. Persist only CryptoKit's opaque Secure Enclave key representation in the device-only, passcode-bound Keychain item for the disposable probe alias.
5. Emit the 65-byte ANSI X9.63 public point as unpadded Base64URL and compute the frozen domain-separated SHA-256 public fingerprint.
6. Require device-owner authentication, reload the same Secure Enclave key with that `LAContext`, and generate an in-memory software server-ephemeral P-256 key plus independent 32-byte nonce and KDF salt using `SecRandomCopyBytes`.
7. Build the exact strict native-enrollment V1 challenge field set using sorted, slash-unescaped JSON. Derive both claimant and synthetic-server proof keys using the frozen P-256 ECDH/HKDF-SHA-256 transcript and verify the claimant HMAC-SHA-256 using CryptoKit's authentication-code verifier.
8. Return only pass/fail, protocol profile, and the public fingerprint. Derived values stay scoped to the call.
9. Delete the disposable key reference whether the probe passes, fails, or throws.

## Compile And Physical Evidence Gates

- Security CI's bounded `macos-15` / Xcode 26.2 simulator job runs the custody isolation guard before Expo iOS prebuild, Pods, unsigned release compilation, installation, and launch. The simulator proves compilation/integration only; it cannot prove Secure Enclave behavior.
- The Windows workspace has no local Swift/Xcode toolchain. Final EAS internal build `8b6095aa-1ec1-4550-97ae-1bf1ec66765d` compiled the exact uploaded probe input successfully under fingerprint `a7fdbb52437ea6d96733174cedd4af5d1e157db5`; together with the owner-reported matrix below, this closes the disposable probe's compile and physical-behavior gates only.
- The passcode-enabled physical-iPhone pass/cancel/retry/cleanup matrix is complete. Destructive passcode-removal/change behavior and reinstall/restore behavior remain later production-adapter evidence; they are not required to keep this disposable probe gate closed.
- The probe must remain inaccessible from application navigation. A future production enrollment adapter requires a separate reviewed slice and may not reuse the probe alias.

## Value-Free Physical Evidence Runner

The repository now includes an isolated coordinator for a future dedicated physical-device test host. It has no application entry point and normal application source remains forbidden from importing the custody feature.

The runner accepts only an exact V1 precondition object: iOS, `claimant_custody_probe` build profile, explicit physical-device/passcode/operator/value-free confirmations, `production_runtime: false`, and a random UUID run ID. Relaxed, missing, or additional device/operator fields fail before native code is touched.

The returned report contains only its protocol/run ID, build profile, start/completion timestamps, generic capability/creation/exercise/cleanup result classes, fingerprint-continuity boolean, pass/fail, platform, and probe-only marker. It deliberately omits device identifiers/names, public keys, fingerprint values, key material, proof/MAC, nonce, salt, challenge, native error text, and biometric detail. Native errors become the generic `probe_error` class; cleanup is still attempted and is not claimed confirmed when an exception prevents a cleanup result from being observed.

The runner is now called only by a dedicated internal probe app selected through a separate Expo Router root and bundle identifier. Normal Sanduqkin builds retain `./app` and never import the probe. The probe build contains one evidence screen and remains neither a claimant runtime nor a production capability.

## Non-Goals

- No claimant sign-in or MFA.
- No live challenge, endpoint, database, invitation acceptance, notification, deep link, or device registration.
- No Android eligibility change or software-key fallback.
- No production key alias, second-device enrollment, owner grant, evidence, review, release, deployment, TestFlight build, or hosted-state change.
